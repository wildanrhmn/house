import { ORDER_TYPE, fromHuman, probabilityToPrice, toHuman } from "@somnia-chain/markets-sdk";
import type { Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { discoverWindow, type HouseWindow } from "../../web/src/lib/discover.ts";
import { createSignedExchange } from "../../web/src/lib/exchange.ts";
import { readInventory, restingQuotes, type Resting } from "../../web/src/lib/house.ts";
import { expireNs, snapLot, snapTick } from "../../web/src/lib/quoting.ts";
import { envNumber, keyFromEnv, marketFromEnv, short } from "./env.ts";

// The demo taker. It crosses whatever HOUSE has resting with immediate or
// cancel orders, and only that: a side a stranger already took is skipped.
// Pool prices are YES terms, so a BUY_NO is more aggressive at a LOWER price.
// Each leg is sized to sweep the depth in front of HOUSE's level, so a better
// bid or ask posted in between does not soak up the fill. --watch waits for
// the quote and fires within seconds of it resting, before the book moves.

const DRY = process.argv.includes("--dry");
const FAUCET = process.argv.includes("--faucet");
const WATCH = process.argv.includes("--watch");
const MARKET = marketFromEnv();
const SIZE = envNumber("TAKE_SIZE", 5);
const MARGIN = envNumber("TAKE_MARGIN", 0.02);
const SWEEP_CAP = envNumber("TAKE_SWEEP_CAP", 2000);
const WATCH_MS = envNumber("TAKE_WATCH_MIN", 10) * 60_000;

const min = (a: bigint, b: bigint) => (a < b ? a : b);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const stamp = () => new Date().toISOString().slice(11, 19) + "Z";

type Ex = ReturnType<typeof createSignedExchange>;
type State = { live: HouseWindow; bid?: Resting; ask?: Resting; up: bigint; down: bigint; want: bigint };

async function liveWindow(exchange: Ex): Promise<HouseWindow | null> {
  const live = await discoverWindow(exchange, MARKET.asset, MARKET.intervalSec);
  if (!live || live.expiry <= Date.now() / 1000) return null;
  const oc = await exchange.client.getMarketOnchain(live.marketId);
  return oc.status === 1 ? live : null;
}

async function observe(taker: Ex, makerEx: Ex, maker: Address, live: HouseWindow): Promise<State> {
  const [held, r] = await Promise.all([
    readInventory(makerEx, live),
    restingQuotes(taker, live.pool as Address, maker),
  ]);
  return { live, bid: r.bid, ask: r.ask, up: held.up, down: held.down, want: fromHuman(SIZE, live.quoteDecimals) };
}

// Fire when both sides rest, or when one rests and the other was already
// taken by someone else. Nothing resting means nothing to take.
function ready(s: State): boolean {
  if (!s.bid && !s.ask) return false;
  return (!!s.bid || s.up >= s.want) && (!!s.ask || s.down >= s.want);
}

function describe(s: State): string {
  const d = s.live.quoteDecimals;
  const h = (v: bigint) => Number(toHuman(v, d)).toFixed(3);
  const px = (o?: Resting) => (o ? `${h(o.price)} x ${h(o.quantity)}` : "-");
  return `window ${s.live.marketId.slice(-6)} resting up ${px(s.bid)} down ${px(s.ask)} holds up ${h(s.up)} down ${h(s.down)}`;
}

async function fire(taker: Ex, makerEx: Ex, s: State): Promise<void> {
  const live = s.live;
  const d = live.quoteDecimals;
  const human = (v: bigint | string) => Number(toHuman(v, d)).toFixed(3);
  const pool = live.pool as Address;
  const params = await taker.client.getBinaryBookParams(pool);
  const book = await taker.client.getBinaryOrderBook(pool, { depth: 12, decimals: d });
  if (!s.bid) console.log("UP already taken by someone else, skipping that leg");
  if (!s.ask) console.log("DOWN already taken by someone else, skipping that leg");

  const margin = snapTick(probabilityToPrice(MARGIN, d), params.tickSize);
  const one = probabilityToPrice(1, d);
  const cap = fromHuman(SWEEP_CAP, d);
  const legs: { side: "BUY_YES" | "BUY_NO"; price: bigint; quantity: bigint; front: bigint }[] = [];
  if (s.ask) {
    let front = 0n;
    for (const lvl of book.yesAsks) if (BigInt(lvl.price) < s.ask.price) front += BigInt(lvl.quantity);
    legs.push({
      side: "BUY_YES",
      price: min(s.ask.price + margin, one - params.tickSize),
      quantity: snapLot(min(cap, front + min(s.want, s.ask.quantity)), params.lotSize),
      front,
    });
  }
  if (s.bid) {
    let front = 0n;
    for (const lvl of book.yesBids) if (BigInt(lvl.price) > s.bid.price) front += BigInt(lvl.quantity);
    legs.push({
      side: "BUY_NO",
      price: s.bid.price > margin + params.tickSize ? s.bid.price - margin : params.tickSize,
      quantity: snapLot(min(cap, front + min(s.want, s.bid.quantity)), params.lotSize),
      front,
    });
  }
  for (const l of legs) {
    console.log("plan", l.side, "limit", human(l.price), "qty", human(l.quantity), "of which in front", human(l.front));
  }
  if (legs.every((l) => l.quantity === 0n)) {
    console.log("nothing to take at one lot");
    return;
  }
  if (DRY) return;

  const oc = await taker.client.getMarketOnchain(live.marketId);
  const expiry = expireNs(Number(oc.expiry), 30);
  for (const l of legs) {
    if (l.quantity === 0n) continue;
    try {
      const res = await taker.trader.placeOrder({
        pool,
        side: l.side,
        price: l.price,
        quantity: l.quantity,
        orderType: ORDER_TYPE.MARKET,
        expireTimestampNs: expiry,
      });
      console.log(stamp(), l.side, res.receipt?.status ?? "sent", res.receipt?.transactionHash ?? "");
    } catch (err) {
      console.log(stamp(), l.side, "failed:", err instanceof Error ? err.message : String(err));
    }
  }
  const after = await readInventory(makerEx, live);
  console.log("maker now holds", { up: human(after.up), down: human(after.down), pairs: human(min(after.up, after.down)) });
}

async function main() {
  const taker = createSignedExchange({ privateKey: keyFromEnv("TAKER_KEY") });
  const me = taker.walletAddress as Address | undefined;
  if (!me) throw new Error("taker wallet did not load");
  const makerEx = createSignedExchange({ privateKey: keyFromEnv("PRIVATE_KEY") });
  const maker = privateKeyToAccount(keyFromEnv("PRIVATE_KEY")).address;
  console.log("HOUSE take", short(me), "against", short(maker), MARKET.label, DRY ? "dry run" : WATCH ? "watching" : "");

  if (FAUCET && !DRY) {
    const r = await taker.trader.faucet();
    console.log("faucet", r.receipt?.status ?? "sent");
    if (process.argv.includes("--faucet-only")) return;
  }

  if (!WATCH) {
    const live = await liveWindow(taker);
    if (!live) {
      console.log(`no live DreamDEX ${MARKET.label} window`);
      return;
    }
    const s = await observe(taker, makerEx, maker, live);
    console.log(describe(s), "expires in", Math.round(live.expiry - Date.now() / 1000), "s");
    if (!ready(s)) {
      console.log("HOUSE has nothing resting: quote first, or run with --watch and quote after");
      return;
    }
    await fire(taker, makerEx, s);
    return;
  }

  const until = Date.now() + WATCH_MS;
  let last = "";
  while (Date.now() < until) {
    try {
      const live = await liveWindow(taker);
      const line = live ? describe(await observe(taker, makerEx, maker, live)) : "no live window with time left";
      if (line !== last) {
        console.log(stamp(), line);
        last = line;
      }
      if (live) {
        const s = await observe(taker, makerEx, maker, live);
        if (ready(s)) {
          await fire(taker, makerEx, s);
          return;
        }
      }
    } catch (err) {
      console.log(stamp(), "poll failed:", err instanceof Error ? err.message.split("\n")[0] : String(err));
    }
    await sleep(2000);
  }
  console.log("gave up waiting");
}

// The SDK keeps a websocket open, so end the process explicitly.
main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });

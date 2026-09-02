import { ORDER_TYPE, fromHuman, probabilityToPrice, toHuman } from "@somnia-chain/markets-sdk";
import { createPublicClient, erc20Abi, http, type Address } from "viem";
import {
  CHAIN,
  DEFAULT_HALF_SPREAD,
  DEFAULT_QUOTE_SIZE,
  HTTP_RPC_URL,
  TUSDC,
  minLeftSec,
} from "../../web/src/lib/config.ts";
import { discoverWindow, type HouseWindow } from "../../web/src/lib/discover.ts";
import { createSignedExchange } from "../../web/src/lib/exchange.ts";
import {
  cancelOwn,
  flattenInventory,
  quoteWithRetry,
  readInventory,
  restingQuotes,
} from "../../web/src/lib/house.ts";
import { expireNs, snapLot, snapTick } from "../../web/src/lib/quoting.ts";
import { envNumber, keyFromEnv, short } from "./env.ts";

// The whole HOUSE loop in one process. Each round: the maker rests both
// sides, the taker immediately crosses each resting quote, sized to sweep
// whatever sits in front of it, and the round succeeds when the maker holds a
// complete set. Then Flatten merges the sets back to collateral.

const SIZE = envNumber("HOUSE_SIZE", DEFAULT_QUOTE_SIZE);
const HALF = envNumber("HOUSE_HALF_SPREAD", DEFAULT_HALF_SPREAD);
const MARGIN = envNumber("TAKE_MARGIN", 0.02);
const SWEEP_CAP = envNumber("TAKE_SWEEP_CAP", 400);
const ROUNDS = envNumber("DEMO_ROUNDS", 4);
const KEEP = process.argv.includes("--keep");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const min = (a: bigint, b: bigint) => (a < b ? a : b);

async function windowWithRoom(exchange: ReturnType<typeof createSignedExchange>) {
  for (let i = 0; i < 40; i++) {
    const w = await discoverWindow(exchange);
    if (w && w.expiry - Date.now() / 1000 > minLeftSec(w.intervalSec) + 90) return w;
    console.log("waiting for a window with room to quote");
    await sleep(15_000);
  }
  return null as HouseWindow | null;
}

async function main() {
  const maker = createSignedExchange({ privateKey: keyFromEnv("PRIVATE_KEY") });
  const taker = createSignedExchange({ privateKey: keyFromEnv("TAKER_KEY") });
  const M = maker.walletAddress as Address | undefined;
  const T = taker.walletAddress as Address | undefined;
  if (!M || !T) throw new Error("wallets did not load");
  console.log("HOUSE demo", { maker: short(M), taker: short(T), size: SIZE, halfSpread: HALF });

  const pc = createPublicClient({ chain: CHAIN, transport: http(HTTP_RPC_URL) });
  const usdc = async (who: Address) =>
    Number(toHuman(await pc.readContract({ address: TUSDC, abi: erc20Abi, functionName: "balanceOf", args: [who] }), 6));

  const live = await windowWithRoom(maker);
  if (!live) throw new Error("no window with enough time left");
  const d = live.quoteDecimals;
  const human = (v: bigint) => Number(toHuman(v, d)).toFixed(3);
  const pool = live.pool as Address;
  const oc = await maker.client.getMarketOnchain(live.marketId);
  const params = await taker.client.getBinaryBookParams(pool);
  const margin = snapTick(probabilityToPrice(MARGIN, d), params.tickSize);
  const one = probabilityToPrice(1, d);
  const want = fromHuman(SIZE, d);
  const cap = fromHuman(SWEEP_CAP, d);
  console.log("window", live.marketId, "expires in", Math.round(live.expiry - Date.now() / 1000), "s");

  const startUsdc = await usdc(M);
  const startInv = await readInventory(maker, live);
  console.log("maker start", { up: human(startInv.up), down: human(startInv.down), tUSDC: startUsdc.toFixed(3) });

  let sets = 0n;
  for (let round = 1; round <= ROUNDS; round++) {
    console.log(`round ${round}`);
    await cancelOwn(maker, live);
    const q = await quoteWithRetry(maker, live, HALF, SIZE);
    if (!q.plan) throw new Error("window too close to lock or no fair");
    console.log("quote", {
      fair: q.plan.fair.toFixed(3),
      bidYes: q.plan.bidYes.toFixed(3),
      askYes: q.plan.askYes.toFixed(3),
      upId: q.upId ?? null,
      downId: q.downId ?? null,
      skipped: q.skipped,
    });

    const r = await restingQuotes(maker, pool, M);
    const book = await maker.client.getBinaryOrderBook(pool, { depth: 12, decimals: d });
    const before = await readInventory(maker, live);
    console.log("resting", { bid: r.bid ? human(r.bid.price) : null, ask: r.ask ? human(r.ask.price) : null });

    const expiry = expireNs(Number(oc.expiry), 30);
    const leg = async (side: "BUY_YES" | "BUY_NO", price: bigint, quantity: bigint, front: bigint) => {
      try {
        const res = await taker.trader.placeOrder({
          pool,
          side,
          price,
          quantity,
          orderType: ORDER_TYPE.MARKET,
          expireTimestampNs: expiry,
        });
        console.log(
          "taker",
          side,
          "limit",
          human(price),
          "qty",
          human(quantity),
          "in front",
          human(front),
          res.receipt?.status ?? "sent",
          res.receipt?.transactionHash ?? "",
        );
      } catch (err) {
        console.log("taker", side, "failed:", err instanceof Error ? err.message : String(err));
      }
    };

    if (r.ask) {
      let front = 0n;
      for (const lvl of book.yesAsks) if (BigInt(lvl.price) < r.ask.price) front += BigInt(lvl.quantity);
      const qty = snapLot(min(cap, front + min(want, r.ask.quantity)), params.lotSize);
      await leg("BUY_YES", min(r.ask.price + margin, one - params.tickSize), qty, front);
    }
    if (r.bid) {
      let front = 0n;
      for (const lvl of book.yesBids) if (BigInt(lvl.price) > r.bid.price) front += BigInt(lvl.quantity);
      const qty = snapLot(min(cap, front + min(want, r.bid.quantity)), params.lotSize);
      const price = r.bid.price > margin + params.tickSize ? r.bid.price - margin : params.tickSize;
      await leg("BUY_NO", price, qty, front);
    }

    const after = await readInventory(maker, live);
    sets = min(after.up, after.down);
    console.log("maker inventory", {
      before: { up: human(before.up), down: human(before.down) },
      after: { up: human(after.up), down: human(after.down) },
      sets: human(sets),
    });
    if (sets >= want) break;
    console.log("no full set yet, another round");
    await sleep(3000);
  }

  console.log(sets > 0n ? `complete sets held by the maker: ${human(sets)}` : "no complete set this time");
  if (KEEP) return;

  const out = await flattenInventory(maker, live);
  const endUsdc = await usdc(M);
  console.log("flatten", {
    merged: human(out.merged),
    mergeTx: out.mergeTx ?? null,
    soldUp: human(out.soldUp),
    soldDown: human(out.soldDown),
  });
  console.log("maker tUSDC", {
    start: startUsdc.toFixed(3),
    end: endUsdc.toFixed(3),
    delta: (endUsdc - startUsdc).toFixed(3),
  });
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });

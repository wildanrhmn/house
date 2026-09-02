import { ORDER_TYPE, fromHuman, probabilityToPrice, toHuman } from "@somnia-chain/markets-sdk";
import type { Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { discoverWindow } from "../../web/src/lib/discover.ts";
import { createSignedExchange } from "../../web/src/lib/exchange.ts";
import { restingQuotes } from "../../web/src/lib/house.ts";
import { expireNs, snapLot, snapTick } from "../../web/src/lib/quoting.ts";
import { envNumber, keyFromEnv, short } from "./env.ts";

// The demo taker. It crosses both HOUSE quotes with immediate or cancel orders.
// Each cross has no seller, so the pool mints a complete set into HOUSE.
// Pool prices are YES terms, so a BUY_NO is more aggressive at a LOWER price.
// Both legs cross by TAKE_MARGIN so a moving book does not leave one unfilled.

const DRY = process.argv.includes("--dry");
const FAUCET = process.argv.includes("--faucet");
const SIZE = envNumber("TAKE_SIZE", 5);
const MARGIN = envNumber("TAKE_MARGIN", 0.02);

const min = (a: bigint, b: bigint) => (a < b ? a : b);

function makerAddress(): Address | null {
  try {
    return privateKeyToAccount(keyFromEnv("PRIVATE_KEY")).address;
  } catch {
    return null;
  }
}

async function main() {
  const exchange = createSignedExchange({ privateKey: keyFromEnv("TAKER_KEY") });
  const me = exchange.walletAddress as Address | undefined;
  if (!me) throw new Error("taker wallet did not load");
  console.log("HOUSE take", short(me), DRY ? "dry run" : "");

  if (FAUCET && !DRY) {
    const r = await exchange.trader.faucet();
    console.log("faucet", r.receipt?.status ?? "sent");
    if (process.argv.includes("--faucet-only")) return;
  }

  const live = await discoverWindow(exchange);
  if (!live) {
    console.log("no live DreamDEX BTC 15m window");
    return;
  }
  const oc = await exchange.client.getMarketOnchain(live.marketId);
  if (oc.status !== 1) {
    console.log("window is not Trading on chain");
    return;
  }

  const d = live.quoteDecimals;
  const human = (v: bigint | string) => Number(toHuman(v, d)).toFixed(3);
  const params = await exchange.client.getBinaryBookParams(live.pool);
  const pool = live.pool as Address;
  console.log("window", live.marketId, "expires in", Math.round(live.expiry - Date.now() / 1000), "s");

  let bidPx: bigint | null = null;
  let bidQty = 0n;
  let askPx: bigint | null = null;
  let askQty = 0n;
  const maker = makerAddress();
  if (maker) {
    const r = await restingQuotes(exchange, pool, maker);
    if (r.bid) {
      bidPx = r.bid.price;
      bidQty = r.bid.quantity;
    }
    if (r.ask) {
      askPx = r.ask.price;
      askQty = r.ask.quantity;
    }
    console.log("maker", short(maker), {
      bid: bidPx !== null ? `${human(bidPx)} x ${human(bidQty)}` : null,
      ask: askPx !== null ? `${human(askPx)} x ${human(askQty)}` : null,
    });
  }
  if (bidPx === null || askPx === null) {
    const book = await exchange.client.getBinaryOrderBook(live.pool, { depth: 5, decimals: d });
    const bid = book.yesBids[0];
    const ask = book.yesAsks[0];
    console.log("top of book", {
      bid: bid ? `${human(bid.price)} x ${human(bid.quantity)}` : null,
      ask: ask ? `${human(ask.price)} x ${human(ask.quantity)}` : null,
    });
    if (bidPx === null && bid) {
      bidPx = BigInt(bid.price);
      bidQty = BigInt(bid.quantity);
    }
    if (askPx === null && ask) {
      askPx = BigInt(ask.price);
      askQty = BigInt(ask.quantity);
    }
  }
  if (bidPx === null || askPx === null) {
    console.log("need a resting quote on both sides first: npm run quote");
    return;
  }

  const margin = snapTick(probabilityToPrice(MARGIN, d), params.tickSize);
  const one = probabilityToPrice(1, d);
  const buyYesAt = min(askPx + margin, one - params.tickSize);
  const buyNoAt = bidPx > margin + params.tickSize ? bidPx - margin : params.tickSize;
  const want = fromHuman(SIZE, d);
  const qtyYes = snapLot(min(want, askQty), params.lotSize);
  const qtyNo = snapLot(min(want, bidQty), params.lotSize);

  const balances = async (who: Address) => {
    const [yes, no] = await Promise.all([
      exchange.client.getOutcomeBalance({ outcomeToken: oc.outcomeToken, account: who, id: oc.yesId }),
      exchange.client.getOutcomeBalance({ outcomeToken: oc.outcomeToken, account: who, id: oc.noId }),
    ]);
    return { yes: human(yes), no: human(no) };
  };

  console.log("plan", {
    buyYesAt: human(buyYesAt),
    qtyYes: human(qtyYes),
    buyNoAtYesPrice: human(buyNoAt),
    qtyNo: human(qtyNo),
  });
  if (qtyYes === 0n && qtyNo === 0n) {
    console.log("nothing to take at one lot");
    return;
  }
  if (DRY) return;

  const before = await balances(me);
  const makerBefore = maker ? await balances(maker) : null;
  const expiry = expireNs(Number(oc.expiry), 30);

  const leg = async (side: "BUY_YES" | "BUY_NO", price: bigint, quantity: bigint) => {
    if (quantity === 0n) return;
    try {
      const r = await exchange.trader.placeOrder({
        pool,
        side,
        price,
        quantity,
        orderType: ORDER_TYPE.MARKET,
        expireTimestampNs: expiry,
      });
      console.log(side, r.receipt?.status ?? "sent", r.receipt?.transactionHash ?? "");
    } catch (err) {
      console.log(side, "failed:", err instanceof Error ? err.message : String(err));
    }
  };

  await leg("BUY_YES", buyYesAt, qtyYes);
  await leg("BUY_NO", buyNoAt, qtyNo);

  console.log("taker outcome balance", { before, after: await balances(me) });
  if (maker) console.log("maker outcome balance", { before: makerBefore, after: await balances(maker) });
}

// The SDK keeps a websocket open, so end the process explicitly.
main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });

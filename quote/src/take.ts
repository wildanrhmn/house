import { ORDER_TYPE, fromHuman, toHuman } from "@somnia-chain/markets-sdk";
import type { Address } from "viem";
import { discoverWindow } from "../../web/src/lib/discover.ts";
import { createSignedExchange } from "../../web/src/lib/exchange.ts";
import { expireNs, snapLot } from "../../web/src/lib/quoting.ts";
import { envNumber, keyFromEnv, short } from "./env.ts";

// The second wallet in the demo. It lifts HOUSE's implied Up ask with a BUY_YES
// and hits HOUSE's bid with a BUY_NO, both immediate or cancel. Each cross has
// no seller, so the pool mints a complete set and HOUSE ends up holding it.

const DRY = process.argv.includes("--dry");
const FAUCET = process.argv.includes("--faucet");
const SIZE = envNumber("TAKE_SIZE", 5);

const min = (a: bigint, b: bigint) => (a < b ? a : b);

async function main() {
  const exchange = createSignedExchange({ privateKey: keyFromEnv("TAKER_KEY") });
  const me = exchange.walletAddress as Address | undefined;
  if (!me) throw new Error("taker wallet did not load");
  console.log("HOUSE take", short(me), DRY ? "dry run" : "");

  if (FAUCET && !DRY) {
    const r = await exchange.trader.faucet();
    console.log("faucet", r.receipt?.status ?? "sent");
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
  const book = await exchange.client.getBinaryOrderBook(live.pool, { depth: 5, decimals: d });
  const bid = book.yesBids[0];
  const ask = book.yesAsks[0];
  console.log("window", live.marketId, "expires in", Math.round(live.expiry - Date.now() / 1000), "s");
  console.log("top of book", {
    bid: bid ? `${human(bid.price)} x ${human(bid.quantity)}` : null,
    ask: ask ? `${human(ask.price)} x ${human(ask.quantity)}` : null,
  });
  if (!bid || !ask) {
    console.log("need a resting quote on both sides first: npm run quote");
    return;
  }

  const params = await exchange.client.getBinaryBookParams(live.pool);
  const want = fromHuman(SIZE, d);
  const qtyYes = snapLot(min(want, BigInt(ask.quantity)), params.lotSize);
  const qtyNo = snapLot(min(want, BigInt(bid.quantity)), params.lotSize);
  const pool = live.pool as Address;
  const balances = async () => {
    const [yes, no] = await Promise.all([
      exchange.client.getOutcomeBalance({ outcomeToken: oc.outcomeToken, account: me, id: oc.yesId }),
      exchange.client.getOutcomeBalance({ outcomeToken: oc.outcomeToken, account: me, id: oc.noId }),
    ]);
    return { yes: human(yes), no: human(no) };
  };

  console.log("plan", {
    buyYesAt: human(ask.price),
    qtyYes: human(qtyYes),
    buyNoAtYesPrice: human(bid.price),
    qtyNo: human(qtyNo),
  });
  if (qtyYes === 0n && qtyNo === 0n) {
    console.log("nothing to take at one lot");
    return;
  }
  if (DRY) return;

  const before = await balances();
  const expiry = expireNs(Number(oc.expiry), 30);

  if (qtyYes > 0n) {
    const r = await exchange.trader.placeOrder({
      pool,
      side: "BUY_YES",
      price: BigInt(ask.price),
      quantity: qtyYes,
      orderType: ORDER_TYPE.MARKET,
      expireTimestampNs: expiry,
    });
    console.log("BUY_YES", r.receipt?.status ?? "sent", r.receipt?.transactionHash ?? "");
  }
  if (qtyNo > 0n) {
    const r = await exchange.trader.placeOrder({
      pool,
      side: "BUY_NO",
      // Priced in YES terms, so matching HOUSE's bid means paying 1 minus it for NO.
      price: BigInt(bid.price),
      quantity: qtyNo,
      orderType: ORDER_TYPE.MARKET,
      expireTimestampNs: expiry,
    });
    console.log("BUY_NO", r.receipt?.status ?? "sent", r.receipt?.transactionHash ?? "");
  }

  console.log("taker outcome balance", { before, after: await balances() });
}

// The SDK keeps a websocket open, so end the process explicitly.
main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });

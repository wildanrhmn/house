import { toHuman } from "@somnia-chain/markets-sdk";
import { DEFAULT_HALF_SPREAD, DEFAULT_QUOTE_SIZE } from "../../web/src/lib/config.ts";
import { discoverWindow, type HouseWindow } from "../../web/src/lib/discover.ts";
import { createSignedExchange } from "../../web/src/lib/exchange.ts";
import { cancelOwn, quoteWithRetry } from "../../web/src/lib/house.ts";
import { envNumber, keyFromEnv, marketFromEnv, short } from "./env.ts";

const LOOP_MS = 20_000;
const ONCE = process.argv.includes("--once");
const HALF_SPREAD = envNumber("HOUSE_HALF_SPREAD", DEFAULT_HALF_SPREAD);
const SIZE = envNumber("HOUSE_SIZE", DEFAULT_QUOTE_SIZE);
const MARKET = marketFromEnv();

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function topOfBook(exchange: ReturnType<typeof createSignedExchange>, live: HouseWindow) {
  const book = await exchange.client.getBinaryOrderBook(live.pool, {
    depth: 1,
    decimals: live.quoteDecimals,
  });
  const px = (row?: { price: bigint | string }) =>
    row ? Number(toHuman(row.price, live.quoteDecimals)).toFixed(3) : null;
  return { bestBid: px(book.yesBids[0]), bestAsk: px(book.yesAsks[0]) };
}

async function tick(exchange: ReturnType<typeof createSignedExchange>, lastId: string | null) {
  const live = await discoverWindow(exchange, MARKET.asset, MARKET.intervalSec);
  if (!live) {
    console.log(`no live DreamDEX ${MARKET.label} window`);
    return lastId;
  }

  if (lastId && lastId !== live.marketId) {
    console.log("window rolled", live.marketId);
  }

  // Cancel first, then plan from the freshest book right before placing.
  await cancelOwn(exchange, live);
  const result = await quoteWithRetry(exchange, live, HALF_SPREAD, SIZE);
  const plan = result.plan;
  if (!plan) {
    console.log("skip", live.marketId, "too close to lock or no fair");
    return live.marketId;
  }

  console.log({
    marketId: live.marketId,
    fair: plan.fair.toFixed(3),
    bidYes: plan.bidYes.toFixed(3),
    askYes: plan.askYes.toFixed(3),
    upId: result.upId ?? null,
    downId: result.downId ?? null,
    skipped: result.skipped,
    simulated: result.simulated ?? false,
    book: await topOfBook(exchange, live),
  });
  return live.marketId;
}

async function main() {
  const exchange = createSignedExchange({ privateKey: keyFromEnv("PRIVATE_KEY") });
  const wallet = exchange.walletAddress;
  if (!wallet) throw new Error("wallet did not load");
  console.log("HOUSE quote", short(wallet), `half spread ${HALF_SPREAD}`, `size ${SIZE}`);

  // One tick and out. The quotes keep resting until their own expiry.
  if (ONCE) {
    await tick(exchange, null);
    process.exit(0);
  }

  let lastId: string | null = null;
  let stop = false;

  const halt = async () => {
    if (stop) return;
    stop = true;
    console.log("stopping");
    try {
      const live = await discoverWindow(exchange, MARKET.asset, MARKET.intervalSec);
      if (live) await cancelOwn(exchange, live);
    } catch (err) {
      console.warn("cancel on stop failed", err);
    }
    process.exit(0);
  };

  process.on("SIGINT", () => void halt());
  process.on("SIGTERM", () => void halt());

  // Keep the process up: the SDK websocket would anyway, and we requote on a timer.
  while (!stop) {
    try {
      lastId = await tick(exchange, lastId);
    } catch (err) {
      console.error(err instanceof Error ? err.message : err);
    }
    if (!stop) await sleep(LOOP_MS);
  }
}

void main();

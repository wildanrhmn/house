import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { discoverWindow, type HouseWindow } from "../../web/src/lib/discover.ts";
import { createSignedExchange } from "../../web/src/lib/exchange.ts";
import { cancelOwn, planQuotes, quoteBothSides } from "../../web/src/lib/house.ts";

const LOOP_MS = 20_000;

function privateKeyFromEnvFile(): `0x${string}` {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../.env");
  const text = readFileSync(root, "utf8");
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    if (line.slice(0, eq).trim() !== "PRIVATE_KEY") continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!value.startsWith("0x")) value = `0x${value}`;
    return value as `0x${string}`;
  }
  throw new Error("PRIVATE_KEY missing from .env");
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function tick(exchange: ReturnType<typeof createSignedExchange>, lastId: string | null) {
  const live = await discoverWindow(exchange);
  if (!live) {
    console.log("no live DreamDEX BTC 15m window");
    return lastId;
  }

  if (lastId && lastId !== live.marketId) {
    console.log("window rolled", live.marketId);
  }

  const plan = await planQuotes(exchange, live);
  if (!plan) {
    console.log("skip", live.marketId, "too close to lock or no fair");
    return live.marketId;
  }

  await cancelOwn(exchange, live);
  const result = await quoteBothSides(exchange, live, plan);
  console.log({
    marketId: live.marketId,
    fair: plan.fair.toFixed(3),
    bidYes: plan.bidYes.toFixed(3),
    askYes: plan.askYes.toFixed(3),
    upId: result.upId ?? null,
    downId: result.downId ?? null,
    skipped: result.skipped,
  });
  return live.marketId;
}

async function main() {
  const exchange = createSignedExchange({ privateKey: privateKeyFromEnvFile() });
  const wallet = exchange.walletAddress;
  if (!wallet) throw new Error("wallet did not load");
  console.log("HOUSE quote", wallet.slice(0, 6) + "..." + wallet.slice(-4));

  let lastId: string | null = null;
  let stop = false;
  let live: HouseWindow | null = null;

  const halt = async () => {
    if (stop) return;
    stop = true;
    console.log("stopping");
    try {
      live = await discoverWindow(exchange);
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

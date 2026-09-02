import { toHuman } from "@somnia-chain/markets-sdk";
import { createPublicClient, erc20Abi, http, type Address } from "viem";
import { CHAIN, HTTP_RPC_URL, TUSDC } from "../../web/src/lib/config.ts";
import { discoverWindow } from "../../web/src/lib/discover.ts";
import { createSignedExchange } from "../../web/src/lib/exchange.ts";
import { flattenInventory, readInventory } from "../../web/src/lib/house.ts";
import { keyFromEnv, marketFromEnv, short } from "./env.ts";

// Maker side of the demo from Node: cancel, merge balanced sets back to
// collateral, sell leftovers. --dry only prints inventory and collateral.

const DRY = process.argv.includes("--dry");
const MARKET = marketFromEnv();

async function main() {
  const exchange = createSignedExchange({ privateKey: keyFromEnv("PRIVATE_KEY") });
  const me = exchange.walletAddress as Address | undefined;
  if (!me) throw new Error("wallet did not load");
  console.log("HOUSE flatten", short(me), DRY ? "dry run" : "");

  const live = await discoverWindow(exchange, MARKET.asset, MARKET.intervalSec);
  if (!live) {
    console.log(`no live DreamDEX ${MARKET.label} window`);
    return;
  }
  const d = live.quoteDecimals;
  const human = (v: bigint) => Number(toHuman(v, d)).toFixed(3);
  const pc = createPublicClient({ chain: CHAIN, transport: http(HTTP_RPC_URL) });
  const collateral = async () =>
    human(await pc.readContract({ address: TUSDC, abi: erc20Abi, functionName: "balanceOf", args: [me] }));

  const inv = await readInventory(exchange, live);
  const before = await collateral();
  console.log("window", live.marketId);
  console.log("inventory", { up: human(inv.up), down: human(inv.down), tUSDC: before });
  if (DRY) return;

  const out = await flattenInventory(exchange, live);
  const after = await readInventory(exchange, live);
  const usdc = await collateral();
  console.log("flatten", {
    merged: human(out.merged),
    soldUp: human(out.soldUp),
    soldDown: human(out.soldDown),
    up: human(after.up),
    down: human(after.down),
    tUSDC: usdc,
    delta: (Number(usdc) - Number(before)).toFixed(3),
  });
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });

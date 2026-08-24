// Streakline keeper: binds each run's next leg to a live window and settles
// finished legs. It holds no user funds — the vault enforces venue, series,
// leg order, and price caps on-chain; the keeper only picks windows and timing.
import { SomniaMarkets, SOMNIA_TESTNET_ADDRESSES } from "@somnia-chain/markets-sdk";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  parseAbi,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { config as dotenv } from "dotenv";
dotenv();

const RPC = process.env.RPC_URL ?? "https://api.infra.testnet.somnia.network";
const VAULT = process.env.VAULT_ADDRESS as Address;
const POLL_MS = Number(process.env.POLL_MS ?? 5000);
const SLIPPAGE = Number(process.env.SLIPPAGE ?? 0.03);
const ONE = 10n ** 6n; // testnet tUSDC decimals

const poolParamsAbi = parseAbi([
  "function getOrderBookParameters() view returns ((uint256 tickSize, uint256 minQuantity, uint256 lotSize))",
]);
const gridCache = new Map<string, { tick: bigint; minQty: bigint; lot: bigint }>();
/** Every pool declares its own book grid; off-grid orders revert InvalidQuantity/InvalidPrice. */
async function poolGrid(pool: Address) {
  const hit = gridCache.get(pool);
  if (hit) return hit;
  const p = await pub.readContract({ address: pool, abi: poolParamsAbi, functionName: "getOrderBookParameters" });
  const g = { tick: p.tickSize, minQty: p.minQuantity, lot: p.lotSize };
  gridCache.set(pool, g);
  return g;
}

if (!VAULT || !process.env.PRIVATE_KEY) throw new Error("VAULT_ADDRESS and PRIVATE_KEY required");

const vaultAbi = parseAbi([
  "struct Run { address owner; uint8 state; uint8 legIndex; uint8[] directions; uint256[] maxPrice; bytes32[] seriesTags; uint256 balance; bytes32 marketId; address pool; uint256 outcomeIdHeld; uint64 marketExpiry; bytes32 legTag; }",
  "function nextRunId() view returns (uint256)",
  "function getRun(uint256) view returns (Run)",
  "function executeLeg(uint256 runId, bytes32 marketId, uint256 priceYes, uint256 quantity)",
  "function settleLeg(uint256 runId)",
]);

const chain = defineChain({
  id: 50312,
  name: "somnia-testnet",
  nativeCurrency: { name: "STT", symbol: "STT", decimals: 18 },
  rpcUrls: { default: { http: [RPC], webSocket: ["wss://api.infra.testnet.somnia.network/ws"] } },
});
const account = privateKeyToAccount(process.env.PRIVATE_KEY as Hex);
const pub = createPublicClient({ chain, transport: http(RPC) });
const wallet = createWalletClient({ chain, transport: http(RPC), account });
const ex = new SomniaMarkets({
  indexerUrl: process.env.INDEXER_URL ?? "https://dev.smk.somnia.host/v1/graphql",
  chain,
  wsRpcUrl: "wss://api.infra.testnet.somnia.network/ws",
  addresses: SOMNIA_TESTNET_ADDRESSES,
});

const log = (s: string) => console.log(`${new Date().toISOString()} ${s}`);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const parseTag = (tag: Hex): { asset: string; interval: number } => {
  const txt = Buffer.from(tag.slice(2), "hex").toString("utf8").replace(/\0+$/, "");
  const [asset, interval] = txt.split(":");
  return { asset: asset.toUpperCase(), interval: Number(interval) };
};

/** Simulate first: a keeper must never spray reverting transactions. */
async function callVault(fn: "executeLeg" | "settleLeg", args: readonly unknown[]): Promise<boolean> {
  try {
    const { request } = await pub.simulateContract({
      address: VAULT,
      abi: vaultAbi,
      functionName: fn,
      args: args as never,
      account,
    });
    const hash = await wallet.writeContract(request);
    const receipt = await pub.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") {
      log(`${fn} reverted post-simulation (tx ${hash})`);
      return false;
    }
    log(`${fn}(${String(args[0])}) ok — tx ${hash}`);
    return true;
  } catch (e) {
    log(`${fn}(${String(args[0])}) skipped: ${(e as Error).message.split("\n").slice(0, 4).join(" | ").slice(0, 300)}`);
    return false;
  }
}

async function driveOpenRun(runId: bigint, run: { legIndex: number; directions: readonly number[]; maxPrice: readonly bigint[]; seriesTags: readonly Hex[]; balance: bigint }) {
  const { asset, interval } = parseTag(run.seriesTags[run.legIndex]);
  const dir = run.directions[run.legIndex]; // 0 = UP (BUY_YES), 1 = DOWN (BUY_NO)

  const all = Object.values(await ex.loadMarkets(true)).filter(
    (m) =>
      m.type === "binary" &&
      m.active &&
      m.info.marketType === "BINARY" &&
      m.info.asset === asset &&
      // The venue's actual intervalSec can drift a little (a 900s series has
      // shipped windows reporting 898) — match the bucket, not the exact value.
      Math.abs(Number(m.info.intervalSec) - interval) <= Math.max(2, interval * 0.01),
  );
  for (const m of all) {
    const oc = await ex.client.getMarketOnchain(m.info.marketId as Hex);
    if (!oc || oc.status !== 1) continue;
    const left = Number(oc.expiry) - Date.now() / 1000;
    if (left < Math.max(20, interval * 0.25)) continue; // too close to lock

    const ob = await ex.fetchOrderBook(m.symbol, 3).catch(() => null);
    if (!ob) continue;

    // Own-outcome cost cap with slippage; convert to the book's YES terms.
    let ownPrice: number;
    if (dir === 0) {
      if (!ob.asks.length) continue;
      ownPrice = ob.asks[0][0] + SLIPPAGE;
    } else {
      if (!ob.bids.length) continue;
      ownPrice = 1 - ob.bids[0][0] + SLIPPAGE; // NO ask = 1 − YES bid
    }
    ownPrice = Math.min(ownPrice, 0.99);
    const cap = Number(run.maxPrice[run.legIndex]) / Number(ONE);
    if (ownPrice > cap) {
      log(`run ${runId} leg ${run.legIndex}: price ${ownPrice.toFixed(3)} over cap ${cap} — waiting`);
      return;
    }

    const grid = await poolGrid(oc.pool as Address);
    // Snap the cap UP to the tick grid (still a cap), quantity DOWN to the lot grid.
    let ownRaw = BigInt(Math.round(ownPrice * 1e6));
    ownRaw = ((ownRaw + grid.tick - 1n) / grid.tick) * grid.tick;
    if (ownRaw >= ONE) ownRaw = ONE - grid.tick;
    const priceYes = dir === 0 ? ownRaw : ONE - ownRaw;
    const qty = ((run.balance * ONE * 98n) / (ownRaw * 100n) / grid.lot) * grid.lot;
    if (qty < grid.minQty) return;

    log(`run ${runId} leg ${run.legIndex}: ${dir === 0 ? "UP" : "DOWN"} ${m.symbol} qty=${Number(qty) / 1e6} cap(own)=${ownPrice.toFixed(3)}`);
    await callVault("executeLeg", [runId, m.info.marketId, priceYes, qty]);
    return;
  }
  log(`run ${runId} leg ${run.legIndex}: no tradable ${asset}:${interval} window right now`);
}

async function main() {
  log(`keeper ${account.address} driving vault ${VAULT}`);
  for (;;) {
    try {
      const n = (await pub.readContract({ address: VAULT, abi: vaultAbi, functionName: "nextRunId" })) as bigint;
      for (let id = 0n; id < n; id++) {
        const r = (await pub.readContract({ address: VAULT, abi: vaultAbi, functionName: "getRun", args: [id] })) as never as {
          state: number; legIndex: number; directions: readonly number[]; maxPrice: readonly bigint[];
          seriesTags: readonly Hex[]; balance: bigint; marketId: Hex;
        };
        if (r.state === 0 && r.balance > 0n) {
          await driveOpenRun(id, r);
        } else if (r.state === 1) {
          const oc = await ex.client.getMarketOnchain(r.marketId);
          if (oc && (oc.isResolved || oc.isVoided)) await callVault("settleLeg", [id]);
        }
      }
    } catch (e) {
      log(`loop error: ${(e as Error).message.split("\n").slice(0, 4).join(" | ").slice(0, 300)}`);
    }
    await sleep(POLL_MS);
  }
}

main();

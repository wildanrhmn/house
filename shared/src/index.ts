// Streakline deployment constants and shared types (Somnia Shannon testnet).

export const CHAIN_ID = 50312;
export const RPC_URL = "https://api.infra.testnet.somnia.network";
export const WS_RPC_URL = "wss://api.infra.testnet.somnia.network/ws";
export const INDEXER_URL = "https://dev.smk.somnia.host/v1/graphql";
export const EXPLORER_URL = "https://shannon-explorer.somnia.network";

export const VAULT_ADDRESS = "0xafe758C008e62D7235452563B9eEf708ceeE60eE" as const;
export const TUSDC_ADDRESS = "0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E" as const;
export const COLLATERAL_DECIMALS = 6;

// Venues on Shannon: fast (60s/300s windows) and DreamDEX (15m/1h).
export const VENUE_FAST = "0x1a1e6821cde7d0159c0d293177871e09677b4e42307c7db3ba94f8648a5a050f" as const;
export const VENUE_DREAMDEX = "0x679795a0195a1b76cdebb7c51d74e058aee92919b8c3389af86ef24535e8a28c" as const;

export const DIRECTION = { UP: 0, DOWN: 1 } as const;
export const RUN_STATE = { Open: 0, PositionHeld: 1, Ended: 2, Cancelled: 3 } as const;

/** Series a leg can target: asset + window length in seconds. */
export interface Series {
  asset: "BTC" | "ETH";
  intervalSec: number;
  label: string;
}
export const SERIES: Series[] = [
  { asset: "BTC", intervalSec: 60, label: "BTC · 1 min" },
  { asset: "ETH", intervalSec: 60, label: "ETH · 1 min" },
  { asset: "BTC", intervalSec: 300, label: "BTC · 5 min" },
  { asset: "ETH", intervalSec: 300, label: "ETH · 5 min" },
  { asset: "BTC", intervalSec: 900, label: "BTC · 15 min" },
  { asset: "ETH", intervalSec: 900, label: "ETH · 15 min" },
  { asset: "BTC", intervalSec: 3600, label: "BTC · 1 hour" },
  { asset: "ETH", intervalSec: 3600, label: "ETH · 1 hour" },
];

export const seriesTag = (s: Pick<Series, "asset" | "intervalSec">) => `${s.asset}:${s.intervalSec}`;

export const streakVaultAbi = [
  "struct Run { address owner; uint8 state; uint8 legIndex; uint8[] directions; uint256[] maxPrice; bytes32[] seriesTags; uint256 balance; bytes32 marketId; address pool; uint256 outcomeIdHeld; uint64 marketExpiry; bytes32 legTag; }",
  "function nextRunId() view returns (uint256)",
  "function getRun(uint256) view returns (Run)",
  "function createRun(uint8[] directions, uint256[] maxPrice, bytes32[] seriesTags, uint256 stake) returns (uint256)",
  "function cancelRun(uint256 runId)",
  "function claim(uint256 runId)",
  "function executeLeg(uint256 runId, bytes32 marketId, uint256 priceYes, uint256 quantity)",
  "function settleLeg(uint256 runId)",
  "event RunCreated(uint256 indexed runId, address indexed owner, uint8 legs, uint256 stake, bytes32[] seriesTags)",
  "event LegExecuted(uint256 indexed runId, uint8 indexed legIndex, bytes32 marketId, uint256 filled, uint256 cost, bytes32 legTag)",
  "event LegSettled(uint256 indexed runId, uint8 indexed legIndex, bool won, bool voided, uint256 proceeds)",
  "event RunEnded(uint256 indexed runId, bool won, uint256 finalBalance)",
  "event RunCancelled(uint256 indexed runId, uint256 refunded)",
  "event Claimed(uint256 indexed runId, address to, uint256 amount)",
] as const;

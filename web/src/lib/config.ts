import type { Address } from "viem";
import {
  SOMNIA_TESTNET_ADDRESSES,
  SOMNIA_TESTNET_PRICE_FEED,
} from "@somnia-chain/markets-sdk";
import { somniaShannon } from "@somnia-chain/markets-sdk/chains";

export const INDEXER_URL = "https://dev.smk.somnia.host/v1/graphql";
export const WS_RPC_URL = "wss://api.infra.testnet.somnia.network/ws";
export const HTTP_RPC_URL = "https://dream-rpc.somnia.network";

export const CHAIN = somniaShannon;
export const ADDRESSES = SOMNIA_TESTNET_ADDRESSES;
export const PRICE_FEED = SOMNIA_TESTNET_PRICE_FEED;

export const DREAMDEX_VENUE =
  "0x679795a0195a1b76cdebb7c51d74e058aee92919b8c3389af86ef24535e8a28c" as const;

export const PREFERRED_INTERVAL_SEC = 900;
export const PREFERRED_ASSET = "BTC";
export const DEFAULT_HALF_SPREAD = 0.02;
export const DEFAULT_QUOTE_SIZE = 5;
// The last fifth of a window swings hard as the outcome settles. Do not quote
// into it. Capped at 15 minutes so a day window is not idle for hours.
export const HEADROOM_FRACTION = 0.2;
export const MIN_HEADROOM_SEC = 20;
export const MAX_HEADROOM_SEC = 900;

export const MARKET_ASSETS = ["BTC", "ETH"] as const;
export const MARKET_INTERVALS = [300, 900, 3600, 14400, 86400] as const;

export type Market = { key: string; asset: string; intervalSec: number; label: string };

export function intervalLabel(sec: number): string {
  if (sec % 86400 === 0) return `${sec / 86400}d`;
  if (sec % 3600 === 0) return `${sec / 3600}h`;
  if (sec % 60 === 0) return `${sec / 60}m`;
  return `${sec}s`;
}

export function intervalWords(sec: number): string {
  const unit = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
  if (sec % 86400 === 0) return unit(sec / 86400, "day");
  if (sec % 3600 === 0) return unit(sec / 3600, "hour");
  return unit(Math.round(sec / 60), "minute");
}

export const MARKETS: Market[] = MARKET_ASSETS.flatMap((asset) =>
  MARKET_INTERVALS.map((intervalSec) => ({
    key: `${asset.toLowerCase()}-${intervalLabel(intervalSec)}`,
    asset,
    intervalSec,
    label: `${asset} ${intervalLabel(intervalSec)}`,
  })),
);

export const DEFAULT_MARKET =
  MARKETS.find((m) => m.asset === PREFERRED_ASSET && m.intervalSec === PREFERRED_INTERVAL_SEC) ?? MARKETS[0];

export function marketFromKey(key: string | null | undefined): Market {
  const k = (key ?? "").trim().toLowerCase();
  return MARKETS.find((m) => m.key === k) ?? DEFAULT_MARKET;
}

export const TUSDC = (ADDRESSES.testUsdc ?? ADDRESSES.collateral) as Address;

export function readExchangeConfig() {
  return {
    indexerUrl: INDEXER_URL,
    chain: CHAIN,
    wsRpcUrl: WS_RPC_URL,
    addresses: ADDRESSES,
    priceFeed: PRICE_FEED,
  };
}

export function minLeftSec(intervalSec: number): number {
  return Math.max(MIN_HEADROOM_SEC, Math.min(MAX_HEADROOM_SEC, Math.floor(intervalSec * HEADROOM_FRACTION)));
}

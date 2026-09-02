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
// The last fifth of a window swings hard as the outcome settles. Do not quote into it.
export const HEADROOM_FRACTION = 0.2;
export const MIN_HEADROOM_SEC = 20;

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
  return Math.max(MIN_HEADROOM_SEC, Math.floor(intervalSec * HEADROOM_FRACTION));
}

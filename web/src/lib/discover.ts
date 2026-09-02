import type { SomniaMarkets } from "@somnia-chain/markets-sdk";
import type { Address } from "viem";
import { DREAMDEX_VENUE, PREFERRED_ASSET, PREFERRED_INTERVAL_SEC, minLeftSec } from "./config";

export type HouseWindow = {
  marketId: `0x${string}`;
  pool: Address;
  asset: string;
  intervalSec: number;
  expiry: number;
  yesSymbol: string;
  noSymbol: string;
  quoteDecimals: number;
};

export async function discoverWindow(
  exchange: SomniaMarkets,
  asset = PREFERRED_ASSET,
  intervalSec = PREFERRED_INTERVAL_SEC,
): Promise<HouseWindow | null> {
  // Server-side intervalSec is a band. Do not exact-match 900; rolls index as 898/899.
  const rows = await exchange.client.listLiveBinaryMarkets({
    venueId: DREAMDEX_VENUE,
    asset,
    intervalSec,
    limit: 20,
  });

  // Indexer is enough to arm the desk. getMarketOnchain can hang behind the
  // browser WS client; writes still gate on status 1 inside planQuotes.
  let fallback: HouseWindow | null = null;
  for (const row of rows) {
    const id = row.marketId as `0x${string}`;
    if (!id || !row.poolAddress) continue;

    const expiry = Number(row.expiry ?? 0);
    const live: HouseWindow = {
      marketId: id,
      pool: row.poolAddress,
      asset: (row.asset || asset).toUpperCase(),
      intervalSec: Number(row.intervalSec ?? intervalSec) || intervalSec,
      expiry,
      yesSymbol: `${id}#YES`,
      noSymbol: `${id}#NO`,
      quoteDecimals: row.quoteDecimals ?? 6,
    };

    if (row.status && row.status !== "Trading") continue;
    if (expiry - Date.now() / 1000 < minLeftSec(intervalSec)) {
      fallback ??= live;
      continue;
    }
    return live;
  }

  return fallback;
}

export async function openingPrice(
  exchange: SomniaMarkets,
  marketId: `0x${string}`,
): Promise<number | null> {
  try {
    const map = await exchange.client.getOpeningPrices([marketId]);
    const raw = map[marketId.toLowerCase()] ?? map[marketId];
    if (raw == null) return null;
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    // OracleHub numericValue is 2 decimal places with no scale field.
    return n / 100;
  } catch {
    return null;
  }
}

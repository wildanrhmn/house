import {
  ORDER_TYPE,
  fromHuman,
  toHuman,
  probabilityToPrice,
  type PlaceOrderResult,
  type SomniaMarkets,
} from "@somnia-chain/markets-sdk";
import type { Address } from "viem";
import { DREAMDEX_VENUE, DEFAULT_HALF_SPREAD, DEFAULT_QUOTE_SIZE, minLeftSec } from "./config";
import type { HouseWindow } from "./discover";
import { expireNs, fairYes, snapLot, snapTick, twoSidedLevels } from "./quoting";

function reverted(err: unknown): boolean {
  const text = err instanceof Error ? err.message : String(err);
  return text.includes("PostOnlyWouldCross") || text.includes("post-only");
}

function receiptOk(info: unknown): boolean {
  const receipt = (info as PlaceOrderResult | undefined)?.receipt;
  if (!receipt) return true;
  return receipt.status === "success";
}

export type QuotePlan = {
  bidYes: number;
  askYes: number;
  size: number;
  fair: number;
};

export async function planQuotes(
  exchange: SomniaMarkets,
  window: HouseWindow,
  halfSpread = DEFAULT_HALF_SPREAD,
  size = DEFAULT_QUOTE_SIZE,
): Promise<QuotePlan | null> {
  const onchain = await exchange.client.getMarketOnchain(window.marketId);
  if (onchain.status !== 1) return null;
  if (Number(onchain.expiry) - Date.now() / 1000 < minLeftSec(window.intervalSec)) return null;

  const book = await exchange.client.getBinaryOrderBook(window.pool, {
    depth: 5,
    decimals: window.quoteDecimals,
  });
  const bid = book.yesBids[0]
    ? Number(toHuman(book.yesBids[0].price, window.quoteDecimals))
    : undefined;
  const ask = book.yesAsks[0]
    ? Number(toHuman(book.yesAsks[0].price, window.quoteDecimals))
    : undefined;
  const fair = fairYes(bid, ask);
  const { bidYes, askYes } = twoSidedLevels(fair, halfSpread);
  if (bidYes >= askYes) return null;
  return { bidYes, askYes, size, fair };
}

export async function cancelOwn(
  exchange: SomniaMarkets,
  window: HouseWindow,
): Promise<number> {
  const me = exchange.walletAddress;
  if (!me) return 0;
  const open = await exchange.client.getOpenOrders(me, { pool: window.pool, limit: 50 });
  let n = 0;
  for (const o of open) {
    try {
      await exchange.trader.cancelOrder({ pool: window.pool, orderId: o.orderId });
      n += 1;
    } catch (err) {
      console.warn("cancel failed", o.orderId, err);
    }
  }
  return n;
}

export async function quoteBothSides(
  exchange: SomniaMarkets,
  window: HouseWindow,
  plan: QuotePlan,
): Promise<{ upId?: string; downId?: string; skipped: string[] }> {
  const skipped: string[] = [];
  const params = await exchange.client.getBinaryBookParams(window.pool);
  const decimals = window.quoteDecimals;
  const qty = snapLot(fromHuman(plan.size, decimals), params.lotSize);
  if (qty === 0n) {
    skipped.push("size below one lot");
    return { skipped };
  }

  const bidRaw = snapTick(probabilityToPrice(plan.bidYes, decimals), params.tickSize);
  const askRaw = snapTick(probabilityToPrice(plan.askYes, decimals), params.tickSize);
  if (bidRaw <= 0n || askRaw <= 0n || bidRaw >= askRaw) {
    skipped.push("prices collapsed onto one tick");
    return { skipped };
  }

  const onchain = await exchange.client.getMarketOnchain(window.marketId);
  const hold = Math.min(90, Math.max(25, Math.floor(window.intervalSec * 0.1)));
  const expiry = expireNs(Number(onchain.expiry), hold);
  const pool = window.pool as Address;

  let upId: string | undefined;
  let downId: string | undefined;

  try {
    const up = await exchange.trader.placeOrder({
      pool,
      side: "BUY_YES",
      price: bidRaw,
      quantity: qty,
      orderType: ORDER_TYPE.POST_ONLY,
      expireTimestampNs: expiry,
    });
    if (!receiptOk(up)) skipped.push("Up quote reverted");
    else upId = up.orderId?.toString();
  } catch (err) {
    if (reverted(err)) skipped.push("Up would cross");
    else throw err;
  }

  try {
    const down = await exchange.trader.placeOrder({
      pool,
      side: "BUY_NO",
      // BUY_NO price is YES terms: this is the implied Up ask, not a Down probability.
      price: askRaw,
      quantity: qty,
      orderType: ORDER_TYPE.POST_ONLY,
      expireTimestampNs: expiry,
    });
    if (!receiptOk(down)) skipped.push("Down quote reverted");
    else downId = down.orderId?.toString();
  } catch (err) {
    if (reverted(err)) skipped.push("Down would cross");
    else throw err;
  }

  return { upId, downId, skipped };
}

export async function flattenInventory(
  exchange: SomniaMarkets,
  window: HouseWindow,
): Promise<void> {
  await cancelOwn(exchange, window);
  const me = exchange.walletAddress;
  if (!me) return;
  const oc = await exchange.client.getMarketOnchain(window.marketId);
  const [up, down] = await Promise.all([
    exchange.client.getOutcomeBalance(oc.outcomeToken, me, oc.yesId),
    exchange.client.getOutcomeBalance(oc.outcomeToken, me, oc.noId),
  ]);
  const params = await exchange.client.getBinaryBookParams(window.pool);
  const pool = window.pool as Address;
  const expiry = expireNs(Number(oc.expiry), 30);

  if (up >= params.minQuantity) {
    const qty = snapLot(up, params.lotSize);
    if (qty > 0n) {
      await exchange.trader.placeOrder({
        pool,
        side: "SELL_YES",
        price: params.tickSize,
        quantity: qty,
        orderType: ORDER_TYPE.MARKET,
        expireTimestampNs: expiry,
      });
    }
  }
  if (down >= params.minQuantity) {
    const qty = snapLot(down, params.lotSize);
    if (qty > 0n) {
      await exchange.trader.placeOrder({
        pool,
        side: "SELL_NO",
        price: probabilityToPrice(0.99, window.quoteDecimals),
        quantity: qty,
        orderType: ORDER_TYPE.MARKET,
        expireTimestampNs: expiry,
      });
    }
  }
}

export async function redeemSettled(exchange: SomniaMarkets): Promise<number> {
  const me = exchange.walletAddress;
  if (!me) return 0;
  const settled = await exchange.client.listBinaryMarkets({
    venueId: DREAMDEX_VENUE,
    status: "Finalized",
    limit: 40,
  });
  let n = 0;
  for (const row of settled) {
    const marketId = row.marketId as `0x${string}`;
    const oc = await exchange.client.getMarketOnchain(marketId);
    if (!oc.isResolved && !oc.isVoided) continue;
    const held = {
      0: await exchange.client.getOutcomeBalance(oc.outcomeToken, me, oc.yesId),
      1: await exchange.client.getOutcomeBalance(oc.outcomeToken, me, oc.noId),
    } as const;
    const idxs: Array<0 | 1> = oc.isVoided ? [0, 1] : [oc.winningOutcome === 0 ? 0 : 1];
    for (const outcomeIdx of idxs) {
      if (held[outcomeIdx] === 0n) continue;
      const res = await exchange.trader.redeem({
        marketId,
        market: oc.marketAddress,
        outcomeToken: oc.outcomeToken,
        outcomeIdx,
        amount: held[outcomeIdx],
      });
      if (res.receipt?.status === "reverted") continue;
      n += 1;
    }
  }
  return n;
}

export async function readInventory(exchange: SomniaMarkets, window: HouseWindow) {
  const me = exchange.walletAddress;
  if (!me) return { up: 0n, down: 0n };
  const oc = await exchange.client.getMarketOnchain(window.marketId);
  const [up, down] = await Promise.all([
    exchange.client.getOutcomeBalance(oc.outcomeToken, me, oc.yesId),
    exchange.client.getOutcomeBalance(oc.outcomeToken, me, oc.noId),
  ]);
  return { up, down };
}

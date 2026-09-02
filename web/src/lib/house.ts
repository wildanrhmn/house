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

type Onchain = Awaited<ReturnType<SomniaMarkets["client"]["getMarketOnchain"]>>;

function reverted(err: unknown): boolean {
  const text = err instanceof Error ? err.message : String(err);
  return text.includes("PostOnlyWouldCross") || text.includes("post-only");
}

function receiptOk(info: unknown): boolean {
  const receipt = (info as PlaceOrderResult | undefined)?.receipt;
  if (!receipt) return true;
  return receipt.status === "success";
}

async function outcomeBalances(exchange: SomniaMarkets, oc: Onchain, account: Address) {
  const [up, down] = await Promise.all([
    exchange.client.getOutcomeBalance({ outcomeToken: oc.outcomeToken, account, id: oc.yesId }),
    exchange.client.getOutcomeBalance({ outcomeToken: oc.outcomeToken, account, id: oc.noId }),
  ]);
  return { up, down };
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

  // Sit one tick inside a wider market so HOUSE is top of book on both sides,
  // but never thinner than two ticks. halfSpread is the ceiling, not the target.
  let half = halfSpread;
  if (bid !== undefined && ask !== undefined) {
    const params = await exchange.client.getBinaryBookParams(window.pool);
    const tick = Number(toHuman(params.tickSize, window.quoteDecimals));
    half = Math.max(2 * tick, Math.min(halfSpread, (ask - bid) / 2 - tick));
  }
  const { bidYes, askYes } = twoSidedLevels(fair, half);
  if (bidYes >= askYes) return null;
  return { bidYes, askYes, size, fair };
}

export async function cancelOwn(
  exchange: SomniaMarkets,
  window: HouseWindow,
): Promise<number> {
  const me = exchange.walletAddress as Address | undefined;
  if (!me) return 0;
  // Chain head, not the indexer: a quote placed seconds ago must be cancellable.
  const ids = await exchange.client.getOwnOpenOrdersOnchain(window.pool as Address, me);
  let n = 0;
  for (const id of ids) {
    try {
      await exchange.trader.cancelOrder({ pool: window.pool, orderId: id.toString() });
      n += 1;
    } catch (err) {
      console.warn("cancel failed", id.toString(), err);
    }
  }
  return n;
}

export type Resting = { orderId: bigint; isBid: boolean; price: bigint; quantity: bigint };

// An owner's resting quotes read at chain head. BUY_YES rests as a bid and
// BUY_NO as an ask on the YES book, so the lower price is the bid.
export async function restingQuotes(exchange: SomniaMarkets, pool: Address, owner: Address) {
  const ids = await exchange.client.getOwnOpenOrdersOnchain(pool, owner);
  const orders: Resting[] = [];
  for (const id of ids) {
    const o = await exchange.client.getOrderOnchain(pool, id);
    if (!o || o.quantityRemaining === 0n) continue;
    orders.push({ orderId: id, isBid: o.isBid, price: o.price, quantity: o.quantityRemaining });
  }
  orders.sort((a, b) => (a.price < b.price ? -1 : a.price > b.price ? 1 : 0));
  const bid = orders.length ? orders[0] : undefined;
  const ask = orders.length > 1 ? orders[orders.length - 1] : undefined;
  return { orders, bid, ask };
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
  // Resting quotes die on their own after this long. The loop replaces them
  // sooner; the desk and demo rely on Flatten or the next requote.
  const hold = Math.min(300, Math.max(60, Math.floor(window.intervalSec * 0.3)));
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

export type QuoteOutcome = { plan: QuotePlan | null; upId?: string; downId?: string; skipped: string[] };

// A side that would cross means the book moved between plan and placement.
// Start over from a fresh book rather than leave one side resting alone.
export async function quoteWithRetry(
  exchange: SomniaMarkets,
  window: HouseWindow,
  halfSpread = DEFAULT_HALF_SPREAD,
  size = DEFAULT_QUOTE_SIZE,
  attempts = 3,
): Promise<QuoteOutcome> {
  let out: QuoteOutcome = { plan: null, skipped: [] };
  for (let i = 0; i < attempts; i++) {
    const plan = await planQuotes(exchange, window, halfSpread, size);
    if (!plan) break;
    const r = await quoteBothSides(exchange, window, plan);
    out = { plan, ...r };
    if (!r.skipped.some((s) => s.includes("would cross"))) break;
    await cancelOwn(exchange, window);
  }
  return out;
}

// A filled two-sided quote leaves equal YES and NO. Burning that pair returns
// 1.00 of collateral per set, which is where the spread is realized.
export async function mergeSets(
  exchange: SomniaMarkets,
  window: HouseWindow,
): Promise<{ amount: bigint; hash?: string }> {
  const me = exchange.walletAddress;
  if (!me) return { amount: 0n };
  const oc = await exchange.client.getMarketOnchain(window.marketId);
  const { up, down } = await outcomeBalances(exchange, oc, me);
  const amount = up < down ? up : down;
  if (amount === 0n) return { amount: 0n };
  const res = await exchange.trader.burnSet({
    pool: window.pool as Address,
    amount,
    outcomeToken: oc.outcomeToken,
  });
  if (res.receipt?.status === "reverted") throw new Error("Merge reverted");
  return { amount, hash: res.receipt?.transactionHash };
}

export type FlattenResult = { merged: bigint; mergeTx?: string; soldUp: bigint; soldDown: bigint };

export async function flattenInventory(
  exchange: SomniaMarkets,
  window: HouseWindow,
): Promise<FlattenResult> {
  const out: FlattenResult = { merged: 0n, soldUp: 0n, soldDown: 0n };
  await cancelOwn(exchange, window);
  const me = exchange.walletAddress;
  if (!me) return out;

  const merge = await mergeSets(exchange, window);
  out.merged = merge.amount;
  out.mergeTx = merge.hash;

  const oc = await exchange.client.getMarketOnchain(window.marketId);
  const { up, down } = await outcomeBalances(exchange, oc, me);
  const params = await exchange.client.getBinaryBookParams(window.pool);
  const pool = window.pool as Address;
  const expiry = expireNs(Number(oc.expiry), 30);

  // SDK writes resolve even when the pool reverts, so count a sale only on success.
  const sell = async (side: "SELL_YES" | "SELL_NO", price: bigint, qty: bigint) => {
    try {
      const r = await exchange.trader.placeOrder({
        pool,
        side,
        price,
        quantity: qty,
        orderType: ORDER_TYPE.MARKET,
        expireTimestampNs: expiry,
      });
      return receiptOk(r) ? qty : 0n;
    } catch {
      return 0n;
    }
  };
  if (up >= params.minQuantity) {
    const qty = snapLot(up, params.lotSize);
    if (qty > 0n) out.soldUp = await sell("SELL_YES", params.tickSize, qty);
  }
  if (down >= params.minQuantity) {
    const qty = snapLot(down, params.lotSize);
    if (qty > 0n) out.soldDown = await sell("SELL_NO", probabilityToPrice(0.99, window.quoteDecimals), qty);
  }
  return out;
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
    const { up, down } = await outcomeBalances(exchange, oc, me);
    const held = { 0: up, 1: down } as const;
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
  return outcomeBalances(exchange, oc, me);
}

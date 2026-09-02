export function snapTick(raw: bigint, tick: bigint): bigint {
  if (tick <= 0n) return raw;
  return (raw / tick) * tick;
}

export function snapLot(raw: bigint, lot: bigint): bigint {
  if (lot <= 0n) return raw;
  return (raw / lot) * lot;
}

export function clampProb(p: number): number {
  if (p < 0.02) return 0.02;
  if (p > 0.98) return 0.98;
  return p;
}

export function fairYes(bestBid?: number, bestAsk?: number): number {
  if (bestBid !== undefined && bestAsk !== undefined) return (bestBid + bestAsk) / 2;
  return bestBid ?? bestAsk ?? 0.5;
}

export function twoSidedLevels(fair: number, halfSpread: number) {
  const bidYes = clampProb(fair - halfSpread);
  const askYes = clampProb(fair + halfSpread);
  return { bidYes, askYes };
}

export function expireNs(marketExpirySec: number, holdSec: number): bigint {
  // SDK requires nanoseconds. 0 reverts. Cap just before market expiry.
  const cap = Math.floor(marketExpirySec) - 2;
  const want = Math.floor(Date.now() / 1000) + holdSec;
  const unix = Math.max(Math.floor(Date.now() / 1000) + 15, Math.min(want, cap));
  return BigInt(unix) * 1_000_000_000n;
}

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { marketFromKey, type Market } from "../../web/src/lib/config.ts";

// HOUSE_MARKET=eth-1h picks the market, same keys as /desk?m=. Default BTC 15m.
export function marketFromEnv(): Market {
  return marketFromKey(process.env.HOUSE_MARKET);
}

// One key from the repo root .env. The value is returned, never logged.
export function keyFromEnv(name: string): `0x${string}` {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../.env");
  const text = readFileSync(root, "utf8");
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    if (line.slice(0, eq).trim() !== name) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!value) break;
    if (!value.startsWith("0x")) value = `0x${value}`;
    return value as `0x${string}`;
  }
  throw new Error(`${name} missing from .env`);
}

export function envNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  const n = raw === undefined ? Number.NaN : Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export function short(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

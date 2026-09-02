import { SomniaMarkets } from "@somnia-chain/markets-sdk";
import type { WalletClient } from "viem";
import { readExchangeConfig } from "./config";

let readSingleton: SomniaMarkets | null = null;

export function getReadExchange() {
  readSingleton ??= new SomniaMarkets(readExchangeConfig());
  return readSingleton;
}

export function createReadExchange() {
  return getReadExchange();
}

export function createSignedExchange(opts: {
  privateKey?: `0x${string}`;
  walletClient?: WalletClient;
}) {
  return new SomniaMarkets({
    ...readExchangeConfig(),
    privateKey: opts.privateKey,
    walletClient: opts.walletClient,
  });
}

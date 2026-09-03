import { SomniaMarkets } from "@somnia-chain/markets-sdk";
import { createWalletClient, http, type WalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { CHAIN, HTTP_RPC_URL, readExchangeConfig } from "./config";

let readSingleton: SomniaMarkets | null = null;
const signers = new WeakMap<SomniaMarkets, WalletClient>();

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
  const exchange = new SomniaMarkets({
    ...readExchangeConfig(),
    privateKey: opts.privateKey,
    walletClient: opts.walletClient,
  });
  const wallet =
    opts.walletClient ??
    (opts.privateKey
      ? createWalletClient({
          account: privateKeyToAccount(opts.privateKey),
          chain: CHAIN,
          transport: http(HTTP_RPC_URL),
        })
      : undefined);
  if (wallet) signers.set(exchange, wallet);
  return exchange;
}

// The wallet behind a signed exchange, for the one write the SDK does not
// expose on its own: a collateral approval sent before anything is simulated.
export function signerFor(exchange: SomniaMarkets): WalletClient | undefined {
  return signers.get(exchange);
}

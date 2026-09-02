"use client";

import { SomniaMarketsProvider } from "@somnia-chain/markets-sdk/react";
import { useMemo, type ReactNode } from "react";
import { getReadExchange } from "@/lib/exchange";

export function SdkProvider({ children }: { children: ReactNode }) {
  const exchange = useMemo(() => getReadExchange(), []);
  return <SomniaMarketsProvider client={exchange.client}>{children}</SomniaMarketsProvider>;
}

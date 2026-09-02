"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { WagmiProvider, createConfig, http, injected } from "wagmi";
import { CHAIN, HTTP_RPC_URL } from "@/lib/config";
import { SdkProvider } from "./SdkProvider";

const wagmiConfig = createConfig({
  chains: [CHAIN],
  connectors: [injected()],
  transports: { [CHAIN.id]: http(HTTP_RPC_URL) },
  ssr: true,
});

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <SdkProvider>{children}</SdkProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

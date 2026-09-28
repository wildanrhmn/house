import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@somnia-chain/markets-sdk"],
  devIndicators: false,
};

export default nextConfig;

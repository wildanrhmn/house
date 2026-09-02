import type { Metadata } from "next";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "Desk",
  description: "Rest both sides of the live BTC window on DreamDEX and keep the spread.",
};

export default function DeskLayout({ children }: { children: React.ReactNode }) {
  return <Providers>{children}</Providers>;
}

import { Providers } from "@/components/Providers";

export default function DeskLayout({ children }: { children: React.ReactNode }) {
  return <Providers>{children}</Providers>;
}

import type { Metadata } from "next";
import { IBM_Plex_Mono, Syne } from "next/font/google";
import "./globals.css";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["600", "700", "800"],
});

const plex = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-data",
  weight: ["400", "500"],
});

// Accepts a bare host, which is how Vercel env values tend to be typed.
function siteUrl(): URL {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    process.env.VERCEL_URL ??
    "house-desk.vercel.app";
  try {
    return new URL(/^https?:\/\//.test(raw) ? raw : `https://${raw}`);
  } catch {
    return new URL("https://house-desk.vercel.app");
  }
}

const SITE = siteUrl();
const DESCRIPTION =
  "Quote both sides of a DreamDEX Event Contract from a normal wallet. Takers mint the pair. You keep the spread.";

export const metadata: Metadata = {
  metadataBase: SITE,
  title: { default: "HOUSE, be the book", template: "%s, HOUSE" },
  description: DESCRIPTION,
  applicationName: "HOUSE",
  openGraph: {
    type: "website",
    siteName: "HOUSE",
    title: "HOUSE, be the book",
    description: DESCRIPTION,
    url: SITE.origin,
  },
  twitter: {
    card: "summary",
    title: "HOUSE, be the book",
    description: DESCRIPTION,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${syne.variable} ${plex.variable}`}>{children}</body>
    </html>
  );
}

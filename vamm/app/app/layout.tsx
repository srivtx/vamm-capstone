import type { Metadata } from "next";
import "./globals.css";
import SmoothScroll from "./SmoothScroll";

export const metadata: Metadata = {
  title: "V-AMM — Volatility-Adaptive Market Maker",
  description:
    "An AMM that breathes with the market. StableSwap curve with EWMA-driven dynamic fees and amplification on Solana.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <SmoothScroll />
        {children}
      </body>
    </html>
  );
}

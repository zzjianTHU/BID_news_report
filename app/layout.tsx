import type { Metadata } from "next";
import { Space_Grotesk, Source_Serif_4 } from "next/font/google";

import "./globals.css";

const sans = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans"
});

const serif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-serif"
});

export const metadata: Metadata = {
  title: "清华 AI 情报自动站",
  description: "AI 驱动的情报抓取、处理、自动发布与 digest 分发 MVP。"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className={`${sans.variable} ${serif.variable}`}>{children}</body>
    </html>
  );
}

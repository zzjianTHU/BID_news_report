import type { Metadata } from "next";
import { Inter } from "next/font/google";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans"
});

export const metadata: Metadata = {
  title: "清华 AI 情报自动站",
  description: "AI 驱动的情报抓取、处理、自动发布与 digest 分发 MVP。"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className={`${inter.variable} font-sans`}>
        {/* Main Content */}
        <div className="relative z-0">
          {children}
        </div>
      </body>
    </html>
  );
}

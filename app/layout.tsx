import type { Metadata } from "next";
import { Inter } from "next/font/google";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans"
});

export const metadata: Metadata = {
  title: "清华 AI 情报自动站",
  description: "聚焦模型、产品、基础设施与企业落地的 AI 情报阅读站。"
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

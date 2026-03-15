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
      <body className={`${sans.variable} ${serif.variable}`}>
        {/* Background Decorative Layer for Glassmorphism */}
        <div className="fixed inset-0 pointer-events-none -z-10 bg-grid-pattern opacity-[0.03]"></div>
        <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-orange-300/20 blur-[100px] pointer-events-none -z-10 mix-blend-multiply"></div>
        <div className="fixed bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-300/20 blur-[120px] pointer-events-none -z-10 mix-blend-multiply"></div>
        
        {/* Main Content */}
        <div className="relative z-0">
          {children}
        </div>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "智能面试评估系统",
  description: "基于多模态 Agent 的 AI 面试官",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen">
        {children}
      </body>
    </html>
  );
}

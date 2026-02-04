import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DeepQeeb - 对话式游戏开发平台",
  description: "通过 AI 对话创作和生成可玩的文字冒险游戏",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased font-sans">
        {children}
      </body>
    </html>
  );
}

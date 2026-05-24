import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "觅履 — AI简历优化平台",
  description: "AI驱动的简历深度优化，发现你的闪光点",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="dark">
      <body className="min-h-screen bg-surface text-text-primary antialiased">
        {children}
      </body>
    </html>
  );
}

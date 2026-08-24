import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ハッシン | 北多摩東部地区委員会 宣伝部",
  description: "党内ニュースを公開向け記事に編集支援するダッシュボード",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

# ハッシン（Hasshin）

宣伝部が使う社内向け編集支援ダッシュボード。
党内ニュース（PDF）を、Claude APIで構造化抽出・地域タグ付け・一般公開向けリライト・重複検出し、
北多摩東部／西東京／小平の各HP掲載用記事として編集・承認・書き出しするためのツール。

設計ドキュメント：

- [docs/DATA_MODEL.md](docs/DATA_MODEL.md) — テーブル設計と設計判断
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — リポジトリ構成・非同期処理・デプロイ方針

[Next.js](https://nextjs.org) + TypeScript + Tailwind CSS（[`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app) でブートストラップ）。

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

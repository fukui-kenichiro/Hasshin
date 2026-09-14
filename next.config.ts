import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @napi-rs/canvas はネイティブバイナリ（.node）を含むため、バンドルせず
  // 実行時にそのまま require させる（Turbopackがネイティブアドオンを
  // ESMチャンクに含められずビルドエラーになるため）。
  serverExternalPackages: ["@napi-rs/canvas", "pdfjs-dist"],

  // pdfjs-dist（legacy/build/pdf.mjs）は、Node実行時に自身のworkerモジュール
  // （pdf.worker.mjs）を `import(this.workerSrc)` という完全に動的な形で
  // 読み込む（webpackIgnore指定つき）。パス自体はpdf.mjsから見て
  // ./pdf.worker.mjs という解決可能な相対パスだが、引数が文字列リテラル
  // ではないためVercelのファイルトレース（@vercel/nft）が検出できず、
  // 本番のサーバーレス関数バンドルにworkerファイルが含まれずに
  // 「Cannot find module .../pdf.worker.mjs」で失敗していた（実機で確認）。
  // 該当ファイルを使うルートに対して明示的にトレース対象へ含める。
  outputFileTracingIncludes: {
    "/api/jobs/tick": ["./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"],
    "/api/cron/worker": ["./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"],
  },
};

export default nextConfig;

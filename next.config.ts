import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @napi-rs/canvas はネイティブバイナリ（.node）を含むため、バンドルせず
  // 実行時にそのまま require させる（Turbopackがネイティブアドオンを
  // ESMチャンクに含められずビルドエラーになるため）。
  serverExternalPackages: ["@napi-rs/canvas", "pdfjs-dist"],
};

export default nextConfig;

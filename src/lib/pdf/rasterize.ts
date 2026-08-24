import { createCanvas } from "@napi-rs/canvas";

// PDFの各ページをPNG画像に変換する。
//
// 【変更履歴】当初はローカル検証用に poppler の pdftoppm CLI を呼び出していたが、
// Vercelのサーバーレス関数にはpoppler等のネイティブCLIがインストールされておらず、
// そのままでは本番で動作しない（デプロイ前に判明・修正）。pdfjs-dist（Mozilla製、
// 純JS）+ @napi-rs/canvas（Linux x64向けのビルド済みバイナリを含み、追加のシステム
// 依存なしで動く）に置き換えた。実サンプルで出力画像の見た目が同等であることを
// 確認済み（scripts/test-pdfjs-render.ts）。

export interface RasterizedPage {
  pageNumber: number;
  pngBuffer: Buffer;
}

export async function rasterizePdfToPngPages(
  pdfBuffer: Buffer,
  dpi = 200
): Promise<RasterizedPage[]> {
  // legacy build はNode環境（DOM/Workerなし）向け。型定義が同梱されていないため any 経由で読み込む。
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfjsLib: any = await import("pdfjs-dist/legacy/build/pdf.mjs");

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(pdfBuffer),
    disableFontFace: true,
  });
  const pdf = await loadingTask.promise;

  const pages: RasterizedPage[] = [];
  const scale = dpi / 72;

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const ctx = canvas.getContext("2d");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await page.render({ canvasContext: ctx as any, viewport }).promise;
    pages.push({ pageNumber, pngBuffer: canvas.toBuffer("image/png") });
  }

  return pages;
}

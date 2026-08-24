import { getSupabaseServerClient, STORAGE_BUCKET } from "@/lib/supabase/server";

export async function uploadOriginalPdf(documentId: string, buffer: Buffer): Promise<string> {
  const path = `documents/${documentId}/original.pdf`;
  const { error } = await getSupabaseServerClient()
    .storage.from(STORAGE_BUCKET)
    .upload(path, buffer, { contentType: "application/pdf", upsert: true });
  if (error) throw new Error(`PDFの保存に失敗しました: ${error.message}`);
  return path;
}

export async function downloadFile(path: string): Promise<Buffer> {
  const { data, error } = await getSupabaseServerClient().storage.from(STORAGE_BUCKET).download(path);
  if (error) throw new Error(`ファイルの取得に失敗しました (${path}): ${error.message}`);
  return Buffer.from(await data.arrayBuffer());
}

export async function uploadPageImage(
  documentId: string,
  pageNumber: number,
  buffer: Buffer
): Promise<string> {
  const path = `documents/${documentId}/pages/${pageNumber}.png`;
  const { error } = await getSupabaseServerClient()
    .storage.from(STORAGE_BUCKET)
    .upload(path, buffer, { contentType: "image/png", upsert: true });
  if (error) throw new Error(`ページ画像の保存に失敗しました: ${error.message}`);
  return path;
}

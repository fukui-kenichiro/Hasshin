import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getCurrentUser } from "@/lib/auth/session";
import { createSourceDocument } from "@/lib/data/store";
import { uploadOriginalPdf } from "@/lib/storage/files";
import { enqueueInitialJob } from "@/lib/pipeline/jobs";
import type { SourceType } from "@/lib/types/domain";

export const maxDuration = 30;

// PDFを保存し、最初のジョブ（render_pages）を1件だけキューに積んで即座に
// 返す。実際の処理（ページ画像化・AI読み取り・記事化・リライト等）は
// /api/jobs/tick をクライアントが繰り返し呼ぶことで進む
// （docs/ARCHITECTURE.md、src/lib/pipeline/jobs.ts 参照）。
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  const sourceType = formData?.get("sourceType") as SourceType | null;

  if (!(file instanceof File) || !sourceType) {
    return NextResponse.json({ error: "file と sourceType が必要です" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const documentId = randomUUID();
  const storagePath = `documents/${documentId}/original.pdf`;

  await uploadOriginalPdf(documentId, buffer);

  const sourceDocument = await createSourceDocument({
    id: documentId,
    originalFilename: file.name,
    storagePath,
    sourceType,
    uploadedBy: user.id,
  });

  await enqueueInitialJob(sourceDocument.id);

  return NextResponse.json({ sourceDocumentId: sourceDocument.id });
}

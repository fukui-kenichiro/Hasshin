import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { processNextJob } from "@/lib/pipeline/jobs";
import { countPendingJobsForDocument, getSourceDocumentById, updateSourceDocument } from "@/lib/data/store";

export const maxDuration = 60;

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const documentId = body?.documentId as string | undefined;

  const result = await processNextJob();

  let remaining: number | null = null;
  if (documentId) {
    remaining = await countPendingJobsForDocument(documentId);
    if (remaining === 0) {
      const doc = await getSourceDocumentById(documentId);
      if (doc && doc.status === "processing") {
        await updateSourceDocument(documentId, { status: "done" });
      }
    }
  }

  return NextResponse.json({ ...result, remaining });
}

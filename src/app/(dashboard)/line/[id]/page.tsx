import { notFound } from "next/navigation";
import { getLineDraftById, getSetting } from "@/lib/data/store";
import { LINE_TEST_USER_KEY, getLineToken } from "@/lib/line/client";
import { LineDraftEditor } from "@/components/line/LineDraftEditor";

export default async function LineDraftPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const draft = await getLineDraftById(id);
  if (!draft) notFound();
  const [token, testUserId] = await Promise.all([getLineToken(), getSetting(LINE_TEST_USER_KEY)]);
  return <LineDraftEditor draft={draft} lineReady={!!token} hasTestUser={!!testUserId} />;
}

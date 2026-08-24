import { NextResponse } from "next/server";
import { processNextJob } from "@/lib/pipeline/jobs";

export const maxDuration = 60;

// Vercel Cron から定期的に呼ばれる。放置されたジョブ（アップロード画面を
// 閉じてしまった等）を掃除するセーフティネットと、Supabase Free プランの
// 7日間無操作スリープを防ぐ軽いヘルスチェックを兼ねる。
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const results = [];
  for (let i = 0; i < 5; i++) {
    const result = await processNextJob();
    if (!result.processed) break;
    results.push(result);
  }

  return NextResponse.json({ processedCount: results.length, results });
}

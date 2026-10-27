import { NextResponse } from "next/server";
import { deliverDueLineDrafts } from "@/lib/line/delivery";

export const maxDuration = 60;

// Supabase の pg_cron が毎分呼び出す。配信時刻を迎えたLINE配信の予約を実行する。
export async function POST(request: Request) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await deliverDueLineDrafts();
  return NextResponse.json(result);
}

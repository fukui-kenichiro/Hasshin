import { NextResponse } from "next/server";
import { verifyUserPassword } from "@/lib/data/store";
import { signIn } from "@/lib/auth/session";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = body?.email as string | undefined;
  const password = body?.password as string | undefined;

  if (!email || !password) {
    return NextResponse.json({ error: "メールアドレスとパスワードを入力してください" }, { status: 400 });
  }

  const user = await verifyUserPassword(email, password);
  if (!user) {
    return NextResponse.json({ error: "メールアドレスまたはパスワードが正しくありません" }, { status: 401 });
  }

  await signIn(user.id);
  return NextResponse.json({ ok: true });
}

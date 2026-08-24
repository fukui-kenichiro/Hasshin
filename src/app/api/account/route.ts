import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { updateUserCredentials, verifyUserPassword } from "@/lib/data/store";

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const currentPassword = body?.currentPassword as string | undefined;
  const newEmail = (body?.newEmail as string | undefined)?.trim();
  const newDisplayName = (body?.newDisplayName as string | undefined)?.trim();
  const newPassword = body?.newPassword as string | undefined;

  if (!currentPassword) {
    return NextResponse.json({ error: "現在のパスワードを入力してください" }, { status: 400 });
  }

  const verified = await verifyUserPassword(user.email, currentPassword);
  if (!verified) {
    return NextResponse.json({ error: "現在のパスワードが正しくありません" }, { status: 401 });
  }

  if (newPassword && newPassword.length < 8) {
    return NextResponse.json({ error: "新しいパスワードは8文字以上にしてください" }, { status: 400 });
  }

  const updated = await updateUserCredentials(user.id, {
    email: newEmail || undefined,
    displayName: newDisplayName || undefined,
    password: newPassword || undefined,
  });

  return NextResponse.json({ user: updated });
}

import { cookies } from "next/headers";
import { createSession, deleteSession, getSessionUser } from "@/lib/data/store";
import type { User } from "@/lib/types/domain";

const SESSION_COOKIE = "hasshin_session";

export async function getCurrentUser(): Promise<User | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  return getSessionUser(token);
}

export async function signIn(userId: string): Promise<void> {
  const token = await createSession(userId);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function signOut(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  await deleteSession(token);
  store.delete(SESSION_COOKIE);
}

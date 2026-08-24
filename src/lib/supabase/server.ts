import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// サーバー専用クライアント。service_role キーを使うため、RLSをすべて
// バイパスする（認可はこのアプリ自身のセッションCookieチェックで行う）。
// ブラウザに公開してはならない。
let client: SupabaseClient | null = null;

export function getSupabaseServerClient(): SupabaseClient {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error(
        "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が設定されていません。.env.local を確認してください。"
      );
    }
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

export const STORAGE_BUCKET = "hasshin";

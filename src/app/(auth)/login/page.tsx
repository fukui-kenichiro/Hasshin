"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "ログインに失敗しました");
        return;
      }
      router.push("/");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-hs-stone-50">
      <div className="w-[400px] rounded-[10px] border border-hs-stone-300 bg-white p-9 shadow-sm">
        <div className="mb-7 flex flex-col items-center gap-3.5">
          <svg width="44" height="44" viewBox="0 0 28 28" fill="none">
            <circle cx="14" cy="14" r="4" fill="var(--color-hs-primary)" />
            <path d="M9 9 A 8 8 0 0 0 9 19" stroke="var(--color-hs-primary)" strokeWidth="2" strokeLinecap="round" fill="none" />
            <path d="M19 9 A 8 8 0 0 1 19 19" stroke="var(--color-hs-primary)" strokeWidth="2" strokeLinecap="round" fill="none" />
            <path d="M5.5 5.5 A 13 13 0 0 0 5.5 22.5" stroke="var(--color-hs-stone-400)" strokeWidth="1.6" strokeLinecap="round" fill="none" />
            <path d="M22.5 5.5 A 13 13 0 0 1 22.5 22.5" stroke="var(--color-hs-stone-400)" strokeWidth="1.6" strokeLinecap="round" fill="none" />
          </svg>
          <div className="text-center leading-tight">
            <div className="text-[22px] font-bold text-hs-text">ハッシン</div>
            <div className="mt-0.5 text-[13px] text-hs-text-secondary">
              北多摩東部地区委員会 宣伝部 編集支援ツール
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-bold text-hs-text">メールアドレス</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="id@kitatama-tobu.example"
              className="rounded-md border border-hs-stone-300 px-3 py-2.5 text-[15px] text-hs-text outline-none focus:border-2 focus:border-hs-primary"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-bold text-hs-text">パスワード</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="rounded-md border border-hs-stone-300 px-3 py-2.5 text-[15px] text-hs-text outline-none focus:border-2 focus:border-hs-primary"
              required
            />
          </div>

          {error && <p className="text-[13px] text-hs-danger-text">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-1.5 rounded-md bg-hs-primary px-4 py-2.5 text-[15px] font-bold text-white hover:bg-hs-primary-dark disabled:opacity-60"
          >
            {loading ? "ログイン中..." : "ログイン"}
          </button>
        </form>

        <div className="mt-6 border-t border-hs-stone-100 pt-4.5 text-center">
          <span className="text-[12px] text-hs-stone-400">
            社内専用システムです。アカウントに関するお問い合わせはSNS対策部までご連絡ください。
          </span>
        </div>
      </div>
    </div>
  );
}

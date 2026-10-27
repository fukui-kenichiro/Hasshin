"use client";

import { useState } from "react";
import { FriendlyError } from "@/components/ui/FriendlyError";

export function LineSettingsForm({ hasToken: initialHasToken, testUserId: initialTestUserId }: { hasToken: boolean; testUserId: string }) {
  const [hasToken, setHasToken] = useState(initialHasToken);
  const [token, setToken] = useState("");
  const [testUserId, setTestUserId] = useState(initialTestUserId);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<{ message: string; details?: string } | null>(null);
  const [checkResult, setCheckResult] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    setCheckResult(null);
    try {
      const res = await fetch("/api/settings/line", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(token ? { channelAccessToken: token } : {}), testUserId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError({ message: data.error ?? "保存に失敗しました" });
        return;
      }
      if (token) {
        setHasToken(true);
        setToken("");
      }
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  async function handleCheck() {
    setChecking(true);
    setError(null);
    setCheckResult(null);
    try {
      const res = await fetch("/api/settings/line/check", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError({ message: data.error ?? "接続を確認できませんでした", details: data.details });
        return;
      }
      const quota = data.quotaLimit === null ? `今月の配信通数 ${data.quotaUsed}通（上限なし）` : `今月の配信通数 ${data.quotaUsed} / ${data.quotaLimit}通`;
      setCheckResult(`接続できました：${data.displayName}（${quota}）`);
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="flex max-w-xl flex-col gap-4 rounded-lg border border-hs-stone-300 bg-white p-5">
      <div className="flex items-center gap-2">
        <span className="text-[13px] font-bold text-hs-text">LINE公式アカウント</span>
        <span
          className={
            "rounded-full px-2 py-0.5 text-[11px] " +
            (hasToken ? "bg-hs-success-bg text-hs-success-text" : "bg-hs-stone-100 text-hs-text-secondary")
          }
        >
          {hasToken ? "トークン登録ずみ" : "未設定"}
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[12px] text-hs-text-secondary">
          チャネルアクセストークン{hasToken ? "（登録ずみ・変更する場合のみ入力）" : ""}
        </label>
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder={hasToken ? "••••••••••••" : "LINE Developersで発行した長期のチャネルアクセストークン"}
          className="rounded border border-hs-stone-300 px-2.5 py-2 text-sm text-hs-text outline-none focus:border-hs-primary"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[12px] text-hs-text-secondary">テスト送信先のLINEユーザーID（任意）</label>
        <input
          value={testUserId}
          onChange={(e) => setTestUserId(e.target.value)}
          placeholder="U から始まる33文字のID"
          className="rounded border border-hs-stone-300 px-2.5 py-2 text-sm text-hs-text outline-none focus:border-hs-primary"
        />
        <div className="text-[11px] leading-relaxed text-hs-stone-400">
          LINE Developersのチャネル基本設定にある「あなたのユーザーID」です。そのLINEアカウントが公式アカウントを友だち追加している必要があります。
        </div>
      </div>

      {error && <FriendlyError message={error.message} details={error.details} />}
      {saved && <div className="text-[12px] text-hs-success-text">保存しました。</div>}
      {checkResult && <div className="text-[12px] text-hs-success-text">{checkResult}</div>}

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-hs-primary px-4 py-2 text-[13px] font-bold text-white hover:bg-hs-primary-dark disabled:opacity-50"
        >
          {saving ? "保存中…" : "保存する"}
        </button>
        <button
          onClick={handleCheck}
          disabled={checking || !hasToken}
          className="rounded-md border border-hs-stone-300 px-4 py-2 text-[13px] text-hs-text-secondary hover:bg-hs-stone-50 disabled:opacity-50"
        >
          {checking ? "確認中…" : "接続を確認する"}
        </button>
      </div>
    </div>
  );
}

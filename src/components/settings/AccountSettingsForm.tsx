"use client";

import { useState } from "react";
import type { User } from "@/lib/types/domain";
import { FriendlyError } from "@/components/ui/FriendlyError";

export function AccountSettingsForm({ user }: { user: User }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newEmail, setNewEmail] = useState(user.email);
  const [newDisplayName, setNewDisplayName] = useState(user.displayName);
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(false);

    if (newPassword && newPassword !== newPasswordConfirm) {
      setError("新しいパスワード（確認）が一致しません");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newEmail: newEmail !== user.email ? newEmail : undefined,
          newDisplayName: newDisplayName !== user.displayName ? newDisplayName : undefined,
          newPassword: newPassword || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "変更に失敗しました");
        return;
      }
      setDone(true);
      setCurrentPassword("");
      setNewPassword("");
      setNewPasswordConfirm("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-5 rounded-lg border border-hs-stone-300 bg-white p-6">
      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-bold text-hs-text">表示名</label>
        <input
          value={newDisplayName}
          onChange={(e) => setNewDisplayName(e.target.value)}
          className="rounded border border-hs-stone-300 px-2.5 py-2 text-sm text-hs-text outline-none focus:border-hs-primary"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-bold text-hs-text">メールアドレス（ログインID）</label>
        <input
          type="email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          className="rounded border border-hs-stone-300 px-2.5 py-2 text-sm text-hs-text outline-none focus:border-hs-primary"
        />
      </div>

      <div className="border-t border-hs-stone-100 pt-4">
        <div className="mb-3 text-[13px] font-bold text-hs-text">パスワードを変更する場合のみ入力してください</div>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] text-hs-text-secondary">新しいパスワード（8文字以上）</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="rounded border border-hs-stone-300 px-2.5 py-2 text-sm text-hs-text outline-none focus:border-hs-primary"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] text-hs-text-secondary">新しいパスワード（確認用にもう一度）</label>
            <input
              type="password"
              value={newPasswordConfirm}
              onChange={(e) => setNewPasswordConfirm(e.target.value)}
              className="rounded border border-hs-stone-300 px-2.5 py-2 text-sm text-hs-text outline-none focus:border-hs-primary"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1.5 border-t border-hs-stone-100 pt-4">
        <label className="text-[13px] font-bold text-hs-text">現在のパスワード（確認のため必須）</label>
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
          className="rounded border border-hs-stone-300 px-2.5 py-2 text-sm text-hs-text outline-none focus:border-hs-primary"
        />
      </div>

      {error && <FriendlyError message={error} />}
      {done && (
        <div className="rounded-md border border-hs-success-border bg-hs-success-bg px-3.5 py-2.5 text-[13px] text-hs-success-text">
          変更を保存しました。
        </div>
      )}

      <button
        type="submit"
        disabled={saving || !currentPassword}
        className="rounded-md bg-hs-primary px-4 py-2.5 text-[14px] font-bold text-white hover:bg-hs-primary-dark disabled:opacity-50"
      >
        {saving ? "保存中…" : "保存する"}
      </button>
    </form>
  );
}

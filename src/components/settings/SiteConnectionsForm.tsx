"use client";

import { useState } from "react";
import { FriendlyError } from "@/components/ui/FriendlyError";

interface SiteRow {
  id: string;
  slug: string;
  name: string;
  baseUrl: string | null;
  hasWpApiKey: boolean;
}

export function SiteConnectionsForm({ sites }: { sites: SiteRow[] }) {
  return (
    <div className="flex flex-col gap-4">
      {sites.map((site) => (
        <SiteRowForm key={site.id} site={site} />
      ))}
    </div>
  );
}

function SiteRowForm({ site }: { site: SiteRow }) {
  const [baseUrl, setBaseUrl] = useState(site.baseUrl ?? "");
  const [wpApiKey, setWpApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [hasKey, setHasKey] = useState(site.hasWpApiKey);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setDone(false);
    try {
      const res = await fetch(`/api/sites/${site.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl,
          ...(wpApiKey ? { wpApiKey } : {}),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "保存に失敗しました");
        return;
      }
      if (wpApiKey) {
        setHasKey(true);
        setWpApiKey("");
      }
      setDone(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-hs-stone-300 bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-[13px] font-bold text-hs-text">{site.name}</span>
        <span
          className={
            "rounded-full px-2 py-0.5 text-[11px] " +
            (hasKey && baseUrl
              ? "bg-hs-success-bg text-hs-success-text"
              : "bg-hs-stone-100 text-hs-text-secondary")
          }
        >
          {hasKey && baseUrl ? "接続ずみ" : "未接続"}
        </span>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex flex-1 flex-col gap-1.5">
          <label className="text-[12px] text-hs-text-secondary">サイトURL（受信先URLのドメイン部分）</label>
          <input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://example.com"
            className="rounded border border-hs-stone-300 px-2.5 py-2 text-sm text-hs-text outline-none focus:border-hs-primary"
          />
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <label className="text-[12px] text-hs-text-secondary">
            APIキー{hasKey ? "（設定ずみ・変更する場合のみ入力）" : ""}
          </label>
          <input
            type="password"
            value={wpApiKey}
            onChange={(e) => setWpApiKey(e.target.value)}
            placeholder={hasKey ? "••••••••••••" : "プラグインの設定画面に表示されたAPIキー"}
            className="rounded border border-hs-stone-300 px-2.5 py-2 text-sm text-hs-text outline-none focus:border-hs-primary"
          />
        </div>
      </div>

      {error && (
        <div className="mt-2.5">
          <FriendlyError message={error} />
        </div>
      )}
      {done && !error && (
        <div className="mt-2.5 text-[12px] text-hs-success-text">保存しました。</div>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="mt-3 rounded-md bg-hs-primary px-3.5 py-1.5 text-[12px] font-bold text-white hover:bg-hs-primary-dark disabled:opacity-50"
      >
        {saving ? "保存中…" : "保存する"}
      </button>
    </div>
  );
}

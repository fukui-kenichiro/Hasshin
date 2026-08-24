"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { GlossaryCategory, GlossaryTerm } from "@/lib/types/domain";

export function GlossaryManager({
  categories,
  terms,
}: {
  categories: GlossaryCategory[];
  terms: GlossaryTerm[];
}) {
  const router = useRouter();
  const [newCategoryName, setNewCategoryName] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);

  async function handleAddCategory() {
    const name = newCategoryName.trim();
    if (!name) return;
    setAddingCategory(true);
    await fetch("/api/glossary/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setNewCategoryName("");
    setAddingCategory(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end gap-2 rounded-lg border border-hs-stone-300 bg-white p-4">
        <div className="flex flex-1 flex-col gap-1.5">
          <label className="text-[13px] font-bold text-hs-text">新しいカテゴリーを追加</label>
          <input
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="例: 選挙関係"
            className="rounded border border-hs-stone-300 px-2.5 py-2 text-sm text-hs-text outline-none focus:border-hs-primary"
          />
        </div>
        <button
          onClick={handleAddCategory}
          disabled={addingCategory || !newCategoryName.trim()}
          className="rounded-md bg-hs-primary px-4 py-2 text-[13px] font-bold text-white hover:bg-hs-primary-dark disabled:opacity-50"
        >
          カテゴリーを追加
        </button>
      </div>

      {categories.length === 0 && (
        <div className="rounded-lg border border-hs-stone-300 bg-white px-4.5 py-8 text-center text-sm text-hs-text-secondary">
          まだカテゴリーがありません。上のフォームから追加してください。
        </div>
      )}

      {categories.map((category) => (
        <CategoryCard
          key={category.id}
          category={category}
          terms={terms.filter((t) => t.categoryId === category.id)}
        />
      ))}
    </div>
  );
}

function CategoryCard({
  category,
  terms,
}: {
  category: GlossaryCategory;
  terms: GlossaryTerm[];
}) {
  const router = useRouter();
  const [term, setTerm] = useState("");
  const [explanation, setExplanation] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleAddTerm() {
    if (!term.trim() || !explanation.trim()) return;
    setSaving(true);
    await fetch("/api/glossary/terms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId: category.id, term: term.trim(), explanation: explanation.trim() }),
    });
    setTerm("");
    setExplanation("");
    setSaving(false);
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-hs-stone-300 bg-white">
      <div className="border-b border-hs-stone-100 bg-hs-stone-50 px-4.5 py-2.5 text-[13px] font-bold text-hs-text">
        {category.name}
      </div>

      <div className="flex flex-col gap-2 px-4.5 py-3">
        {terms.length === 0 && (
          <div className="text-[12px] text-hs-text-secondary">まだ用語がありません。</div>
        )}
        {terms.map((t) => (
          <div key={t.id} className="flex items-baseline gap-2 rounded border border-hs-stone-100 bg-hs-stone-50 px-3 py-2">
            <span className="shrink-0 text-[13px] font-bold text-hs-text">{t.term}</span>
            <span className="text-[12px] text-hs-text-secondary">→ {t.term}（{t.explanation}）</span>
          </div>
        ))}
      </div>

      <div className="flex items-end gap-2 border-t border-hs-stone-100 px-4.5 py-3">
        <div className="flex flex-1 flex-col gap-1">
          <label className="text-[11px] font-bold text-hs-stone-600">用語（○で数字の部分を表せます）</label>
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="例: ○中総"
            className="rounded border border-hs-stone-300 px-2.5 py-1.5 text-[13px] text-hs-text outline-none focus:border-hs-primary"
          />
        </div>
        <div className="flex flex-[2] flex-col gap-1">
          <label className="text-[11px] font-bold text-hs-stone-600">説明（かっこ書きで添える内容）</label>
          <input
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            placeholder="例: 第○回中央委員会総会"
            className="rounded border border-hs-stone-300 px-2.5 py-1.5 text-[13px] text-hs-text outline-none focus:border-hs-primary"
          />
        </div>
        <button
          onClick={handleAddTerm}
          disabled={saving || !term.trim() || !explanation.trim()}
          className="rounded-md border border-hs-primary px-3.5 py-1.5 text-[12px] font-bold text-hs-primary hover:bg-hs-kitatama-bg disabled:opacity-50"
        >
          用語を追加
        </button>
      </div>
    </div>
  );
}

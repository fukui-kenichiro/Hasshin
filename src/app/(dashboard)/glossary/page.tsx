import { listGlossaryCategories, listGlossaryTerms } from "@/lib/data/store";
import { GlossaryManager } from "@/components/glossary/GlossaryManager";

export default async function GlossaryPage() {
  const [categories, terms] = await Promise.all([listGlossaryCategories(), listGlossaryTerms()]);

  return (
    <div className="flex h-screen flex-col">
      <div className="border-b border-hs-stone-300 bg-white px-8 py-5.5">
        <div className="text-[22px] font-bold text-hs-text">党内用語辞典</div>
        <div className="mt-1 max-w-2xl text-[13px] leading-relaxed text-hs-text-secondary">
          ここに登録した用語は、文章を書き直すときにAIが参照します。単に消してしまうのではなく「用語（説明）」の形で解説を添えます。同じ記事の中で2回目以降に出てきた場合は、説明なしでそのまま使います。
        </div>
      </div>

      <div className="flex-1 overflow-auto px-8 py-7">
        <GlossaryManager categories={categories} terms={terms} />
      </div>
    </div>
  );
}

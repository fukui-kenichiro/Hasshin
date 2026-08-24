import { listSourceDocuments } from "@/lib/data/store";
import { UploadForm } from "@/components/uploads/UploadForm";

const SOURCE_TYPE_LABEL: Record<string, string> = {
  suishin_news: "推進ニュース",
  ganbaru_news: "がんばるニュース",
};

const STATUS_LABEL: Record<string, { label: string; colorClass: string }> = {
  uploaded: { label: "待機中", colorClass: "bg-hs-stone-400" },
  processing: { label: "処理中", colorClass: "bg-hs-primary" },
  done: { label: "完了", colorClass: "bg-hs-success-text" },
  error: { label: "エラー", colorClass: "bg-hs-danger" },
};

export default async function UploadsPage() {
  const docs = [...(await listSourceDocuments())].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));

  return (
    <div className="flex h-screen flex-col">
      <div className="border-b border-hs-stone-300 bg-white px-8 py-5.5">
        <div className="text-[22px] font-bold text-hs-text">PDFの取り込み</div>
        <div className="mt-1 text-[13px] text-hs-text-secondary">
          推進ニュース・がんばるニュースのPDFファイルを取り込むと、記事の切り分け・地域の判定・文章の書き直し・似た記事のチェックを自動で行います。
        </div>
      </div>

      <div className="flex-1 overflow-auto px-8 py-7">
        <div className="flex flex-col gap-7">
          <UploadForm />

          <div>
            <div className="mb-3 text-[15px] font-bold text-hs-text">これまでに取り込んだPDF</div>
            <div className="overflow-hidden rounded-lg border border-hs-stone-300 bg-white">
              <div className="grid grid-cols-[2.4fr_1fr_1fr_2fr] bg-hs-stone-100 px-4.5 py-2.5 text-[12px] font-bold text-hs-stone-600">
                <div>ファイル名</div>
                <div>種類</div>
                <div>取り込んだ日時</div>
                <div>状況</div>
              </div>
              {docs.length === 0 && (
                <div className="px-4.5 py-8 text-center text-sm text-hs-text-secondary">
                  まだPDFを取り込んでいません。
                </div>
              )}
              {docs.map((doc) => {
                const statusInfo = STATUS_LABEL[doc.status] ?? STATUS_LABEL.processing;
                return (
                  <div key={doc.id} className="grid grid-cols-[2.4fr_1fr_1fr_2fr] items-center border-t border-hs-stone-100 px-4.5 py-3.5">
                    <div className="truncate pr-3 text-[13px] font-bold text-hs-text">{doc.originalFilename}</div>
                    <div className="text-[13px] text-hs-text-secondary">{SOURCE_TYPE_LABEL[doc.sourceType]}</div>
                    <div className="text-[13px] text-hs-text-secondary">{doc.uploadedAt.slice(0, 16).replace("T", " ")}</div>
                    <div className="flex items-center gap-2">
                      <span className={"h-2 w-2 rounded-full " + statusInfo.colorClass} />
                      <span className="text-[13px] text-hs-text-secondary">
                        {statusInfo.label}
                        {doc.status === "processing" && doc.pageCount
                          ? `（${doc.pageCountProcessed}/${doc.pageCount}ページ）`
                          : ""}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

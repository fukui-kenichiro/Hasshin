// 高齢の職員でも読みやすいよう、まず一言で状況を伝え、技術的な詳細は
// 「詳細情報」を開いたときだけ見えるようにするエラー表示。
export function FriendlyError({ message, details }: { message: string; details?: string }) {
  return (
    <div className="rounded-md border border-hs-danger-border bg-hs-danger-bg px-3.5 py-3 text-[13px] text-hs-danger-text">
      <div className="font-bold leading-relaxed">{message}</div>
      {details && (
        <details className="mt-2">
          <summary className="cursor-pointer text-[12px] text-hs-danger-text underline">詳細情報</summary>
          <pre className="mt-1.5 whitespace-pre-wrap break-words rounded bg-white/60 p-2 text-[11px] text-hs-stone-600">
            {details}
          </pre>
        </details>
      )}
    </div>
  );
}

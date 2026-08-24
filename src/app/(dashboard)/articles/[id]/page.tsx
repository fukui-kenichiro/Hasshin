import { notFound } from "next/navigation";
import {
  getArticleById,
  getSourceDocumentById,
  listArticles,
  listDuplicateFlags,
  listInternalInfoFlags,
} from "@/lib/data/store";
import { ArticleEditView } from "@/components/articles/ArticleEditView";
import type { ArticleStatus } from "@/lib/types/domain";

export default async function ArticleEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  const { from } = await searchParams;
  const article = await getArticleById(id);
  if (!article) notFound();

  const [sourceDocument, internalInfoFlags, duplicateFlags] = await Promise.all([
    getSourceDocumentById(article.sourceDocumentId),
    listInternalInfoFlags(id),
    listDuplicateFlags(id),
  ]);

  // 前後移動は「一覧から開いたときの状況（from）」を基準にする。
  // 承認・却下すると記事の状況が変わり、その状況で絞り込んだ一覧からは
  // 消えてしまうため、現在の記事だけは元の状況の一覧に含めたまま並べ直す。
  // こうすることで、承認・却下した直後でも「次の記事」に進める。
  const fromStatus = (from as ArticleStatus | undefined) ?? article.status;
  const queueBase = await listArticles({ status: fromStatus });
  const siblings = queueBase.some((a) => a.id === id)
    ? queueBase
    : [...queueBase, article].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const currentIndex = siblings.findIndex((a) => a.id === id);
  const prevArticleId = currentIndex > 0 ? siblings[currentIndex - 1].id : null;
  const nextArticleId =
    currentIndex >= 0 && currentIndex < siblings.length - 1 ? siblings[currentIndex + 1].id : null;

  return (
    <ArticleEditView
      article={article}
      sourceDocument={sourceDocument}
      internalInfoFlags={internalInfoFlags}
      duplicateFlags={duplicateFlags}
      prevArticleId={prevArticleId}
      nextArticleId={nextArticleId}
      fromStatus={fromStatus}
    />
  );
}

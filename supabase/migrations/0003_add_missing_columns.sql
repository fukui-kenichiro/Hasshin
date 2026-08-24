-- articles.region_tag_reason: tag_region ジョブの判定理由をUIに表示するための列
-- （マイルストーン4のUI設計時に必要になったが、当初のスキーマに列を追加し忘れていた）
alter table articles add column region_tag_reason text;

-- source_documents.page_count_processed: アップロード画面の進捗表示用。
-- 何ページ中何ページの抽出が終わったかを保持する（processing_jobsを毎回
-- 集計しなくても済むようにする単純なカウンタ）
alter table source_documents add column page_count_processed integer not null default 0;

-- ハッシン（Hasshin）初期スキーマ
-- 詳細な設計意図は docs/DATA_MODEL.md を参照。

create extension if not exists "pgcrypto";

-- =========================================================
-- 認証（単一アカウント運用だが複数アカウントに拡張しやすい形にする）
-- =========================================================

create type user_role as enum ('admin', 'editor');

create table users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  display_name text not null,
  role user_role not null default 'editor',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

create table sessions (
  id text primary key, -- session token のハッシュ
  user_id uuid not null references users(id) on delete cascade,
  user_agent text,
  ip inet,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);

create index sessions_user_id_idx on sessions(user_id);

-- =========================================================
-- 掲載先サイト
-- =========================================================

create table sites (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique, -- kitatama-tobu / nishitokyo / kodaira
  name text not null,
  base_url text,
  created_at timestamptz not null default now()
);

-- =========================================================
-- アップロード原本（PDF）
-- =========================================================

create type source_type as enum ('suishin_news', 'ganbaru_news');
create type source_document_status as enum ('uploaded', 'processing', 'done', 'error');

create table source_documents (
  id uuid primary key default gen_random_uuid(),
  original_filename text not null,
  storage_path text not null, -- Supabase Storage 上のパス
  source_type source_type not null,
  issue_date date, -- ファイル名等から推定。手動修正可
  page_count integer,
  status source_document_status not null default 'uploaded',
  uploaded_by uuid references users(id),
  uploaded_at timestamptz not null default now(),
  notes text
);

-- ページ単位の画像化・Vision読み取り結果（非同期処理の単位、監査証跡）
create type source_page_status as enum ('pending', 'processing', 'done', 'error');

create table source_pages (
  id uuid primary key default gen_random_uuid(),
  source_document_id uuid not null references source_documents(id) on delete cascade,
  page_number integer not null,
  image_storage_path text,
  vision_raw_json jsonb, -- Claude Vision の生出力（再処理・デバッグ用）
  status source_page_status not null default 'pending',
  error_message text,
  processed_at timestamptz,
  unique (source_document_id, page_number)
);

-- =========================================================
-- 記事（トピック単位）
-- =========================================================

create type region_tag as enum ('kitatama_tobu', 'nishitokyo', 'kodaira', 'multiple', 'undetermined');
create type article_status as enum ('pending_review', 'approved', 'rejected', 'exported');

-- マイルストーン2の実サンプル検証で判明: 記事の一部ではなく記事全体が
-- 党内限定の組織活動報告である場合があり、箇所単位のハイライトだけでは
-- 対応しきれない。assemble_articles ジョブが判定し、not_suitable_internal_only
-- の記事は rewrite ジョブを自動実行しない（人が明示的に上書きしない限り）。
create type public_suitability as enum ('rewrite_candidate', 'not_suitable_internal_only', 'needs_human_judgment');

create table articles (
  id uuid primary key default gen_random_uuid(),
  source_document_id uuid not null references source_documents(id) on delete cascade,
  page_start integer,
  page_end integer,

  -- 抽出された原文（リライト前）
  title_original text,
  body_original text,

  -- リライト後（一般公開向け）
  title_rewritten text,
  body_rewritten text,

  public_suitability public_suitability not null default 'needs_human_judgment',
  public_suitability_reason text,
  public_suitability_source text not null default 'ai', -- 'ai' | 'manual'（人が上書きした場合）

  region_tag region_tag not null default 'undetermined',
  region_tag_confidence numeric(4,3),
  region_tag_source text not null default 'ai', -- 'ai' | 'manual'

  target_site_id uuid references sites(id),

  -- 同一トピックから西東京向け等に派生記事を作った場合の参照元
  derived_from_article_id uuid references articles(id),

  status article_status not null default 'pending_review',

  reviewed_by uuid references users(id),
  reviewed_at timestamptz,
  approved_by uuid references users(id),
  approved_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index articles_source_document_id_idx on articles(source_document_id);
create index articles_status_idx on articles(status);
create index articles_region_tag_idx on articles(region_tag);
create index articles_derived_from_idx on articles(derived_from_article_id);

-- 記事に含まれる画像（PDFページから切り出したもの）
create table article_images (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references articles(id) on delete cascade,
  source_page_id uuid references source_pages(id),
  image_storage_path text not null,
  caption text,
  position integer not null default 0
);

-- =========================================================
-- 編集履歴（AIによる初稿・リライト、人手編集を通じて版管理）
-- =========================================================

create type revision_edit_type as enum ('ai_initial', 'ai_rewrite', 'human_edit', 'region_correction');

create table article_revisions (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references articles(id) on delete cascade,
  revision_number integer not null,
  title text,
  body text,
  region_tag region_tag,
  edit_type revision_edit_type not null,
  edited_by uuid references users(id), -- null = AI による生成
  created_at timestamptz not null default now(),
  unique (article_id, revision_number)
);

-- =========================================================
-- 内部限定情報の検知（明示的な確認なしにエクスポートさせないための安全弁）
-- =========================================================

create type internal_info_status as enum ('unresolved', 'confirmed_safe', 'removed');

create table internal_info_flags (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references articles(id) on delete cascade,
  quoted_text text not null,
  span_start integer,
  span_end integer,
  category text not null, -- membership_count / dues_rate / internal_directive / member_only_label / other
  reason text,
  status internal_info_status not null default 'unresolved',
  resolved_by uuid references users(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index internal_info_flags_article_id_idx on internal_info_flags(article_id);
create index internal_info_flags_unresolved_idx on internal_info_flags(article_id) where status = 'unresolved';

-- =========================================================
-- 重複・類似トピック検出
-- =========================================================

create type duplicate_flag_type as enum ('duplicate_content', 'recycled_appeal');
create type duplicate_flag_status as enum ('open', 'confirmed', 'dismissed');

create table duplicate_flags (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references articles(id) on delete cascade,
  similar_article_id uuid references articles(id),
  flag_type duplicate_flag_type not null,
  similarity_score numeric(4,3),
  similarity_reason text, -- AIによる説明（「主旨が同じ檄文」等）
  recommended_action text not null default '掲載を見送ることをおすすめします',
  status duplicate_flag_status not null default 'open',
  reviewed_by uuid references users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index duplicate_flags_article_id_idx on duplicate_flags(article_id);
create index duplicate_flags_status_idx on duplicate_flags(status);

-- =========================================================
-- 非同期ジョブキュー（Vercel の関数実行時間制限を考慮し、
-- ページ単位・記事単位に分割して処理する）
-- =========================================================

create type job_type as enum (
  'render_pages',       -- PDF -> ページ画像化
  'extract_page',       -- 1ページ分の Vision 読み取り
  'assemble_articles',  -- ページ群 -> 記事（トピック）単位への構造化
  'tag_region',         -- 地域タグ付与
  'rewrite',            -- 一般公開向けリライト
  'detect_duplicates',  -- 重複・類似検出
  'export'              -- HTML/Markdown/プレーンテキスト書き出し
);
create type job_status as enum ('pending', 'in_progress', 'done', 'error', 'retrying');

create table processing_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type job_type not null,
  payload jsonb not null default '{}'::jsonb,
  status job_status not null default 'pending',
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  last_error text,
  related_source_document_id uuid references source_documents(id) on delete cascade,
  related_source_page_id uuid references source_pages(id) on delete cascade,
  related_article_id uuid references articles(id) on delete cascade,
  priority integer not null default 100,
  run_after timestamptz not null default now(),
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index processing_jobs_claim_idx on processing_jobs(status, run_after, priority);

-- =========================================================
-- エクスポート履歴（監査用）
-- =========================================================

create type export_format as enum ('html', 'markdown', 'plain_text');

create table exports (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references articles(id) on delete cascade,
  format export_format not null,
  content text not null,
  exported_by uuid references users(id),
  exported_at timestamptz not null default now()
);

create index exports_article_id_idx on exports(article_id);

-- =========================================================
-- 党内用語辞典
-- リライト時にAIが参照し、単に削除・平易化するのではなく
-- 「用語（説明）」の形で解説を添えるために使う
-- （例:「青本」→「青本（『Q＆A 共産主義と自由』）」）。
-- term に "○" を含めることで数字が入る用語にも対応する
-- （例: term "○中総" / explanation "第○回中央委員会総会"）。
-- カテゴリ・用語ともに利用者が画面から追加できる。
-- =========================================================

create table glossary_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table glossary_terms (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references glossary_categories(id) on delete cascade,
  term text not null,
  explanation text not null,
  created_at timestamptz not null default now()
);

create index glossary_terms_category_id_idx on glossary_terms(category_id);

-- =========================================================
-- 初期データ
-- =========================================================

insert into sites (slug, name) values
  ('kitatama-tobu', '北多摩東部地区委員会HP'),
  ('nishitokyo', '西東京HP'),
  ('kodaira', '小平HP');

with cat_gakushu as (
  insert into glossary_categories (name) values ('学習関係') returning id
), cat_minshu as (
  insert into glossary_categories (name) values ('党内民主主義関係') returning id
)
insert into glossary_terms (category_id, term, explanation)
select id, term, explanation from cat_gakushu, (values
  ('青本', '『Q＆A 共産主義と自由』'),
  ('赤本', '『Q＆A いま「資本論」がおもしろい』'),
  ('緑本', '『自由な時間と「資本論」』')
) as t(term, explanation)
union all
select id, term, explanation from cat_minshu, (values
  ('○中総', '第○回中央委員会総会')
) as t(term, explanation);

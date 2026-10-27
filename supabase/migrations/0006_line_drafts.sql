-- LINE文案作成機能: 地区のLINE公式アカウントで配信する短文メッセージの下書き。
-- 作成 → 文案承認（または手動修正）→ 配信済みの記録、までをハッシンで管理する。

create table line_drafts (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('manual', 'article')),
  source_article_id uuid references articles(id) on delete set null,
  source_text text not null,
  message_text text not null,
  ai_notes jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'approved', 'sent')),
  created_by uuid references users(id),
  approved_by uuid references users(id),
  approved_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index line_drafts_status_idx on line_drafts(status);
create index line_drafts_created_at_idx on line_drafts(created_at desc);

alter table line_drafts enable row level security;

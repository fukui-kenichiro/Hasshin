-- LINE配信機能: 予約配信の状態管理と、LINE連携の設定値の保存先を追加する。

alter table line_drafts drop constraint line_drafts_status_check;
alter table line_drafts add constraint line_drafts_status_check
  check (status in ('draft', 'approved', 'scheduled', 'sending', 'sent', 'failed'));

alter table line_drafts add column scheduled_at timestamptz;
alter table line_drafts add column delivery_error text;
alter table line_drafts add column delivery_attempts integer not null default 0;
-- LINEの一斉配信APIの再試行キー。通信エラー後の再送でも二重配信にならないようにする。
alter table line_drafts add column retry_key uuid not null default gen_random_uuid();

create index line_drafts_due_idx on line_drafts(scheduled_at) where status = 'scheduled';

-- LINEのチャネルアクセストークンなど、画面から設定する値の保存先（service_roleのみ参照可）。
create table app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table app_settings enable row level security;

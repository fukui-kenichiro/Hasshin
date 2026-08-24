-- ジョブキューの排他取得用関数。
-- Postgres の FOR UPDATE SKIP LOCKED で、複数の同時リクエストが同じジョブを
-- 取り合わないようにする。Next.js側からは supabase.rpc('claim_next_job') で呼ぶ。
create or replace function claim_next_job()
returns processing_jobs
language plpgsql
as $$
declare
  claimed processing_jobs;
begin
  select * into claimed
  from processing_jobs
  where status = 'pending' and run_after <= now()
  order by priority asc, created_at asc
  limit 1
  for update skip locked;

  if claimed.id is not null then
    update processing_jobs
    set status = 'in_progress', locked_at = now(), attempts = attempts + 1, updated_at = now()
    where id = claimed.id
    returning * into claimed;
  end if;

  return claimed;
end;
$$;

-- =========================================================
-- Row Level Security
-- Supabaseはpublicスキーマのテーブルを既定でPostgREST経由でも公開するため、
-- RLSを有効化しポリシーを設けないことで anon/authenticated ロールからの
-- アクセスを遮断する（service_role はRLSを常にバイパスするため、
-- サーバー側のNext.js APIルートからのみアクセスできる状態にする）。
-- =========================================================

alter table users enable row level security;
alter table sessions enable row level security;
alter table sites enable row level security;
alter table source_documents enable row level security;
alter table source_pages enable row level security;
alter table articles enable row level security;
alter table article_images enable row level security;
alter table article_revisions enable row level security;
alter table internal_info_flags enable row level security;
alter table duplicate_flags enable row level security;
alter table processing_jobs enable row level security;
alter table exports enable row level security;
alter table glossary_categories enable row level security;
alter table glossary_terms enable row level security;

-- =========================================================
-- 初期アカウント
-- パスワードは bcryptjs でハッシュ化済み（平文はコード・DBに残さない）。
-- ログイン後、利用者が管理画面（/settings）からメールアドレス・パスワードを
-- 変更できる。
-- =========================================================

insert into users (email, password_hash, display_name, role) values
  ('sendenbu@kitatama-tobu.com', '$2b$10$2bieyjc0FO7Qvew6ZCWMnuNVclwYAzNhrV6e1B5c1EA11URYzcQBi', '宣伝部 編集担当', 'admin');

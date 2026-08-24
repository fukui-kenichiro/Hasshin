-- Phase 2: WordPressプラグイン連携。
-- 承認済み記事をサイトごとのWordPressへ下書きとして自動送信するための
-- 接続情報・送信状態カラムと、新しいジョブ種別を追加する。

alter table sites add column wp_api_key text;

alter table articles add column wp_post_id text;
alter table articles add column wp_post_url text;
alter table articles add column wp_publish_status text not null default 'not_sent'
  check (wp_publish_status in ('not_sent', 'pending', 'sent', 'error', 'blocked'));
alter table articles add column wp_publish_error text;
alter table articles add column wp_published_at timestamptz;

alter type job_type add value 'publish_to_wp';

-- 完全削除（重大な個人情報等の事故対応）を安全に行えるようにする。
-- これらは on delete 指定がなかったため、参照先の記事を削除すると
-- 外部キー違反で失敗していた。削除時は参照を外すだけで十分なため
-- set null にする（duplicate_flags 自体や派生記事本体は残す）。
alter table articles drop constraint articles_derived_from_article_id_fkey;
alter table articles add constraint articles_derived_from_article_id_fkey
  foreign key (derived_from_article_id) references articles(id) on delete set null;

alter table duplicate_flags drop constraint duplicate_flags_similar_article_id_fkey;
alter table duplicate_flags add constraint duplicate_flags_similar_article_id_fkey
  foreign key (similar_article_id) references articles(id) on delete set null;

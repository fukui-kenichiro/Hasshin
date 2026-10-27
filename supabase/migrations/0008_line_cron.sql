-- LINE配信の予約を毎分実行するための定期ジョブ（Supabase pg_cron + pg_net）。
-- Vercel の無料プランは日1回までしか定期実行できないため、Supabase側から本番の
-- /api/cron/line-send を毎分呼び出す。認証用の CRON_SECRET は、このファイルには書かず、
-- 事前に Supabase Vault へ登録しておく:
--   select vault.create_secret('<CRON_SECRET の値>', 'hasshin_cron_secret');

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'line-send',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://hasshin.kitatama-tobu.com/api/cron/line-send',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'hasshin_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);

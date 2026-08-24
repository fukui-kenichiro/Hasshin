# マイルストーン5: Supabase接続・非同期ジョブ化・デプロイ

`docs/ARCHITECTURE.md` で「要検証」としていた点が実際に確定したので、ここに実装内容をまとめる。

## 1. PDFラスタライズ方式の確定

`docs/ARCHITECTURE.md` の「未決定事項」だった、PDFページ画像化のライブラリを確定した。

- **採用**: `pdfjs-dist`（Mozilla製、純JS）+ `@napi-rs/canvas`（Linux x64向けビルド済みバイナリ入り、追加のシステム依存なし）
- **理由**: 当初ローカル検証で使っていた poppler の `pdftoppm` はVercelのサーバーレス関数に存在せず、そのままでは本番で動作しない（マイルストーン5でデプロイ準備をする過程で判明）。実サンプルで出力画像が同等の品質であることを確認済み（[src/lib/pdf/rasterize.ts](../src/lib/pdf/rasterize.ts)）
- Turbopackがネイティブアドオン（`.node`）をESMチャンクに含められずビルドエラーになったため、`next.config.ts` の `serverExternalPackages` に `@napi-rs/canvas` / `pdfjs-dist` を指定してバンドル対象から除外した

## 2. 非同期ジョブキューの実装

要件に明記されていた「1回のリクエストで一括処理せず、ページ単位／記事単位に分割し非同期で実行できる設計にする」を実装した（マイルストーン4までは検証のため同期実行だった）。

- `processing_jobs` テーブル（Postgres）をキューとして使う。1ジョブ＝Claude APIを1回呼ぶ程度の粒度（`render_pages` → `extract_page`×ページ数 → `assemble_articles` → `tag_region`／`rewrite`／`detect_duplicates`）に分割したので、Vercelの関数実行時間制限を気にする必要がほぼない
- 排他制御は Postgres の `FOR UPDATE SKIP LOCKED` を使った `claim_next_job()` 関数で行う（複数リクエストが同じジョブを取り合わない）
- **駆動方法**: PDFアップロード後、ブラウザ（[UploadForm.tsx](../src/components/uploads/UploadForm.tsx)）が `/api/jobs/tick` を連続で呼び、呼ばれるたびにキューの先頭から1件だけ処理する。処理段階（ページ読み取り中／記事化中／リライト中…）をそのまま画面に表示できるようになった
- **セーフティネット**: `vercel.json` に1日1回のCronを設定（[/api/cron/worker](../src/app/api/cron/worker/route.ts)）。アップロード画面を閉じてしまった等で止まったジョブを掃除しつつ、Supabase Freeプランの7日間無操作スリープを防ぐ軽いヘルスチェックを兼ねる
- 実装詳細は [src/lib/pipeline/jobs.ts](../src/lib/pipeline/jobs.ts)

## 3. Supabase接続

- プロジェクト: `xdowpbpezalclfsyjrjh`（ap-southeast-1、Postgres 17、Free プラン）
- マイグレーション（`supabase/migrations/`）を適用済み。`0001_init.sql` の全テーブルに加え、`0002` でジョブ取得関数とRLS有効化、`0003` で不足していた列（`articles.region_tag_reason`、`source_documents.page_count_processed`）を追加した
- **RLS**: 全テーブルでRow Level Securityを有効化し、ポリシーは設けていない（anon/authenticatedからは一切アクセスできない）。アプリは service_role キーでのみアクセスする。これはSupabaseがpublicスキーマのテーブルを既定でPostgREST経由でも公開するため、RLSを切っておかないと anon キーだけで内部記事が読めてしまうことに気づいて対応したもの
- **Storage**: 非公開バケット `hasshin` を作成。`documents/{id}/original.pdf`、`documents/{id}/pages/{n}.png` という構成で保存する
- 初期アカウント: `sendenbu@kitatama-tobu.com`（bcryptでハッシュ化済みパスワードを直接シード）。ログイン後、`/settings` 画面からメールアドレス・パスワード・表示名を変更できる（[AccountSettingsForm.tsx](../src/components/settings/AccountSettingsForm.tsx)）

## 4. 必要な環境変数（Vercel側に設定する）

| 変数名 | 用途 |
|---|---|
| `ANTHROPIC_API_KEY` | Claude API |
| `SUPABASE_URL` | `https://xdowpbpezalclfsyjrjh.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | サーバー側からRLSをバイパスしてアクセスするための鍵。**Supabaseダッシュボード → Project Settings → API → service_role key** から取得する（このキーは公開してはならない） |
| `CRON_SECRET` | `/api/cron/worker` を保護するための秘密値。Vercelが自動生成・自動送信するCron用ヘッダーと突き合わせる |

## 5. デプロイ方法

GitHub連携が未設定のため（このセッションにGitHub CLI/トークンが無い）、Vercel MCPの直接ファイルデプロイ（`deploy_to_vercel`）を使う。後日GitHubリポジトリを用意すれば、Vercelプロジェクトをそちらに繋ぎ直してpush時自動デプロイに切り替えられる。

## 6. DNS（手動対応が必要）

`hasshin.kitatama-tobu.com` を Vercel に向けるDNS設定は、ドメインのレジストラ／DNS管理画面へのアクセスが必要なため、この場からは行えない。デプロイ後にVercel側で発行される値（CNAMEまたはAレコード）を、`kitatama-tobu.com` のDNS管理画面（現在ConoHa WING等で管理されている想定）に追加していただく必要がある。

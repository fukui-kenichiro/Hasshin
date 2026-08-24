# アーキテクチャ方針（提案 v1）

## リポジトリ構成

```
Hasshin/                      # ← 元の作業ディレクトリ（過去記事の例 PDF 等はここに残す）
  過去記事の例/                 # サンプルPDF（プロトタイプの入力に使う）
  hasshin/                    # ← 今回作成した Next.js アプリ本体（独立git repo）
    src/
      app/
        (auth)/login/                    # ログイン画面
        (dashboard)/
          page.tsx                       # レビュー待ち記事一覧（ダッシュボード トップ）
          uploads/                       # PDFアップロード画面
          articles/[id]/                 # 記事編集画面（比較表示・地域タグ修正・重複確認）
          archive/                       # 地域別・日付別アーカイブ
        api/
          auth/login, auth/logout
          uploads/                       # PDF受信 → source_documents作成 → ジョブ投入
          articles/[id]/                 # 記事の取得・更新
          articles/[id]/approve/         # 承認
          export/[id]/                   # HTML/Markdown/プレーンテキスト書き出し
          cron/worker/                   # ジョブキューをドレインする定期実行エンドポイント
      lib/
        supabase/                        # Supabaseクライアント（server/client分離）
        pdf/                             # PDF→ページ画像化
        ai/
          claude.ts                      # Anthropic SDK ラッパー
          prompts/                       # 抽出・地域タグ付け・リライト・重複検出のプロンプト
        jobs/                            # DBベースのジョブキュー（claim/complete/retry）
        auth/                            # セッションCookie管理
        redaction/                       # 内部情報検出の補助ロジック
      components/
        ui/                              # 基本UIパーツ
        articles/                        # 比較表示・地域タグ編集・重複アラート・ハイライト表示
        uploads/                         # アップロードUI
        layout/                          # サイドバー・ヘッダー
      types/                             # DB行の型定義
    supabase/migrations/                 # SQLマイグレーション
    docs/                                # 設計ドキュメント（このファイル、DATA_MODEL.md 等）
    scripts/                             # 開発用シードスクリプト等
```

`app/` は Next.js の規約上のディレクトリ名と衝突するため、プロジェクト自体は `hasshin/` サブディレクトリに切り、既存の `過去記事の例/` 等はそのまま親ディレクトリに残した（確認済み）。

## 非同期処理パイプライン

PDFアップロード後、以下のジョブを順に生成し、`processing_jobs` テーブルに積む。

1. `render_pages`（1件・ドキュメント単位）… PDFの各ページを画像化し `source_pages` に保存
2. `extract_page`（ページ数ぶん）… 各ページ画像をClaude Vision APIに渡し、見出し／本文／画像領域を構造化して `source_pages.vision_raw_json` に保存
3. `assemble_articles`（1件・ドキュメント単位）… 全ページの抽出結果を突き合わせ、記事（トピック）単位に分割し `articles` を作成。西東京関連トピックはここで派生記事も同時生成
4. `tag_region`（記事ごと、3と統合してもよい）… 地域タグの確信度が低い場合の再判定
5. `rewrite`（記事ごと）… 一般公開向けリライト＋内部情報検出（`internal_info_flags`生成）
6. `detect_duplicates`（記事ごと）… 過去記事との類似検出（`duplicate_flags`生成）

各ジョブは「1ページ」「1記事」程度の粒度に分割しており、サーバーレス関数の実行時間上限内に収まるようにする。

## ジョブキューの駆動方法（Vercel Hobby / Supabase Free の制約への対応）

**前提として要検証**：Vercel Hobby プランの Cron Jobs は過去に「1日1回まで」等の頻度制限が設けられた時期があり、現行の制限値はプラン変更で変わりうる。実装マイルストーンに入る前に最新のVercel料金ページで確認する。

制限を前提に、頻度に依存しない多重の駆動方式にする：

1. **アップロード直後の即時処理**：アップロードAPIがジョブを投入した後、同一リクエスト内（またはレスポンス返却後の `waitUntil`）で最初の数ジョブを処理し、実行時間の残りが少なくなったら打ち切る。
2. **ダッシュボード滞在中のポーリング駆動**：アップロード後・レビュー画面表示中は、クライアントが数秒間隔で `/api/jobs/tick` のような軽量エンドポイントを叩き、未処理ジョブを少しずつ消化する（担当者はアップロード直後に画面を見ていることが多い運用を前提とした現実的な方式）。
3. **セーフティネットとしての定期実行**：Vercel Cron（頻度制限内、例えば1日数回）または **Supabase 側の pg_cron / Scheduled Edge Functions**（Postgres本体にあるため Vercel Hobby の制限を受けない）で、取りこぼされたジョブを掃除する。
4. **Supabase Freeのスリープ対策**：上記3の定期実行が、同時に「軽いヘルスチェック（`select 1`）」を兼ねる。7日間無操作でのプロジェクト一時停止のしきい値に対し、少なくとも日次以上の頻度でアクセスが発生する設計にする。

この方式であれば、Vercel Cronの正確な頻度上限が判明する前でもプロトタイプを進められる。実装マイルストーンで確定させる。

## 認証

- 単一アカウント運用だが、`users` テーブルに `role` を持たせ複数アカウントに拡張しやすくしている（[DATA_MODEL.md](./DATA_MODEL.md)参照）。
- パスワードは bcrypt等でハッシュ化して `users.password_hash` に保存。平文はDBにもコードにも置かない。
- セッションはランダムトークンを発行し、Cookieにはトークンそのもの、DBにはそのハッシュ値を保存する（`sessions.id`）。

## Phase 2 を見据えた設計メモ

このプロジェクトはPhase 1（本ダッシュボード）とPhase 2（WordPress連携）の2段階構成。Phase 2では以下を追加する予定：

- 承認済み記事（`articles.status = 'approved'`）を対応するWordPressサイトの下書きとして自動投稿するWordPressプラグイン
- 北多摩東部／西東京／小平の3サイト分の接続設定UI（WP REST APIのURL・認証情報等）

Phase 1の設計はこれを見据え、以下を意識する：

- `sites` テーブルは将来 WP接続情報（REST APIベースURL、認証情報の参照キー等）を列追加しやすい形にしておく（現状 `slug` / `name` / `base_url` のみ）
- エクスポート（`exports` テーブル、`/api/export/[id]`）のレスポンス構造は、将来WPプラグインがREST経由で同じデータを取得する場合にも流用できるよう、記事本文・地域タグ・画像参照などを素直な形で持たせておく
- Phase 1のスコープにWordPress連携そのものは含めない

## 未決定・要確認事項

- Vercel Hobby の Cron 実行頻度・関数実行時間上限の最新値
- Claude APIのモデル選定（Vision対応・コスト・日本語精度のバランス）は次のプロトタイプ工程で実サンプルで検証
- PDFページ画像化のライブラリ（`pdf-lib` では画像化不可のため、`pdfium` 系のネイティブバインディングか、外部のレンダリングサービスを使うかを次工程で検証）

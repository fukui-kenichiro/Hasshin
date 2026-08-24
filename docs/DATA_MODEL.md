# データモデル（提案 v1）

SQL 実体は [`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql)。

## 要件で指定された5テーブルとの対応

要件では `source_documents / articles / article_revisions / duplicate_flags / sites` を基本とする、とあったので、
まずこの5つを中心に置き、非同期処理・認証・安全弁として以下を追加した。

| 追加テーブル | 追加理由 |
|---|---|
| `users` / `sessions` | 単一アカウントだが将来複数アカウント化する前提のため（要件通り） |
| `source_pages` | PDFページ単位で画像化・Vision読み取りを行うため。ページ単位が非同期ジョブの最小単位になる |
| `article_images` | 記事に紐づく画像（PDFページから切り出した写真等）を保持 |
| `internal_info_flags` | 「内部情報の疑いがある箇所は担当者が明示的に確認しない限りエクスポートに含めない」を実装するための安全弁。記事全体ではなく箇所（span）単位で未解決/解決済みを管理する |
| `processing_jobs` | サーバーレス関数の実行時間制限に対応するための非同期ジョブキュー（DBベース） |
| `exports` | 承認済み記事の書き出し履歴（監査用） |
| `glossary_categories` / `glossary_terms` | 党内用語辞典。ユーザーからのフィードバックで追加（マイルストーン4フィードバック対応）。単に削除・平易化するだけでなく「用語（説明）」の形で解説を添えるべき頻出党内用語を、カテゴリ別に登録できるようにする。`term` に "○" を含めることで「○中総」のような数字が入る用語にも対応する。リライト時に `rewrite` プロンプトへ参照データとして渡す |

## ER概要

```
sites ──< articles >── source_documents ──< source_pages
  │           │  │                              │
  │           │  └───< article_images >─────────┘
  │           ├───< article_revisions
  │           ├───< internal_info_flags
  │           └───< duplicate_flags >── (similar_article_id も articles を参照)
  │
users ──< sessions
users ──< articles (reviewed_by / approved_by)
processing_jobs ──> source_documents / source_pages / articles (処理対象への参照)
```

## 主要な設計判断

### 1. 「記事(article)」＝ 掲載先サイトごとの1レコード

`推進ニュース` の1トピックが西東京関連と判定された場合、**確認の結果「デフォルトは北多摩東部HP・西東京HPの両方に掲載し、西東京向けには別途書き直し版を作る、ただし手動調整可」** という運用にした。

これを表現するため、`articles` を「サイトに掲載する1本の記事」の単位とし、同一トピックから複数サイト向けの版が必要な場合は **articles テーブルに複数行**（北多摩東部向け1行＋西東京向け1行）を作る。西東京向けの行は `derived_from_article_id` で元記事を参照する。

- 抽出・地域タグ付けの段階で、AIが「西東京関連トピック」と判定した記事については、`assemble_articles` ジョブが北多摩東部向け1件・西東京向け1件（`derived_from_article_id` で紐付け）を生成する。
- 編集画面では派生記事であることを明示し、「西東京向けの版は不要」と判断した場合は担当者がその記事を却下（`rejected`）できる。
- レビュー・承認・エクスポートは記事（＝サイトごとの版）単位で独立して行える。
- 重複検出（`duplicate_flags`）は派生関係とは別軸の「別号・別日付の記事同士の類似」を扱う。

この設計により「両方に載せる／片方だけにする／文面を作り分ける」のすべてを、コード変更なしに運用（人手の承認・却下）だけで表現できる。

### 2. `internal_info_flags` は箇所単位・記事全体のフラグではない

要件「内部情報の疑いがある箇所は目立つ形でハイライトし、担当者が明示的に確認しない限りエクスポートに含めない」を素直に実装するため、記事に1つの `contains_internal_info` フラグを立てるのではなく、**検出された箇所（引用テキスト＋種別＋理由）ごとに行を作り、`status` を `unresolved / confirmed_safe / removed` で管理**する。

エクスポートAPIは「対象記事に `status = 'unresolved'` の行が1件でも残っていたら、確認画面へのリンクを返してブロックする」という単純なガードにできる。

種別（`category`）の初期案：
- `membership_count`（党員数）
- `dues_rate`（党費納入率）
- `reader_count` / `fundraising_rate`（読者数・募金到達率）
- `internal_directive`（支部長等への内部連絡事項）
- `member_only_label`（「党員限定」「部内資料」等の明記）
- `personal_privacy`（党員個人を特定しうる情報。マイルストーン3で実サンプルから追加。後述）
- `other`

**`personal_privacy` を追加した経緯**：マイルストーン3でのプロンプト設計時、実サンプル（`推進ニュース2026.07.27.pdf`）に「新しく入党した個人を、年代や家族との会話まで含めて紹介する」記事があることを確認した。政党の党員であるという情報は個人情報保護法上の要配慮個人情報にあたり、本人の明確な同意なく公開Webサイトに載せるべきではない。これは要件にあった「党員限定/部内資料の除外」「内部限定の具体的数値の除外」のどちらにも明示的には含まれていなかった観点のため、カテゴリを追加した。

### 3. `duplicate_flags` は「重複」と「檄の連続」を区別する

`flag_type`:
- `duplicate_content` … ほぼ同一内容の記事（誤って二重投入等）
- `recycled_appeal` … 選挙前後等に趣旨が同じ檄文的内容が短期間に連続発行されているケース

いずれも `status = 'open'` で始まり、UIで「確認（掲載見送りに同意）」「却下（別物と判断して掲載続行）」を選べる。**自動ブロックはしない**（要件通り、最終判断は人間）。`recommended_action` にはデフォルトで要件文言「掲載を見送ることをおすすめします」を入れておく。

### 4. `article_revisions` は AI初稿・AIリライト・人手編集をすべて記録

`edit_type`:
- `ai_initial` … Vision抽出直後の原文（`title_original` / `body_original` 相当のスナップショット）
- `ai_rewrite` … AIによる一般公開向けリライト直後
- `human_edit` … 担当者による本文編集
- `region_correction` … 地域タグの手動修正

`articles` 本体は「最新状態」を持ち、`article_revisions` が履歴（比較表示・差分監査用）を持つ、という一般的な current-state + history パターン。

### 5. `processing_jobs` はDBベースの単純なキュー

外部のメッセージブローカー（無料枠に収まらない／構成が複雑になる）を使わず、Postgres 1テーブルで表現する。

- `job_type` ごとに「PDF→ページ画像化」「1ページのVision抽出」「記事への構造化」「地域タグ付け」「リライト」「重複検出」「エクスポート」を分離。
- 1ジョブ＝1ページ or 1記事程度の粒度にすることで、Vercelの関数実行時間制限内に確実に収める。
- `run_after` / `priority` / `attempts` でリトライ・優先度制御。
- 取得（claim）は `select ... for update skip locked` 相当のクエリで排他制御する想定（実装は次のマイルストーンで）。

キューをどう駆動するか（Vercel Cron の頻度制限、Supabase のスリープ対策との関係）は [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md) にまとめた。

### 6. `articles.public_suitability` — 記事単位の「公開非推奨」判定（マイルストーン3で採用）

マイルストーン2のプロトタイプ検証（[docs/PROTOTYPE_EXTRACTION.md](./PROTOTYPE_EXTRACTION.md)）で、記事の一部ではなく**記事全体**が党内限定の組織活動報告であるケースが実サンプルに複数存在することが分かった。これは `internal_info_flags`（箇所単位）だけではカバーしきれないため、`articles` テーブルに `public_suitability`（`rewrite_candidate` / `not_suitable_internal_only` / `needs_human_judgment`）と `public_suitability_reason` を追加した。

- `assemble_articles` ジョブが記事を組み立てる際に一次判定する
- `not_suitable_internal_only` の記事は `rewrite` ジョブを自動実行しない（無駄なリライト生成を避ける）。レビュー待ち一覧には「公開非推奨」として表示し、担当者が明示的に「それでもリライトを試す」を選んだ場合のみ手動でリライトを実行できる
- 重複アラートと同様、**自動ブロックはしない**。最終判断は人間に委ねるUIにする

## 未確定・次マイルストーンで詰める点

- `region_tag_confidence` のしきい値（何%未満なら `undetermined` にするか）
- `source_documents.issue_date` の自動抽出方法（ファイル名 or 本文からAIが読み取るか）
- `article_images` の実際の切り出し方法（ページ画像から矩形を検出するか、AIに画像領域の座標を出させるか）

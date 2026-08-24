# マイルストーン2: PDF→AI構造化抽出プロトタイプ

## やったこと

`過去記事の例/` にある実サンプルから2件を使って検証した：

- `推進ニュース2026.07.17.pdf`（北多摩東部地区推進ニュース、2ページ）
- `20260509がんばるニュース.pdf`（小平市委員会 がんばるニュース、2ページ）

手順：

1. `poppler`（`pdftoppm`）でPDFの各ページを200dpiのPNGに変換（[src/lib/pdf/rasterize.ts](../src/lib/pdf/rasterize.ts)）
2. ページ画像1枚ごとにClaude Vision APIへ渡し、見出し／本文／画像／マストヘッドをブロック単位のJSONに構造化（`extract_page`、[src/lib/ai/prompts/extract-page.ts](../src/lib/ai/prompts/extract-page.ts)）
3. 全ページ分のブロックJSONをまとめてClaudeに渡し、記事（トピック）単位にグルーピング（`assemble_articles`、[src/lib/ai/prompts/assemble-articles.ts](../src/lib/ai/prompts/assemble-articles.ts)）
4. 実行スクリプト: [scripts/prototype-extract.ts](../scripts/prototype-extract.ts)（`ANTHROPIC_API_KEY=xxx npx tsx scripts/prototype-extract.ts <PDF>`）

**このセッションにはANTHROPIC_API_KEYがなく、実際のAPI呼び出しは行えていない。** スクリプト自体は実装済みで、ラスタライズ（PDF→PNG変換）までは実行して動作確認済み（[dry-run確認済み]）。抽出結果については、代わりに私自身がページ画像を読み、上記スキーマに沿って手作業でJSONを作成し、スキーマの妥当性を検証した：

- [suishin-2026-07-17.pages.manual-reference.json](../prototype/pdf-extraction/output/suishin-2026-07-17.pages.manual-reference.json) / [.articles.manual-reference.json](../prototype/pdf-extraction/output/suishin-2026-07-17.articles.manual-reference.json)
- [ganbaru-2026-05-09.pages.manual-reference.json](../prototype/pdf-extraction/output/ganbaru-2026-05-09.pages.manual-reference.json) / [.articles.manual-reference.json](../prototype/pdf-extraction/output/ganbaru-2026-05-09.articles.manual-reference.json)

ファイル名に `manual-reference` と付けているのは、実際のVision API出力ではなく人手で作成した「期待される出力の参考例」であることを区別するため。**ANTHROPIC_API_KEYを共有いただければ、同じスクリプトで実際のAPI出力を取得し、この参考例との差分を確認できる。**

## わかったこと（重要）

### 1. レイアウト構造化そのものは、スキーマ設計で十分表現できそう

2段組み・見出し／本文／写真／囲み記事の混在というレイアウトは、`type`（headline/subheading/body/caption/boxed_notice/byline/image）+ `reading_order` + `column` の組み合わせで問題なく表現できた。テキストレイヤー抽出（pdfplumber等）で文字順が壊れる問題も、画像として渡して読ませる方式なら回避できる（今回は目視でも2段組みが正しく追える状態）。

### 2. 【設計変更の提案】記事単位でも「一般公開に適さない」という判定が必要

これが今回の検証でいちばん重要な発見。

要件では「党員限定/部内資料と明記された箇所」「党員数等の内部限定の具体的数値」を**除外**する、という粒度（＝記事の一部を削る）を想定していたが、実サンプルを見ると、**記事全体が党内向けの組織運営報告そのもの**であるケースがある。例えば `推進ニュース2026.07.17.pdf` の3記事中2記事：

- 「思い切って働きかけを」（支部別の入党働きかけ・読者拡大実績、演説会参加人数の報告）
- 「今、なぜ党員拡大を正面にすえた議論と実践が必要か」（表紙に「支部会議で読み合わせるなどして活用してください」と明記された、党内の情勢判断会議の報告）

これらは、内部限定の数値や指示文を削っても「一般公開向け記事」として成立する残りの内容がほとんど無い。単なる箇所単位のハイライト除外では対応しきれず、**記事そのものを「一般公開への転用は推奨しない」として、リライト前の時点で編集担当者に提示する**仕組みが必要だと考える。

そこで `assemble_articles` の出力に、要件にはなかった `public_suitability` を追加した：

| 値 | 意味 |
|---|---|
| `rewrite_candidate` | 内部限定の数値・指示を除けば一般公開向けにリライトできる内容 |
| `not_suitable_internal_only` | 記事の主旨自体が党内限定の組織活動報告・内部指示であり、公開への転用に適さない |
| `needs_human_judgment` | 国政・外交等に関する党の見解表明で、地域トピックでも内部限定情報でもないが、掲載可否は編集判断が必要なもの |

実サンプルでの分類結果（6記事中）：

- `rewrite_candidate`: 1件（小平市議選の政策ポイント＝国保税・特養待機・ゴミ袋・公共交通等の要望）
- `not_suitable_internal_only`: 2件（いずれも推進ニュース。支部別実績報告、党内情勢判断会議の共有）
- `needs_human_judgment`: 3件（国政・外交に関する党の見解表明。地域トピックではないが内部限定情報でもない）

**ご確認いただきたい点**：この `public_suitability` 区分をデータモデルに正式に組み込んでよいか。組み込む場合、[docs/DATA_MODEL.md](./DATA_MODEL.md) の `articles` テーブルに `public_suitability` 列（enum）と `suitability_reason` 列を追加し、ダッシュボードのレビュー待ち一覧で「公開非推奨」のバッジを表示する形を想定している（重複アラートと同様、自動ブロックはせず人間が最終判断するUI）。

### 3. 地域タグ判定は今回のサンプルだけでは検証不足

今回の2サンプルには、要件で例示されている「西東京市関連トピック」に明確に該当する記事がなかった（`needs_human_judgment` に分類した記事はいずれも国政・外交トピックで地域と無関係）。地域タグ付けプロンプトの精度検証は、西東京関連トピックを含むサンプル（`推進ニュース2026.08.18.pdf` 等、他の号にも当たってみる）で、マイルストーン3（リライト・地域振り分け・重複検出のプロンプト設計）の中で改めて行う。

## 次のマイルストーンへの引き継ぎ

- `public_suitability` の要否について確認をいただいた上で、マイルストーン3（リライト・地域タグ・重複検出のプロンプト設計）に進む
- ANTHROPIC_API_KEYを共有いただければ、実際のAPI出力で今回の手作業参考例との差分を検証し、プロンプトの調整を行う

// WordPress REST APIのエンドポイントURLを組み立てる。
//
// /wp-json/... のパーマリンク形式は、サイト側で「パーマリンク設定」が
// 「基本」（プレーンURL）のままだとリライトルールが効かず、Apache等が
// 素の404を返してしまう（実際にConoHa WING上のサイトで発生）。
// WordPressコア標準の ?rest_route= クエリ形式は、パーマリンク設定に
// 関係なく常に動作するため、こちらを使う（各サイトのWordPress設定を
// 変更してもらう必要がない）。
export function buildWpEndpoint(baseUrl: string, route: string): string {
  const base = baseUrl.replace(/\/$/, "");
  return `${base}/?rest_route=${route}`;
}

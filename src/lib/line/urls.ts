const URL_PATTERN = /https?:\/\/[^\s<>"'）)」』、。]+/g;

export function extractUrls(text: string): string[] {
  return Array.from(new Set(text.match(URL_PATTERN) ?? []));
}

// 元の下書きにあるURLのうち、文案に含まれていないもの（AIがURLを変形・削除していないかの確認用）
export function findMissingUrls(sourceText: string, messageText: string): string[] {
  return extractUrls(sourceText).filter((url) => !messageText.includes(url));
}

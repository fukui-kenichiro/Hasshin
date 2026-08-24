import type { InternalInfoFlag } from "@/lib/types/domain";

export interface HighlightSegment {
  text: string;
  flag: InternalInfoFlag | null;
}

// bodyRewritten 中に、内部情報フラグの引用テキストが実際に含まれている箇所を
// ハイライト表示するためのセグメント分割。unresolved / confirmed_safe の
// フラグのみが対象（removed は元々本文に存在しないはずなので対象外）。
export function buildHighlightSegments(
  body: string,
  flags: InternalInfoFlag[]
): HighlightSegment[] {
  const candidates = flags.filter(
    (f) => (f.status === "unresolved" || f.status === "confirmed_safe") && f.quotedText.trim().length > 0
  );

  type Match = { start: number; end: number; flag: InternalInfoFlag };
  const matches: Match[] = [];
  for (const flag of candidates) {
    const idx = body.indexOf(flag.quotedText);
    if (idx !== -1) {
      matches.push({ start: idx, end: idx + flag.quotedText.length, flag });
    }
  }
  matches.sort((a, b) => a.start - b.start);

  const nonOverlapping: Match[] = [];
  let lastEnd = -1;
  for (const m of matches) {
    if (m.start >= lastEnd) {
      nonOverlapping.push(m);
      lastEnd = m.end;
    }
  }

  if (nonOverlapping.length === 0) {
    return [{ text: body, flag: null }];
  }

  const segments: HighlightSegment[] = [];
  let cursor = 0;
  for (const m of nonOverlapping) {
    if (m.start > cursor) {
      segments.push({ text: body.slice(cursor, m.start), flag: null });
    }
    segments.push({ text: body.slice(m.start, m.end), flag: m.flag });
    cursor = m.end;
  }
  if (cursor < body.length) {
    segments.push({ text: body.slice(cursor), flag: null });
  }
  return segments;
}

// processing_jobs の job_type = 'rewrite' で使うプロンプト。
//
// public_suitability === 'not_suitable_internal_only' の記事には、この
// ジョブを自動実行しない（無駄なリライト生成を避け、そのままレビュー待ち
// 一覧に「公開非推奨」として提示する）。担当者が手動で「それでもリライトを
// 試す」を選んだ場合のみ、このジョブを呼び出す。
//
// internal_info_flags は、リライト後の本文に内部限定情報が残っていないかの
// 安全弁チェックを兼ねる。除外できていれば present_in_rewrite=false
// （UI上は「除外済み」として参考表示）、リライト後にも残っていれば
// present_in_rewrite=true（UI上は「未確認」として、エクスポートをブロックする）。
//
// カテゴリに personal_privacy を追加した（要件の想定にはなかったが、実サンプルで
// 「支部の会議で新しく入党した個人（年代・家族との会話まで含む）」を紹介する
// 記事を確認したため。政党の党員であるという情報は個人情報保護法上の
// 要配慮個人情報にあたり、本人の明確な同意なく公開Webサイトに掲載すべきではない）。
//
// 【ユーザーフィードバックによる方針転換】当初のプロンプトは「内部限定情報を
// 削る」ことに寄りすぎており、実際に運用したところ、演説会でのペンライト演出
// など党の工夫・取り組みの具体的な描写までごっそり削られてしまう事例が発生した。
// これは要件の趣旨に反する（削るべきは党内の事務連絡・実績管理情報であって、
// 党の政治的立場や取り組みの中身ではない）。ユーザーからの指示：
// 「HPを見てくれるJCPサポーター、ボランティア、支援者のみなさんには必要な
// 情勢認識・情報を伝えるべき。いかに政権・市政がひどいか、そこに党と市議団が
// どれだけ奮闘しているかを伝えることを最大の目的として据え直す」という方針で
// 全面的に書き直した。

export const REWRITE_SYSTEM_PROMPT = `あなたは、政党の地区委員会・市委員会が発行する内部ニュースレターの記事を、一般公開向けのWebサイト掲載用記事にリライトするアシスタントです。

# このリライトの最大の目的
公式サイトの読者は、党を支持する人、ボランティア、後援会員など、党の活動に関心を持つ人たちです。彼らに伝えるべき最も重要な情報は次の2つです。

1. 政権・自治体の施策のどこが問題で、住民のくらしにどう影響しているかという情勢認識・政策への批判
2. その問題に対して、党と議員・議員団・候補者がどれだけ具体的に奮闘し、行動し、工夫しているか

当たり障りのない地域ニュースに薄めることが目的ではない。党の政治的な立場・主張・論評はそのまま維持し、支持を広げるための新しい取り組みの工夫（例: ペンライトを使った演出、トークライブ形式の演説会、SNSでの発信など）も、内部情報でない限り積極的に描写すること。これらは党が変化・工夫しようとしている証であり、隠す情報ではなく、むしろ伝えるべき情報である。省略・要約のしすぎで記事の熱量・具体性・主張の強さを失わせないこと。

# 削ってよいもの・削ってはいけないもの（重要な線引き）

**削ってよい（党内限定の事務連絡・組織運営情報）：**
- 党員数・読者数・募金到達率・党費納入率・支部別の拡大実績など、内部限定の具体的数値
- 「党員限定」等と明記された情報
- 支部長・地区委員長等の特定の役職者への内部連絡・作業指示（例:「〇〇を地区委員会に提出すること」「支部会議で読み合わせてください」）
- 特定の党員個人を識別しうる入党エピソード等の個人情報（personal_privacy として扱う。本人の同意が確認できない前提。地区役員も、議員・元議員・委員長以外は匿名とする）
- 党員・支部自身に行動を促す内輪の号令・決起表現そのもの（例:「入党の働きかけを何人達成しよう」「反転攻勢の一歩に」といった、読者である党員に向けた組織拡大の掛け声）

**削ってはいけない・むしろ活かすべき（一般読者に伝えるべき内容）：**
- 政権・都道府県・市区町村の施策に対する具体的な批判・論評（どの法案・政策のどこが問題で、住民のくらしをどう圧迫しているか）
- 議員・議員団・候補者の具体的な活動内容（議員・候補者・地区委員長・元議員の個人名、議会での質問、街頭演説、住民との対話、政策提案とその理由・背景）
- イベント・演説会等の開催内容の具体的な描写（規模、演出の工夫、参加者の反応など）。ペンライトのような演出の工夫は「党内の内輪ネタ」ではなく、党の活動の魅力・変化を伝える公開情報として扱う
- 党の政治的立場そのもの（憲法・平和・くらし・税制等に関する主張）。文体は整えるが、主張の中身を弱めたり、当たり障りのない表現に置き換えたりしない

判断の目安：「誰が・何人・どの支部が」という党内向けの実績管理の情報は削り、「何が問題で、党は何を訴え、何をしているか」という中身の情報は残す。迷ったら、内部の数値・氏名・指示に該当しない限り残す方向で判断すること。

# 文体
- 古臭い言い回しは、誠実で読みやすいネット向けニュース記事の文体に書き換える。ただし政治的な主張の強さ自体は弱めない。文体を整えるのであって、主張を薄めるのではない
- 党内専門用語・略語のうち、下記の「党内用語辞典」に載っていないものは、一般読者に分かるよう平易に言い換えるか、説明を補う（それでも分かりにくければ省略してよい）
- 事実関係（日時・場所・参加人数の概算・政策の内容・演出の工夫等）は、公開して問題ない範囲であれば具体的に維持する。数字を根拠なく変更しない

# 党内用語辞典の使い方
ユーザー側で管理する「党内用語辞典」が、この後の入力に「用語（説明）」の形で渡される場合がある。辞典に載っている用語が本文に含まれる場合は、削除・平易化するのではなく、解説を添えて残すこと。
- 記事内でその用語が最初に登場したときは「用語（説明）」の形にする（例: 辞典に 青本 → 『Q＆A 共産主義と自由』 とあれば、本文の「青本」は「青本（『Q＆A 共産主義と自由』）」にする）
- 同じ記事の中で同じ用語が2回目以降に登場する場合は、解説なしで用語だけを使ってよい（毎回説明を繰り返さない）
- 用語に「○」が含まれる場合、○は数字が入る部分を表す。本文中の実際の数字に置き換えて解説を組み立てる（例: 辞典に ○中総 → 第○回中央委員会総会 とあり、本文に「5中総」とあれば「5中総（第5回中央委員会総会）」にする）
- 辞典に載っていない党内用語は、この辞典の仕組みとは関係なく、上の「文体」の方針（平易に言い換える・省略する）に従う
- 辞典に載っていても、本文にその用語が実際には登場しない場合は無理に挿入しない

# 出力
必ず以下のJSONスキーマで出力してください（説明文は不要、JSONのみ）：

{
  "title_rewritten": string,
  "body_rewritten": string,
  "internal_info_flags": [
    {
      "quoted_text": string,          // body_rewritten 中に残っている問題箇所の引用。除外済みで body_rewritten に存在しない場合は元の本文からの引用
      "category": "membership_count" | "dues_rate" | "reader_count" | "fundraising_rate" | "internal_directive" | "member_only_label" | "personal_privacy" | "other",
      "reason": string,
      "present_in_rewrite": boolean   // true: body_rewritten にまだ残っており要確認。false: 除外済みで参考表示のみ
    }
  ]
}

internal_info_flags は、元の記事に含まれていた内部限定情報・個人情報の疑いがある箇所を漏れなく報告すること。除外に成功した箇所も present_in_rewrite: false として報告し、担当者が「何が除外されたか」を確認できるようにする。

# 担当者からの追加条件について
入力に「担当者からの追加条件」が含まれる場合、それは人が明示的に指定した指示であり、上記の一般的な方針より優先して反映すること（例:「この団体名は伏せて」「この部分は削らず残して」等）。ただし、追加条件がある場合でも internal_info_flags の報告（何が残り、何を除外したか）は省略せず必ず行うこと。`;

export interface GlossaryEntryInput {
  term: string;
  explanation: string;
}

export function buildRewriteUserPrompt(
  title: string,
  bodyText: string,
  targetSiteLabel: string,
  glossary: GlossaryEntryInput[] = [],
  condition?: string,
  isRevision = false
): string {
  const glossarySection =
    glossary.length > 0
      ? `\n\n党内用語辞典:\n${glossary.map((g) => `${g.term} → ${g.explanation}`).join("\n")}`
      : "";
  const conditionSection = condition ? `\n\n担当者からの追加条件:\n${condition}` : "";

  if (isRevision) {
    return `掲載先: ${targetSiteLabel}\n\n以下は、すでに一般公開向けにリライト済みの文章です。担当者からの追加条件（指示された修正）だけを反映し、指示されていない部分はできるだけそのまま維持してください。\n\n現在のタイトル: ${title}\n\n現在の本文:\n${bodyText}${glossarySection}${conditionSection}`;
  }
  return `掲載先: ${targetSiteLabel}\n\n元のタイトル: ${title}\n\n元の本文:\n${bodyText}${glossarySection}${conditionSection}`;
}

export interface InternalInfoFlagDraft {
  quoted_text: string;
  category:
    | "membership_count"
    | "dues_rate"
    | "reader_count"
    | "fundraising_rate"
    | "internal_directive"
    | "member_only_label"
    | "personal_privacy"
    | "other";
  reason: string;
  present_in_rewrite: boolean;
}

export interface RewriteResult {
  title_rewritten: string;
  body_rewritten: string;
  internal_info_flags: InternalInfoFlagDraft[];
}

// Tool Use（Structured Outputs）用スキーマ。理由は extract-page.ts 参照。
export const REWRITE_TOOL = {
  name: "submit_rewrite",
  description: "一般公開向けにリライトした記事を送信する",
  input_schema: {
    type: "object",
    required: ["title_rewritten", "body_rewritten", "internal_info_flags"],
    properties: {
      title_rewritten: { type: "string" },
      body_rewritten: { type: "string" },
      internal_info_flags: {
        type: "array",
        items: {
          type: "object",
          required: ["quoted_text", "category", "reason", "present_in_rewrite"],
          properties: {
            quoted_text: { type: "string" },
            category: {
              type: "string",
              enum: [
                "membership_count",
                "dues_rate",
                "reader_count",
                "fundraising_rate",
                "internal_directive",
                "member_only_label",
                "personal_privacy",
                "other",
              ],
            },
            reason: { type: "string" },
            present_in_rewrite: { type: "boolean" },
          },
        },
      },
    },
  },
} as const;

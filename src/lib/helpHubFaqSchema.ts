/**
 * Build schema.org FAQPage JSON-LD from a Help Hub tip's *visible* content.
 *
 * Rules (kept strict on purpose, for AEO/AI readability — not ranking promises):
 * - Only genuine, question-shaped Q&A pairs are included (the question text must
 *   end with "?"). We never invent questions or repeat marketing copy.
 * - Answers are stripped of HTML and normalised to plain text.
 * - FAQPage is only produced when there are at least 2 valid Q&A items.
 *
 * The extracted pairs must mirror what a visitor actually sees on the tip page:
 *   - hero question bubble + quick answer bubble (`question` + `bubbleAnswer`)
 *   - the "about/why" section heading + body (`aboutTitle` + `solutionText`/`bridge`)
 *   - the "try this" section heading + checklist (`tryThisTitle`/`tryThis.quickActionTitle` + `trySteps`)
 * Only the pairs whose heading is genuinely a question survive the filter.
 */

export type HelpHubFaqSource = {
  question?: unknown;
  title?: unknown;
  bubbleAnswer?: unknown;
  aboutTitle?: unknown;
  solutionText?: unknown;
  bridge?: unknown;
  tryThisTitle?: unknown;
  trySteps?: unknown;
  tryThis?: unknown;
};

export type FaqPair = { question: string; answer: string };

export type FaqPageJsonLd = {
  "@context": "https://schema.org";
  "@type": "FAQPage";
  mainEntity: {
    "@type": "Question";
    name: string;
    acceptedAnswer: { "@type": "Answer"; text: string };
  }[];
};

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Strip HTML tags, decode common entities, and collapse whitespace to plain text. */
export function stripHtmlToText(input: unknown): string {
  let s = asString(input);
  if (!s) return "";
  // Drop script/style blocks entirely (defensive; answers should not contain them).
  s = s.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ");
  // Turn block-level and line-break tags into spaces so words don't run together.
  s = s.replace(/<\/?(p|div|br|li|ul|ol|h[1-6]|section|tr|td|th|table)[^>]*>/gi, " ");
  // Remove any remaining tags.
  s = s.replace(/<[^>]+>/g, "");
  // Decode a small set of common entities.
  s = s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_m, dec) => {
      const code = Number(dec);
      return Number.isFinite(code) ? String.fromCodePoint(code) : "";
    });
  // Collapse all whitespace.
  return s.replace(/\s+/g, " ").trim();
}

function isQuestionLike(text: string): boolean {
  return text.length > 0 && text.endsWith("?");
}

function validTrySteps(steps: unknown): string[] {
  if (!Array.isArray(steps)) return [];
  return steps.filter(
    (step): step is string =>
      typeof step === "string" && step.trim() !== "" && step.trim() !== "...",
  );
}

/**
 * Extract genuine, question-shaped Q&A pairs from a Help Hub tip.
 * Every returned pair has a question ending in "?" and a non-empty plain-text answer.
 */
export function buildHelpHubFaqPairs(source: HelpHubFaqSource): FaqPair[] {
  const pairs: FaqPair[] = [];
  const seen = new Set<string>();

  const push = (questionRaw: string, answerRaw: string) => {
    const question = stripHtmlToText(questionRaw);
    const answer = stripHtmlToText(answerRaw);
    if (!question || !answer) return;
    if (!isQuestionLike(question)) return;
    const key = question.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    pairs.push({ question, answer });
  };

  // 1. Hero question bubble + quick answer bubble.
  push(asString(source.question) || asString(source.title), asString(source.bubbleAnswer));

  // 2. "About / Why this works" section (only when the heading is a real question).
  push(
    asString(source.aboutTitle),
    asString(source.solutionText) || asString(source.bridge),
  );

  // 3. "Try this" section (only when its heading is a real question).
  const tryThisObj =
    source.tryThis && typeof source.tryThis === "object"
      ? (source.tryThis as { quickActionTitle?: unknown })
      : null;
  const tryTitle =
    asString(source.tryThisTitle) || (tryThisObj ? asString(tryThisObj.quickActionTitle) : "");
  const steps = validTrySteps(source.trySteps);
  if (steps.length > 0) {
    push(tryTitle, steps.join(" "));
  }

  return pairs;
}

/**
 * Build a FAQPage JSON-LD object, or `null` when the tip has fewer than 2 valid Q&A items.
 */
export function buildHelpHubFaqPage(source: HelpHubFaqSource): FaqPageJsonLd | null {
  const pairs = buildHelpHubFaqPairs(source);
  if (pairs.length < 2) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: pairs.map((pair) => ({
      "@type": "Question",
      name: pair.question,
      acceptedAnswer: { "@type": "Answer", text: pair.answer },
    })),
  };
}

/**
 * Serialize JSON-LD for safe inlining inside a <script type="application/ld+json"> tag.
 * Escapes `<`, `>`, and `&` so a stray `</script>` in content cannot break out.
 */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/&/g, "\\u0026")
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e");
}

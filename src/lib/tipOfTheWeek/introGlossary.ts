/**
 * Split Tip of the Week intro copy so the first glossary mention becomes a
 * GlossaryTooltip, matching Skill Builder intro parts.
 *
 * The Watson `introGlossarySlug` field may be a /glossary/[slug] slug or a
 * phrase (for example "floats" or "public side"). Numeric glossary IDs are
 * not required.
 */
import glossaryData from "../../data/glossary.json";
import {
  glossarySlugFromEnglish,
  stripGlossaryTermHtml,
} from "../glossary/glossaryPickerCatalog";
import { slugify } from "../slugify";

type GlossaryRow = {
  glossaryId: number;
  english: string;
  active?: boolean;
};

const glossary: GlossaryRow[] = Array.isArray(glossaryData)
  ? (glossaryData as GlossaryRow[])
  : [];

export type TipOfTheWeekIntroPart =
  | { type: "text"; text: string }
  | { type: "glossary"; glossaryId: number; text: string };

function glossaryAliases(english: string): string[] {
  return stripGlossaryTermHtml(english)
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);
}

/** Resolve a Watson glossary slug or phrase to the matching glossary entry. */
export function resolveIntroGlossaryEntry(
  raw: string | null | undefined,
): { glossaryId: number; slug: string } | null {
  const value = (raw ?? "").trim();
  if (!value) return null;
  const inputSlug = slugify(value);
  if (!inputSlug) return null;

  const active = glossary.filter(
    (entry) => entry.active === true && typeof entry.glossaryId === "number",
  );

  const match =
    active.find((entry) => glossarySlugFromEnglish(entry.english ?? "") === inputSlug) ||
    active.find((entry) =>
      glossaryAliases(entry.english ?? "").some((alias) => slugify(alias) === inputSlug),
    ) ||
    active.find((entry) =>
      glossaryAliases(entry.english ?? "").some(
        (alias) => alias.toLowerCase() === value.toLowerCase(),
      ),
    );

  if (!match) return null;
  return {
    glossaryId: match.glossaryId,
    slug: glossarySlugFromEnglish(match.english ?? "") || inputSlug,
  };
}

function introSearchPhrases(raw: string): string[] {
  const trimmed = raw.trim();
  const phrases: string[] = [];
  const seen = new Set<string>();
  const add = (phrase: string) => {
    const next = phrase.trim();
    if (!next) return;
    const key = next.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    phrases.push(next);
  };
  add(trimmed);
  add(trimmed.replace(/-/g, " "));
  return phrases;
}

/**
 * Split the intro so only the first matching glossary mention becomes a tooltip.
 * Empty or unresolved glossary values leave the intro as plain text.
 */
export function tipOfTheWeekIntroParts(
  intro: string,
  glossaryValue?: string | null,
): TipOfTheWeekIntroPart[] {
  const text = intro ?? "";
  const value = (glossaryValue ?? "").trim();
  if (!value) {
    return text ? [{ type: "text", text }] : [];
  }

  const entry = resolveIntroGlossaryEntry(value);
  if (!entry) {
    return text ? [{ type: "text", text }] : [];
  }

  const lower = text.toLowerCase();
  let best: { index: number; length: number } | null = null;
  for (const phrase of introSearchPhrases(value)) {
    const index = lower.indexOf(phrase.toLowerCase());
    if (index < 0) continue;
    if (best === null || index < best.index) {
      best = { index, length: phrase.length };
    }
  }
  if (!best) {
    return text ? [{ type: "text", text }] : [];
  }

  const parts: TipOfTheWeekIntroPart[] = [];
  if (best.index > 0) {
    parts.push({ type: "text", text: text.slice(0, best.index) });
  }
  parts.push({
    type: "glossary",
    glossaryId: entry.glossaryId,
    text: text.slice(best.index, best.index + best.length),
  });
  const after = text.slice(best.index + best.length);
  if (after.length > 0) {
    parts.push({ type: "text", text: after });
  }
  return parts;
}

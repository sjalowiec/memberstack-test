import { getTipId } from "../helpHubAdminFile";
import { HELP_HUB_STATUSES, type HelpHubStatus, type HelpHubTipDocument, type HelpHubTipRecord, type HelpHubTipRow, type HelpHubWriteActor } from "./types";

export function isHelpHubStatus(value: string): value is HelpHubStatus {
  return (HELP_HUB_STATUSES as readonly string[]).includes(value);
}

export function helpHubActorLabel(actor: HelpHubWriteActor | null | undefined): string | null {
  const email = typeof actor?.email === "string" ? actor.email.trim() : "";
  if (email) return email;
  const id = typeof actor?.id === "string" ? actor.id.trim() : "";
  return id || null;
}

/** Keep numeric lesson ids as numbers; keep non-numeric refs as trimmed strings. */
export function normalizeRelatedLessonRefs(value: unknown): (string | number)[] {
  if (!Array.isArray(value)) return [];
  const out: (string | number)[] = [];
  for (const item of value) {
    if (typeof item === "number" && Number.isFinite(item)) {
      out.push(item);
      continue;
    }
    const text = String(item ?? "").trim();
    if (!text) continue;
    if (/^\d+$/.test(text)) {
      out.push(Number(text));
      continue;
    }
    out.push(text);
  }
  return out;
}

export function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asOptionalBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function asOptionalSortOrder(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = parseInt(value.trim(), 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function canonicalHelpHubDocument(doc: HelpHubTipDocument): HelpHubTipDocument {
  const copy: HelpHubTipDocument = { ...doc };
  delete copy.deletedAt;
  if (Object.prototype.hasOwnProperty.call(copy, "relatedLessons")) {
    copy.relatedLessons = normalizeRelatedLessonRefs(copy.relatedLessons);
  }
  return copy;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`).join(",")}}`;
}

export function documentsMatch(a: HelpHubTipDocument, b: HelpHubTipDocument): boolean {
  return stableStringify(canonicalHelpHubDocument(a)) === stableStringify(canonicalHelpHubDocument(b));
}

export function tipFromRow(row: HelpHubTipRow): HelpHubTipRecord {
  const raw =
    row.document && typeof row.document === "object" && !Array.isArray(row.document)
      ? { ...row.document }
      : {};
  const tip: HelpHubTipRecord = {
    ...raw,
    id: row.id,
    slug: row.slug,
    status: row.status,
  };
  if (row.deleted_at) {
    tip.deletedAt =
      row.deleted_at instanceof Date ? row.deleted_at.toISOString() : String(row.deleted_at);
  } else {
    delete tip.deletedAt;
  }
  return tip;
}

export type HelpHubInsertFields = {
  id: number;
  slug: string;
  status: HelpHubStatus;
  sortOrder: number | null;
  category: string | null;
  title: string;
  question: string;
  isNew: boolean | null;
  featured: boolean | null;
  document: HelpHubTipDocument;
};

export function fieldsFromTipDocument(
  tip: HelpHubTipDocument,
  required: { id: number; slug: string; status: HelpHubStatus; title: string; category: string },
): HelpHubInsertFields {
  const document = canonicalHelpHubDocument({
    ...tip,
    id: required.id,
    slug: required.slug,
    status: required.status,
  });
  if (required.title) document.title = required.title;
  if (required.category) document.category = required.category;
  else if (!Object.prototype.hasOwnProperty.call(tip, "category")) {
    delete document.category;
  }
  if (Object.prototype.hasOwnProperty.call(tip, "relatedLessons") || Array.isArray(document.relatedLessons)) {
    document.relatedLessons = normalizeRelatedLessonRefs(document.relatedLessons);
  }
  return {
    id: required.id,
    slug: required.slug,
    status: required.status,
    sortOrder: asOptionalSortOrder(document.sortOrder),
    category: required.category || null,
    title: required.title,
    question: asTrimmedString(document.question) || asTrimmedString(required.title),
    isNew: asOptionalBoolean(document.isNew),
    featured: asOptionalBoolean(document.featured),
    document,
  };
}

export function requireTipId(tip: HelpHubTipDocument): number {
  const id = getTipId(tip);
  if (id == null) {
    throw new Error("Help Hub tip is missing a numeric id.");
  }
  return id;
}

/**
 * Shared definition of the editable Machine Knitter's Bookshelf fields.
 *
 * This is the SINGLE source of truth for the editable book schema. It is used by:
 *  - form rendering (admin/bookshelf-editor.astro frontmatter)
 *  - the client editor (reading/writing form values, validation, preview)
 *  - the save API (src/pages/api/admin/bookshelf.ts) for normalization
 *
 * To add a new field in the future, add one entry to BOOK_FIELDS — the form,
 * validation, and save logic all pick it up automatically.
 *
 * The `id` field is intentionally NOT listed here: it is a special, read-only,
 * auto-generated stable key handled separately (see nextBookId / normalizeBookForSave).
 */

export type BookFieldKind = "text" | "textarea" | "tags" | "number";

export interface BookFieldDef {
  /** Property name in bookshelf.json and the form control name. */
  key: string;
  /** Visible label in the editor. */
  label: string;
  kind: BookFieldKind;
  /** Render full-width across the 2-column grid. */
  full?: boolean;
  /** Must be non-empty on save (validated generically). */
  required?: boolean;
  /** Blank values save as null instead of "" / 0. */
  nullable?: boolean;
  /** Optional helper text shown under the control (may contain limited HTML). */
  hint?: string;
  placeholder?: string;
  rows?: number;
  min?: number;
  max?: number;
  step?: number;
  /** When set, render a "Copy from <key>" helper button (e.g. thumbnail ← image). */
  copyFromKey?: string;
}

export const BOOK_FIELDS: BookFieldDef[] = [
  {
    key: "title",
    label: "title",
    kind: "text",
    full: true,
    required: true,
  },
  {
    key: "author",
    label: "author",
    kind: "text",
    full: true,
  },
  {
    key: "year",
    label: "year",
    kind: "text",
    nullable: true,
    placeholder: "(blank = none)",
    hint: "Saved as null when blank.",
  },
  {
    key: "topic",
    label: "topic",
    kind: "text",
    full: true,
  },
  {
    key: "url",
    label: "url (purchase / info link)",
    kind: "text",
    full: true,
    placeholder: "https://…",
  },
  {
    key: "image",
    label: "image (cover path)",
    kind: "text",
    full: true,
    placeholder: "/images/books/…",
  },
  {
    key: "thumbnail",
    label: "thumbnail (cover path)",
    kind: "text",
    full: true,
    placeholder: "/images/books/…",
    copyFromKey: "image",
    hint: "These are usually the same path.",
  },
  {
    key: "tags",
    label: "tags (one per line, or comma-separated)",
    kind: "tags",
    full: true,
    rows: 4,
    placeholder: "Techniques\nPatterns",
    hint: 'Always saved as an array. Blanks and "null"/"undefined" entries are dropped; duplicates are removed.',
  },
  {
    key: "description",
    label: "description (HTML allowed)",
    kind: "textarea",
    full: true,
    rows: 5,
  },
  {
    key: "descriptionText",
    label: "descriptionText (plain text, for search)",
    kind: "textarea",
    full: true,
    rows: 4,
  },
  {
    key: "avgRating",
    label: "avgRating",
    kind: "number",
    nullable: true,
    min: 0,
    max: 5,
    step: 0.1,
    hint: "Blank = null (not yet rated).",
  },
  {
    key: "ratingCount",
    label: "ratingCount",
    kind: "number",
    nullable: true,
    min: 0,
    step: 1,
    hint: "Blank = null.",
  },
];

export function asString(v: unknown): string {
  if (typeof v === "string") return v;
  if (v === null || v === undefined) return "";
  return String(v);
}

/** Treat literal "null"/"undefined"/empty as blank (case-insensitive). */
export function isBlankish(value: string): boolean {
  const low = value.trim().toLowerCase();
  return low === "" || low === "null" || low === "undefined";
}

/**
 * Tags ALWAYS normalize to an array (never null). Accepts an array or a string
 * (split on newlines/commas), trims each entry, drops blanks and obvious
 * "null"/"undefined" placeholders, and de-dupes case-insensitively.
 */
export function normalizeTags(v: unknown): string[] {
  let items: unknown[];
  if (Array.isArray(v)) items = v;
  else if (typeof v === "string") items = v.split(/[\n,]/);
  else if (v === null || v === undefined) items = [];
  else items = [v];

  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (item === null || item === undefined) continue;
    const tag = String(item).trim();
    if (isBlankish(tag)) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
  }
  return out;
}

/**
 * Normalize a single field's raw value (string from a form control, or an
 * existing JSON value) into its stored representation, per the field's kind.
 */
export function normalizeFieldValue(field: BookFieldDef, raw: unknown): unknown {
  switch (field.kind) {
    case "tags":
      return normalizeTags(raw);
    case "number": {
      const s = asString(raw).trim();
      if (s === "") return field.nullable ? null : 0;
      const n = Number(s);
      if (!Number.isFinite(n)) return field.nullable ? null : 0;
      return n;
    }
    case "textarea": {
      const s = asString(raw);
      if (field.nullable && isBlankish(s)) return null;
      return s;
    }
    case "text":
    default: {
      const s = asString(raw).trim();
      if (field.nullable && isBlankish(s)) return null;
      return s;
    }
  }
}

/** Highest existing numeric id + 1, as a string. Non-numeric ids are ignored. */
export function nextBookId(books: Array<Record<string, unknown>>): string {
  let max = 0;
  for (const b of books) {
    const n = parseInt(asString(b?.id), 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return String(max + 1);
}

export type NormalizeBookResult =
  | { ok: true; book: Record<string, unknown> }
  | { ok: false; error: string };

/**
 * Validate + normalize one raw book record for saving. Unknown extra fields are
 * preserved so nothing is silently dropped. `id` and any `required` field must
 * be non-empty.
 */
export function normalizeBookForSave(raw: unknown, index: number): NormalizeBookResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: `Book ${index + 1} is not an object.` };
  }
  const r = raw as Record<string, unknown>;

  const id = asString(r.id).trim();
  if (!id) {
    return { ok: false, error: `Book ${index + 1}: id is required and cannot be blank.` };
  }

  const book: Record<string, unknown> = { ...r };
  book.id = id;

  for (const field of BOOK_FIELDS) {
    const value = normalizeFieldValue(field, r[field.key]);
    if (field.required) {
      const str = typeof value === "string" ? value.trim() : asString(value).trim();
      if (!str) {
        return {
          ok: false,
          error: `Book ${index + 1} (id ${id}): ${field.key} is required and cannot be blank.`,
        };
      }
    }
    book[field.key] = value;
  }

  return { ok: true, book };
}

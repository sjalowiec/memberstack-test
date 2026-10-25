import { changedCatalogFields, videoContentIdKey } from "./videoPosterOverrides";

export const HOSTED_CATALOG_SAVE_ERROR =
  "This save would change the video catalog in src/data/videos-public.json. The hosted site cannot update that file, and thumbnail storage only keeps pictures, so nothing was saved.";

/**
 * Hosted Netlify (including kin-dev) serves a deployed copy of the catalog file.
 * A function write there does not update the repo or the next deploy.
 * Local `astro dev` and `netlify dev` can update the workspace file.
 */
export function videoCatalogFileSaveBlocker(env: NodeJS.ProcessEnv = process.env): string | null {
  if (env.NETLIFY === "true" && env.NETLIFY_DEV !== "true") return HOSTED_CATALOG_SAVE_ERROR;
  return null;
}

type CatalogSplit = {
  newline: "\n" | "\r\n";
  separators: string[];
  objects: string[];
};

export type CatalogTextUpdate =
  | {
      ok: true;
      text: string;
      added: string[];
      updated: string[];
      deleted: string[];
    }
  | { ok: false; error: string };

function contentIdOf(video: Record<string, unknown>): string {
  return videoContentIdKey(video.content_id);
}

function endOfJsonObject(raw: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < raw.length; i += 1) {
    const ch = raw[i];
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

export function splitCatalogObjects(raw: string): CatalogSplit | { error: string } {
  const newline: "\n" | "\r\n" = raw.includes("\r\n") ? "\r\n" : "\n";
  let i = 0;
  while (i < raw.length && /\s/.test(raw[i])) i += 1;
  if (raw[i] !== "[") return { error: "Catalog file must be a JSON array." };
  i += 1;
  const separators: string[] = [];
  const objects: string[] = [];
  let sepStart = 0;
  while (i < raw.length) {
    while (i < raw.length && /\s/.test(raw[i])) i += 1;
    if (i >= raw.length) return { error: "Catalog file ended before the array closed." };
    if (raw[i] === "]") {
      i += 1;
      while (i < raw.length && /\s/.test(raw[i])) i += 1;
      separators.push(raw.slice(sepStart));
      if (i !== raw.length) return { error: "Unexpected text after the catalog array." };
      return { newline, separators, objects };
    }
    if (raw[i] === ",") {
      i += 1;
      continue;
    }
    if (raw[i] !== "{") return { error: "Catalog array items must be objects." };
    const start = i;
    const end = endOfJsonObject(raw, i);
    if (end < 0) return { error: "A catalog record is not valid JSON." };
    separators.push(raw.slice(sepStart, start));
    objects.push(raw.slice(start, end));
    i = end;
    sepStart = i;
  }
  return { error: "Catalog file ended before the array closed." };
}

function joinCatalog(split: CatalogSplit): string {
  let out = split.separators[0] ?? "";
  for (let index = 0; index < split.objects.length; index += 1) {
    out += split.objects[index] + (split.separators[index + 1] ?? "");
  }
  return out;
}

function formatCatalogRecord(record: Record<string, unknown>, newline: "\n" | "\r\n"): string {
  const lines = JSON.stringify(record, null, 2).split("\n");
  const indented = lines.map((line, index) => (index === 0 ? line : `  ${line}`)).join("\n");
  return newline === "\r\n" ? indented.replace(/\n/g, "\r\n") : indented;
}

function deleteCatalogObject(split: CatalogSplit, index: number) {
  if (split.objects.length === 1) {
    split.objects = [];
    split.separators = [`[${split.newline}]${split.newline}`];
    return;
  }
  if (index === 0) {
    split.objects.splice(0, 1);
    split.separators.splice(1, 1);
    return;
  }
  split.objects.splice(index, 1);
  split.separators.splice(index, 1);
}

function appendCatalogObject(split: CatalogSplit, text: string) {
  const nl = split.newline;
  if (split.objects.length === 0) {
    split.separators = [`[${nl}  `, `${nl}]${nl}`];
    split.objects = [text];
    return;
  }
  const closing = split.separators[split.separators.length - 1] ?? `${nl}]${nl}`;
  split.separators[split.separators.length - 1] = `,${nl}  `;
  split.separators.push(closing);
  split.objects.push(text);
}

type RowEdit =
  | { op: "keep"; sourceIndex: number }
  | { op: "replace"; sourceIndex: number; record: Record<string, unknown>; id: string }
  | { op: "delete"; sourceIndex: number; id: string }
  | { op: "append"; record: Record<string, unknown>; id: string };

function posterValue(video: Record<string, unknown>): string {
  return typeof video.posterUrl === "string" ? video.posterUrl.trim() : "";
}

/** Copy only fields that actually changed onto the original record. */
function recordToStore(source: Record<string, unknown>, submitted: Record<string, unknown>): Record<string, unknown> {
  const changes = changedCatalogFields(source, submitted);
  const next: Record<string, unknown> = { ...source };
  if (changes.ok) {
    for (const field of changes.fields) {
      if (submitted[field] === undefined) delete next[field];
      else next[field] = submitted[field];
    }
  }
  const submittedPoster = posterValue(submitted);
  if (submittedPoster !== posterValue(source)) {
    if (submittedPoster) next.posterUrl = submittedPoster;
    else delete next.posterUrl;
  }
  return next;
}

function planRowEdits(
  source: Record<string, unknown>[],
  submitted: Record<string, unknown>[],
): { ok: true; edits: RowEdit[] } | { ok: false; error: string } {
  const sourceIds: string[] = [];
  const sourceById = new Map<string, number>();
  for (let index = 0; index < source.length; index += 1) {
    const id = contentIdOf(source[index]);
    if (!id) return { ok: false, error: "A catalog video is missing a video number, so nothing was saved." };
    if (sourceById.has(id)) {
      return { ok: false, error: `Video number ${id} appears more than once, so nothing was saved.` };
    }
    sourceById.set(id, index);
    sourceIds.push(id);
  }

  const submittedById = new Map<string, Record<string, unknown>>();
  const submittedIds: string[] = [];
  for (const row of submitted) {
    const id = contentIdOf(row);
    if (!id) return { ok: false, error: "A video is missing a video number, so nothing was saved." };
    if (submittedById.has(id)) {
      return { ok: false, error: `Video number ${id} appears more than once, so nothing was saved.` };
    }
    submittedById.set(id, row);
    submittedIds.push(id);
  }

  const sourceOnly = sourceIds.filter((id) => !submittedById.has(id));
  const submittedOnly = submittedIds.filter((id) => !sourceById.has(id));
  const inPlaceNumberChange =
    source.length === submitted.length && sourceOnly.length === 1 && submittedOnly.length === 1;
  const replacedSourceIndex = inPlaceNumberChange ? sourceById.get(sourceOnly[0]) ?? -1 : -1;
  const replacement = inPlaceNumberChange ? submittedById.get(submittedOnly[0]) : undefined;

  const edits: RowEdit[] = [];
  for (let index = 0; index < source.length; index += 1) {
    const id = sourceIds[index];
    if (!submittedById.has(id)) {
      if (index === replacedSourceIndex && replacement) {
        edits.push({
          op: "replace",
          sourceIndex: index,
          record: recordToStore(source[index], replacement),
          id: submittedOnly[0],
        });
      } else {
        edits.push({ op: "delete", sourceIndex: index, id });
      }
      continue;
    }
    const next = submittedById.get(id)!;
    const changes = changedCatalogFields(source[index], next);
    if (!changes.ok) return changes;
    if (changes.fields.length > 0) {
      edits.push({ op: "replace", sourceIndex: index, record: recordToStore(source[index], next), id });
    }
    else edits.push({ op: "keep", sourceIndex: index });
  }
  if (!inPlaceNumberChange) {
    for (const id of submittedOnly) {
      const record = submittedById.get(id);
      if (record) edits.push({ op: "append", record, id });
    }
  }
  return { ok: true, edits };
}

/**
 * Rewrite only added, edited, or removed records. Every other record stays
 * byte-for-byte, including the catalog file's line endings.
 */
export function updateCatalogText(
  raw: string,
  source: Record<string, unknown>[],
  submitted: Record<string, unknown>[],
): CatalogTextUpdate {
  const split = splitCatalogObjects(raw);
  if ("error" in split) return { ok: false, error: `${split.error} Nothing was saved.` };
  if (split.objects.length !== source.length) {
    return {
      ok: false,
      error: "The catalog file could not be aligned with its records, so nothing was saved.",
    };
  }
  for (let index = 0; index < source.length; index += 1) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(split.objects[index]);
    } catch {
      return { ok: false, error: "A catalog record could not be read, so nothing was saved." };
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, error: "A catalog record could not be read, so nothing was saved." };
    }
    if (contentIdOf(parsed as Record<string, unknown>) !== contentIdOf(source[index])) {
      return {
        ok: false,
        error: "The catalog file could not be aligned with its records, so nothing was saved.",
      };
    }
  }

  const planned = planRowEdits(source, submitted);
  if (!planned.ok) return planned;

  const added: string[] = [];
  const updated: string[] = [];
  const deleted: string[] = [];
  const deleteIndexes: number[] = [];
  for (const edit of planned.edits) {
    if (edit.op === "replace") {
      split.objects[edit.sourceIndex] = formatCatalogRecord(edit.record, split.newline);
      updated.push(edit.id);
    } else if (edit.op === "delete") {
      deleteIndexes.push(edit.sourceIndex);
      deleted.push(edit.id);
    } else if (edit.op === "append") {
      appendCatalogObject(split, formatCatalogRecord(edit.record, split.newline));
      added.push(edit.id);
    }
  }
  if (deleted.length > 1) {
    return {
      ok: false,
      error: `This save would remove ${deleted.length} videos, so nothing was saved.`,
    };
  }

  deleteIndexes.sort((a, b) => b - a);
  for (const index of deleteIndexes) deleteCatalogObject(split, index);

  return { ok: true, text: joinCatalog(split), added, updated, deleted };
}

export function catalogSaveMessage(update: Extract<CatalogTextUpdate, { ok: true }>): string {
  const parts: string[] = [];
  if (update.added.length) parts.push(`Added video ${update.added.join(", ")}`);
  if (update.updated.length) parts.push(`Updated video ${update.updated.join(", ")}`);
  if (update.deleted.length) parts.push(`Removed video ${update.deleted.join(", ")}`);
  const lead = parts.length ? `${parts.join(". ")}.` : "Saved.";
  return `${lead} The change is in src/data/videos-public.json.`;
}

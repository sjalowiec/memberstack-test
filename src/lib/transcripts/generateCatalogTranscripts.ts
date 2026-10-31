/**
 * Build deterministic public and member transcript JSON from the VTT
 * sources in `src/data/transcripts/en/`. Uses the existing VTT parser.
 * Does not read or write `public/`.
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

import { vimeoNumericIdFromPublicVideo, type PublicVideoRow } from "../lessonVideo";
import { catalogVideoPlaybackAccess } from "../videos/catalogVideoPlaybackAccess";
import { catalogVideoIsPublic } from "../videoPublic";
import {
  CATALOG_TRANSCRIPT_GENERATOR,
  type CatalogTranscriptAccess,
  type CatalogTranscriptArtifact,
  type CatalogTranscriptRecord,
} from "./catalogTranscriptData";
import {
  englishTranscriptParagraphs,
  readableEnglishTranscriptForVimeoId,
  vimeoIdFromTranscriptFilename,
} from "./englishTranscript";

export const PUBLIC_TRANSCRIPT_RELATIVE = "src/data/transcripts/generated/public.json";
export const MEMBER_TRANSCRIPT_RELATIVE = "src/data/transcripts/generated/member.json";
export const TRANSCRIPT_AUDIT_RELATIVE = "src/data/transcripts/generated/audit.json";

export type CatalogTranscriptAuditRecord = {
  vimeoId: string;
  access: CatalogTranscriptAccess;
  sourceFile: string;
  sourceSha256: string;
  paragraphCount: number;
  contentIds: string[];
};

export type CatalogTranscriptAudit = {
  generator: typeof CATALOG_TRANSCRIPT_GENERATOR;
  kind: "audit";
  sourceDirectory: string;
  publicCount: number;
  memberCount: number;
  records: CatalogTranscriptAuditRecord[];
  duplicatePublishedRows: Array<{ vimeoId: string; contentIds: string[] }>;
};

export type CatalogTranscriptDocuments = {
  publicDocument: CatalogTranscriptArtifact;
  memberDocument: CatalogTranscriptArtifact;
  audit: CatalogTranscriptAudit;
};

type SourceGroup = {
  vimeoId: string;
  name: string;
  text: string;
  sha256: string;
};

function compareIds(a: string, b: string): number {
  if (a.length !== b.length) return a.length - b.length;
  return a < b ? -1 : a > b ? 1 : 0;
}

function pageLookupId(row: PublicVideoRow): string {
  const raw = row.vimeo_id_public ?? row.vimeo_id;
  if (raw == null) return "";
  const value = String(raw).trim();
  return /^\d+$/.test(value) ? value : "";
}

function functionLookupId(row: PublicVideoRow): string {
  return vimeoNumericIdFromPublicVideo(row) ?? pageLookupId(row);
}

/** The Vimeo ID a catalog row's transcript is stored under, or "" when it has none. */
export function catalogTranscriptVimeoId(row: PublicVideoRow): string {
  return functionLookupId(row) || pageLookupId(row);
}

function contentId(row: PublicVideoRow): string {
  return String(row.content_id ?? "").trim();
}

/**
 * Hash and parse a newline-stable copy of the VTT bytes.
 * Git stores these files as LF. Windows checkout with autocrlf turns them
 * into CRLF, so hashing the raw working-tree bytes does not match Linux.
 */
function canonicalTranscriptSource(bytes: Buffer): { text: string; sha256: string } {
  const canonical = Buffer.alloc(bytes.length);
  let length = 0;
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];
    if (byte === 0x0d) {
      if (bytes[i + 1] === 0x0a) i += 1;
      canonical[length] = 0x0a;
      length += 1;
      continue;
    }
    canonical[length] = byte;
    length += 1;
  }
  const normalized = canonical.subarray(0, length);
  return {
    text: normalized.toString("utf8"),
    sha256: createHash("sha256").update(normalized).digest("hex"),
  };
}

/** LF-only bytes of a VTT, the same bytes the generator hashes. */
export function canonicalTranscriptBytes(bytes: Buffer): Buffer {
  return Buffer.from(canonicalTranscriptSource(bytes).text, "utf8");
}

export type TranscriptSourceFile = {
  name: string;
  bytes: Buffer;
};

function readSourceFiles(sourceDir: string): TranscriptSourceFile[] {
  let names: string[];
  try {
    names = readdirSync(sourceDir);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Cannot read transcript source directory ${sourceDir}: ${message}`);
  }
  return names
    .filter((name) => name.toLowerCase().endsWith(".vtt"))
    .map((name) => ({ name, bytes: readFileSync(join(sourceDir, name)) }));
}

function groupSourceFiles(files: TranscriptSourceFile[]): SourceGroup[] {
  const byId = new Map<string, SourceGroup[]>();
  for (const file of files.slice().sort((a, b) => a.name.localeCompare(b.name))) {
    const name = file.name;
    if (!name.toLowerCase().endsWith(".vtt")) continue;
    const vimeoId = vimeoIdFromTranscriptFilename(name);
    if (!vimeoId) {
      throw new Error(`Unusable transcript filename ${name}. Expected <vimeoId>.vtt or <vimeoId>_en.vtt.`);
    }
    const source = canonicalTranscriptSource(file.bytes);
    const group = byId.get(vimeoId) ?? [];
    group.push({
      vimeoId,
      name,
      text: source.text,
      sha256: source.sha256,
    });
    byId.set(vimeoId, group);
  }

  const chosen: SourceGroup[] = [];
  for (const [vimeoId, group] of byId) {
    const hashes = new Set(group.map((file) => file.sha256));
    if (hashes.size > 1) {
      throw new Error(
        `Vimeo ${vimeoId} has differing English VTT files: ${group.map((file) => file.name).join(", ")}.`,
      );
    }
    const preferred =
      group.find((file) => !/-us\.vtt$/i.test(file.name)) ??
      group.slice().sort((a, b) => a.name.localeCompare(b.name))[0];
    chosen.push(preferred);
  }
  chosen.sort((a, b) => compareIds(a.vimeoId, b.vimeoId));
  return chosen;
}

/** Published catalog rows grouped by the Vimeo ID the generator keys on. */
function publishedRowsByVimeoId(catalog: PublicVideoRow[]): Map<string, PublicVideoRow[]> {
  const published = catalog.filter((row) => catalogVideoIsPublic(row));
  const rowsById = new Map<string, PublicVideoRow[]>();
  for (const row of published) {
    const pageId = pageLookupId(row);
    const embedId = functionLookupId(row);
    if (pageId && embedId && pageId !== embedId) {
      throw new Error(
        `Published content ${contentId(row) || "(missing id)"} has different page and function Vimeo ids (${pageId} and ${embedId}).`,
      );
    }
    const id = embedId || pageId;
    if (!id) continue;
    const list = rowsById.get(id) ?? [];
    list.push(row);
    rowsById.set(id, list);
  }
  return rowsById;
}

type TranscriptEntry = {
  access: CatalogTranscriptAccess;
  record: CatalogTranscriptRecord;
  audit: CatalogTranscriptAuditRecord;
};

function transcriptEntryForSource(
  source: SourceGroup,
  rowsById: Map<string, PublicVideoRow[]>,
): TranscriptEntry {
  const readable = readableEnglishTranscriptForVimeoId(source.vimeoId, {
    [source.name]: source.text,
  });
  const paragraphs = englishTranscriptParagraphs(readable);
  if (!readable || paragraphs.length === 0) {
    throw new Error(`Unusable transcript ${source.name} for Vimeo ${source.vimeoId}.`);
  }
  const rows = rowsById.get(source.vimeoId) ?? [];
  if (rows.length === 0) {
    throw new Error(
      `Vimeo ${source.vimeoId} (${source.name}) is not a published catalog video.`,
    );
  }
  const accesses = new Set(rows.map((row) => catalogVideoPlaybackAccess(row)));
  if (accesses.size !== 1) {
    throw new Error(`Vimeo ${source.vimeoId} is both public and member in the published catalog.`);
  }
  const access: CatalogTranscriptAccess = accesses.has("open") ? "public" : "member";
  const contentIds = rows.map(contentId).filter(Boolean).sort(compareIds);
  const record: CatalogTranscriptRecord = {
    vimeoId: source.vimeoId,
    sourceFile: basename(source.name),
    sourceSha256: source.sha256,
    paragraphs,
  };
  return {
    access,
    record,
    audit: {
      vimeoId: source.vimeoId,
      access,
      sourceFile: record.sourceFile,
      sourceSha256: record.sourceSha256,
      paragraphCount: paragraphs.length,
      contentIds,
    },
  };
}

function assembleDocuments(
  entries: TranscriptEntry[],
  sourceDirectoryLabel: string,
): CatalogTranscriptDocuments {
  const sorted = entries.slice().sort((a, b) => compareIds(a.record.vimeoId, b.record.vimeoId));
  const publicRecords = sorted.filter((entry) => entry.access === "public").map((entry) => entry.record);
  const memberRecords = sorted.filter((entry) => entry.access === "member").map((entry) => entry.record);
  const auditRecords = sorted.map((entry) => entry.audit);

  const duplicatePublishedRows = auditRecords
    .filter((record) => record.contentIds.length > 1)
    .map((record) => ({ vimeoId: record.vimeoId, contentIds: record.contentIds }));

  return {
    publicDocument: {
      generator: CATALOG_TRANSCRIPT_GENERATOR,
      kind: "public",
      records: publicRecords,
    },
    memberDocument: {
      generator: CATALOG_TRANSCRIPT_GENERATOR,
      kind: "member",
      records: memberRecords,
    },
    audit: {
      generator: CATALOG_TRANSCRIPT_GENERATOR,
      kind: "audit",
      sourceDirectory: sourceDirectoryLabel,
      publicCount: publicRecords.length,
      memberCount: memberRecords.length,
      records: auditRecords,
      duplicatePublishedRows,
    },
  };
}

export function buildCatalogTranscriptDocuments(input: {
  sourceDir?: string;
  /** Source files in place of `sourceDir`, for callers without a checkout. */
  sources?: TranscriptSourceFile[];
  catalog: PublicVideoRow[];
  sourceDirectoryLabel?: string;
}): CatalogTranscriptDocuments {
  const rowsById = publishedRowsByVimeoId(input.catalog);
  const files = input.sources ?? readSourceFiles(input.sourceDir ?? "");
  const entries = groupSourceFiles(files).map((source) => transcriptEntryForSource(source, rowsById));
  return assembleDocuments(entries, input.sourceDirectoryLabel ?? "src/data/transcripts/en");
}

/**
 * Rebuild only the given Vimeo IDs inside existing generated documents.
 * `affected` maps each Vimeo ID to its English source files after the change
 * (an empty list removes that ID). Every other record is kept as is, so the
 * result matches a full run when the other sources did not change.
 */
export function updateCatalogTranscriptDocuments(input: {
  documents: CatalogTranscriptDocuments;
  catalog: PublicVideoRow[];
  affected: Map<string, TranscriptSourceFile[]>;
}): CatalogTranscriptDocuments {
  const rowsById = publishedRowsByVimeoId(input.catalog);
  const { publicDocument, memberDocument, audit } = input.documents;
  const recordsById = new Map<string, CatalogTranscriptRecord>();
  for (const record of [...publicDocument.records, ...memberDocument.records]) {
    recordsById.set(record.vimeoId, record);
  }

  const entries: TranscriptEntry[] = [];
  for (const auditRecord of audit.records) {
    if (input.affected.has(auditRecord.vimeoId)) continue;
    const record = recordsById.get(auditRecord.vimeoId);
    if (!record) {
      throw new Error(`Generated transcripts are missing Vimeo ${auditRecord.vimeoId}. Regenerate them first.`);
    }
    entries.push({ access: auditRecord.access, record, audit: auditRecord });
  }

  for (const [vimeoId, files] of input.affected) {
    for (const source of groupSourceFiles(files)) {
      if (source.vimeoId !== vimeoId) {
        throw new Error(`Transcript ${source.name} does not belong to Vimeo ${vimeoId}.`);
      }
      entries.push(transcriptEntryForSource(source, rowsById));
    }
  }

  return assembleDocuments(entries, audit.sourceDirectory);
}

export function serializeCatalogTranscriptJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function idsInDocument(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  const records = (value as { records?: unknown }).records;
  if (!Array.isArray(records)) return [];
  return records
    .map((record) => {
      if (!record || typeof record !== "object") return "";
      return String((record as { vimeoId?: unknown }).vimeoId ?? "");
    })
    .filter(Boolean);
}

/**
 * Refuse to replace a generated file that contains Vimeo IDs this run would
 * drop, or that was not produced by this generator.
 */
export function assertSafeTranscriptOverwrite(
  label: string,
  existingRaw: string | null,
  nextIds: string[],
): void {
  if (existingRaw == null) return;
  let parsed: unknown;
  try {
    parsed = JSON.parse(existingRaw);
  } catch {
    throw new Error(`${label} is not valid JSON. Refusing to overwrite it.`);
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error(`${label} is not a generated transcript document. Refusing to overwrite it.`);
  }
  const generator = (parsed as { generator?: unknown }).generator;
  if (generator !== CATALOG_TRANSCRIPT_GENERATOR) {
    throw new Error(
      `${label} was not produced by ${CATALOG_TRANSCRIPT_GENERATOR}. Refusing to overwrite it.`,
    );
  }
  const next = new Set(nextIds);
  const unexpected = idsInDocument(parsed).filter((id) => !next.has(id));
  if (unexpected.length > 0) {
    throw new Error(
      `${label} contains unexpected Vimeo IDs (${unexpected.join(", ")}). Refusing to overwrite it.`,
    );
  }
}

export type TranscriptFreshnessIssue = {
  file: string;
  detail: string;
};

export function transcriptFreshnessIssues(
  file: string,
  existingRaw: string | null,
  nextRaw: string,
): TranscriptFreshnessIssue[] {
  if (existingRaw == null) return [{ file, detail: "missing" }];
  if (existingRaw === nextRaw) return [];
  let existingIds: string[] = [];
  let nextIds: string[] = [];
  try {
    existingIds = idsInDocument(JSON.parse(existingRaw));
    nextIds = idsInDocument(JSON.parse(nextRaw));
  } catch {
    return [{ file, detail: "not valid generated JSON" }];
  }
  const next = new Set(nextIds);
  const existing = new Set(existingIds);
  const unexpected = existingIds.filter((id) => !next.has(id));
  const added = nextIds.filter((id) => !existing.has(id));
  const details = [
    unexpected.length ? `unexpected ids ${unexpected.join(", ")}` : "",
    added.length ? `missing ids ${added.join(", ")}` : "",
    unexpected.length === 0 && added.length === 0 ? "source hash or paragraphs changed" : "",
  ].filter(Boolean);
  return [{ file, detail: details.join("; ") || "stale" }];
}

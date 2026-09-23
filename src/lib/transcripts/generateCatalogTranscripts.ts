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

function contentId(row: PublicVideoRow): string {
  return String(row.content_id ?? "").trim();
}

function readSourceGroups(sourceDir: string): SourceGroup[] {
  const byId = new Map<string, SourceGroup[]>();
  let names: string[];
  try {
    names = readdirSync(sourceDir);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Cannot read transcript source directory ${sourceDir}: ${message}`);
  }
  for (const name of names.slice().sort((a, b) => a.localeCompare(b))) {
    if (!name.toLowerCase().endsWith(".vtt")) continue;
    const vimeoId = vimeoIdFromTranscriptFilename(name);
    if (!vimeoId) {
      throw new Error(`Unusable transcript filename ${name}. Expected <vimeoId>.vtt or <vimeoId>_en.vtt.`);
    }
    const bytes = readFileSync(join(sourceDir, name));
    const group = byId.get(vimeoId) ?? [];
    group.push({
      vimeoId,
      name,
      text: bytes.toString("utf8"),
      sha256: createHash("sha256").update(bytes).digest("hex"),
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

export function buildCatalogTranscriptDocuments(input: {
  sourceDir: string;
  catalog: PublicVideoRow[];
  sourceDirectoryLabel?: string;
}): CatalogTranscriptDocuments {
  const published = input.catalog.filter((row) => catalogVideoIsPublic(row));
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

  const publicRecords: CatalogTranscriptRecord[] = [];
  const memberRecords: CatalogTranscriptRecord[] = [];
  const auditRecords: CatalogTranscriptAuditRecord[] = [];

  for (const source of readSourceGroups(input.sourceDir)) {
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
    if (access === "public") publicRecords.push(record);
    else memberRecords.push(record);
    auditRecords.push({
      vimeoId: source.vimeoId,
      access,
      sourceFile: record.sourceFile,
      sourceSha256: record.sourceSha256,
      paragraphCount: paragraphs.length,
      contentIds,
    });
  }

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
      sourceDirectory: input.sourceDirectoryLabel ?? "src/data/transcripts/en",
      publicCount: publicRecords.length,
      memberCount: memberRecords.length,
      records: auditRecords,
      duplicatePublishedRows,
    },
  };
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

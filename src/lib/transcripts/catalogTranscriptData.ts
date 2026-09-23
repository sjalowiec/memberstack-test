/**
 * Shape of the generated catalog transcript JSON.
 * Callers pass either the public or the member artifact.
 * This module does not import either file.
 */

export const CATALOG_TRANSCRIPT_GENERATOR = "catalog-transcripts";

export type CatalogTranscriptAccess = "public" | "member";

export type CatalogTranscriptRecord = {
  vimeoId: string;
  sourceFile: string;
  sourceSha256: string;
  paragraphs: string[];
};

export type CatalogTranscriptArtifact = {
  generator: typeof CATALOG_TRANSCRIPT_GENERATOR;
  kind: CatalogTranscriptAccess;
  records: CatalogTranscriptRecord[];
};

export function paragraphsForVimeoId(
  artifact: { records?: Array<{ vimeoId?: string; paragraphs?: unknown }> } | null | undefined,
  vimeoId: string | number | null | undefined,
): string[] {
  const id = String(vimeoId ?? "").trim();
  if (!/^\d+$/.test(id) || !artifact?.records) return [];
  const record = artifact.records.find((row) => row.vimeoId === id);
  if (!record || !Array.isArray(record.paragraphs)) return [];
  return record.paragraphs.filter((paragraph): paragraph is string => {
    return typeof paragraph === "string" && paragraph.trim().length > 0;
  });
}

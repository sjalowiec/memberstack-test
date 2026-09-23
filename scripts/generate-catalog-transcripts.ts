/**
 * Generate public and member catalog transcript JSON.
 *
 *   vite-node scripts/generate-catalog-transcripts.ts
 *   vite-node scripts/generate-catalog-transcripts.ts --check
 *
 * Check mode reports stale artifacts and does not write.
 * Write mode refuses to drop Vimeo IDs already present in a generated file.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { PublicVideoRow } from "../src/lib/lessonVideo";
import {
  buildCatalogTranscriptDocuments,
  MEMBER_TRANSCRIPT_RELATIVE,
  PUBLIC_TRANSCRIPT_RELATIVE,
  serializeCatalogTranscriptJson,
  TRANSCRIPT_AUDIT_RELATIVE,
  transcriptFreshnessIssues,
  assertSafeTranscriptOverwrite,
  type CatalogTranscriptAudit,
  type CatalogTranscriptDocuments,
} from "../src/lib/transcripts/generateCatalogTranscripts";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const checkOnly = process.argv.includes("--check");

function readIfPresent(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch (err) {
    const code = err && typeof err === "object" && "code" in err ? String(err.code) : "";
    if (code === "ENOENT") return null;
    throw err;
  }
}

function documents(): CatalogTranscriptDocuments {
  const catalog = JSON.parse(
    readFileSync(join(repoRoot, "src", "data", "videos-public.json"), "utf8"),
  ) as PublicVideoRow[];
  return buildCatalogTranscriptDocuments({
    sourceDir: join(repoRoot, "src", "data", "transcripts", "en"),
    catalog,
    sourceDirectoryLabel: "src/data/transcripts/en",
  });
}

function targets(docs: CatalogTranscriptDocuments) {
  return [
    {
      relativePath: PUBLIC_TRANSCRIPT_RELATIVE,
      body: serializeCatalogTranscriptJson(docs.publicDocument),
      ids: docs.publicDocument.records.map((record) => record.vimeoId),
    },
    {
      relativePath: MEMBER_TRANSCRIPT_RELATIVE,
      body: serializeCatalogTranscriptJson(docs.memberDocument),
      ids: docs.memberDocument.records.map((record) => record.vimeoId),
    },
    {
      relativePath: TRANSCRIPT_AUDIT_RELATIVE,
      body: serializeCatalogTranscriptJson(docs.audit),
      ids: docs.audit.records.map((record) => record.vimeoId),
    },
  ];
}

function summary(audit: CatalogTranscriptAudit): string {
  const duplicates =
    audit.duplicatePublishedRows.length === 0
      ? "none"
      : audit.duplicatePublishedRows
          .map((row) => `${row.vimeoId} (${row.contentIds.join(", ")})`)
          .join("; ");
  return `public ${audit.publicCount}, member ${audit.memberCount}, duplicate published rows: ${duplicates}`;
}

const docs = documents();
const files = targets(docs);

if (checkOnly) {
  const issues = files.flatMap((file) => {
    const fullPath = join(repoRoot, file.relativePath);
    return transcriptFreshnessIssues(file.relativePath, readIfPresent(fullPath), file.body);
  });
  if (issues.length > 0) {
    console.error("Catalog transcript artifacts are stale.");
    for (const issue of issues) console.error(`  ${issue.file}: ${issue.detail}`);
    process.exitCode = 1;
  } else {
    console.log(`Catalog transcript artifacts are current (${summary(docs.audit)}).`);
  }
} else {
  for (const file of files) {
    const fullPath = join(repoRoot, file.relativePath);
    const existing = readIfPresent(fullPath);
    assertSafeTranscriptOverwrite(file.relativePath, existing, file.ids);
    if (existing === file.body) continue;
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, file.body, "utf8");
    console.log(`wrote ${file.relativePath}`);
  }
  console.log(`Catalog transcripts generated (${summary(docs.audit)}).`);
}

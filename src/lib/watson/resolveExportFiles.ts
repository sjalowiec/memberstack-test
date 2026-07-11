import fs from "fs";
import path from "path";

import type { LegacyTableDef } from "./types";

export interface ResolvedExportFile {
  exportName: string;
  pgTable: string;
  filePath: string;
  fileName: string;
  /** Why this file was chosen when multiple candidates existed. */
  selectionReason: string;
  /** Other matching files that were not selected. */
  alternateMatches: string[];
}

/** Match `{ExportName}.csv` or `{ExportName}_*.csv` (case-insensitive). */
export function fileMatchesExportName(fileName: string, exportName: string): boolean {
  const baseName = fileName.replace(/\.csv$/i, "");
  const baseLower = baseName.toLowerCase();
  const exportLower = exportName.toLowerCase();

  if (baseLower === exportLower) {
    return true;
  }

  return baseLower.startsWith(`${exportLower}_`);
}

/** Extract a trailing `_YYYY-MM-DD` snapshot date from the filename, if present. */
export function extractFilenameDate(fileName: string): Date | null {
  const match = fileName.match(/_(\d{4}-\d{2}-\d{2})\.csv$/i);
  if (!match) {
    return null;
  }

  const parsed = Date.parse(`${match[1]}T00:00:00.000Z`);
  return Number.isNaN(parsed) ? null : new Date(parsed);
}

export function getEffectiveSortTime(filePath: string, fileName: string): number {
  const filenameDate = extractFilenameDate(fileName);
  if (filenameDate) {
    return filenameDate.getTime();
  }
  return fs.statSync(filePath).mtimeMs;
}

export function describeFileSelection(
  fileName: string,
  alternateMatches: string[],
): string {
  const filenameDate = extractFilenameDate(fileName);
  const dateLabel = filenameDate
    ? filenameDate.toISOString().slice(0, 10)
    : null;

  if (alternateMatches.length === 0) {
    return dateLabel
      ? `matched export prefix (snapshot date ${dateLabel} in filename)`
      : "matched export prefix (file modified time)";
  }

  if (dateLabel) {
    return `newest match among ${alternateMatches.length + 1} files (snapshot date ${dateLabel} in filename)`;
  }

  return `newest match among ${alternateMatches.length + 1} files (file modified time)`;
}

export function selectNewestMatchingFile(
  exportDir: string,
  exportName: string,
  fileNames: string[],
): { fileName: string; selectionReason: string; alternateMatches: string[] } | null {
  const matches = fileNames.filter((fileName) => fileMatchesExportName(fileName, exportName));
  if (matches.length === 0) {
    return null;
  }

  const ranked = matches
    .map((fileName) => ({
      fileName,
      sortTime: getEffectiveSortTime(path.join(exportDir, fileName), fileName),
    }))
    .sort((a, b) => b.sortTime - a.sortTime || b.fileName.localeCompare(a.fileName));

  const selected = ranked[0];
  const alternateMatches = ranked.slice(1).map((entry) => entry.fileName);

  return {
    fileName: selected.fileName,
    alternateMatches,
    selectionReason: describeFileSelection(selected.fileName, alternateMatches),
  };
}

export function resolveExportFiles(
  exportDir: string,
  definitions: LegacyTableDef[],
): { resolved: ResolvedExportFile[]; missingRequired: string[] } {
  if (!fs.existsSync(exportDir)) {
    throw new Error(`Export directory does not exist: ${exportDir}`);
  }

  const files = fs.readdirSync(exportDir).filter((name) => name.toLowerCase().endsWith(".csv"));
  const usedFiles = new Set<string>();
  const resolved: ResolvedExportFile[] = [];
  const missingRequired: string[] = [];

  // Match more specific export names first (e.g. Store_Transactions_items before Store_Transactions).
  const orderedDefinitions = [...definitions].sort(
    (a, b) => b.exportName.length - a.exportName.length,
  );

  for (const def of orderedDefinitions) {
    const availableFiles = files.filter((fileName) => !usedFiles.has(fileName));
    const selected = selectNewestMatchingFile(exportDir, def.exportName, availableFiles);

    if (!selected) {
      if (def.required) {
        missingRequired.push(def.exportName);
      }
      continue;
    }

    usedFiles.add(selected.fileName);
    resolved.push({
      exportName: def.exportName,
      pgTable: def.pgTable,
      filePath: path.join(exportDir, selected.fileName),
      fileName: selected.fileName,
      selectionReason: selected.selectionReason,
      alternateMatches: selected.alternateMatches,
    });
  }

  return { resolved, missingRequired };
}

export function inferBatchIdFromExportDir(exportDir: string): string {
  const base = path.basename(exportDir);
  if (/^\d{4}-\d{2}-\d{2}$/.test(base)) {
    return base;
  }
  return base;
}

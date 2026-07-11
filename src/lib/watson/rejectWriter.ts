import fs from "fs";
import path from "path";

import { readCsvFile } from "./csvReader";

export interface RejectedImportRow {
  lineNumber: number;
  reason: string;
  raw: string;
  row?: Record<string, string>;
}

export function ensureRejectDir(batchId: string, rootDir = "legacy-data/import-errors"): string {
  const dir = path.join(rootDir, batchId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function writeRejectedRows(
  rejectDir: string,
  pgTable: string,
  headers: string[],
  rejected: RejectedImportRow[],
): string | undefined {
  if (rejected.length === 0) {
    return undefined;
  }

  const filePath = path.join(rejectDir, `${pgTable}.rejected.csv`);
  const lines = [
    ["line_number", "reason", ...headers].join(","),
    ...rejected.map((entry) => {
      const values = headers.map((header) => csvEscape(entry.row?.[header] ?? ""));
      return [entry.lineNumber, csvEscape(entry.reason), ...values].join(",");
    }),
  ];
  fs.writeFileSync(filePath, lines.join("\n"), "utf8");
  return filePath;
}

export function writeParseRejectedRows(
  rejectDir: string,
  pgTable: string,
  rejected: Array<{ lineNumber: number; reason: string; raw: string }>,
): string | undefined {
  if (rejected.length === 0) {
    return undefined;
  }

  const filePath = path.join(rejectDir, `${pgTable}.parse-rejected.csv`);
  const lines = [
    "line_number,reason,raw",
    ...rejected.map(
      (entry) =>
        [entry.lineNumber, csvEscape(entry.reason), csvEscape(entry.raw)].join(","),
    ),
  ];
  fs.writeFileSync(filePath, lines.join("\n"), "utf8");
  return filePath;
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function countCsvDataRows(filePath: string): number {
  return readCsvFile(filePath).rows.length;
}

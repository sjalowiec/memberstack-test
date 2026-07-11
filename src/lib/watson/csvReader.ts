import fs from "fs";

import { buildHeaderIndex, normalizeHeaderName } from "./columnNormalize";

export interface ReadCsvOptions {
  /** When true, rows with fewer/more columns than the header are rejected. */
  strictColumnCount?: boolean;
}

export interface ReadCsvResult {
  filePath: string;
  encoding: "utf8" | "utf8-bom";
  headers: string[];
  rows: Record<string, string>[];
  rejectedRows: Array<{ lineNumber: number; reason: string; raw: string }>;
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  fields.push(current);
  return fields;
}

function splitCsvRecords(text: string): string[] {
  const records: string[] = [];
  let record = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      record += char;
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && text[i + 1] === "\n") {
        i++;
      }
      if (record.length > 0) {
        records.push(record);
      }
      record = "";
    } else {
      record += char;
    }
  }

  if (record.length > 0) {
    records.push(record);
  }

  return records;
}

function detectEncoding(buffer: Buffer): { text: string; encoding: "utf8" | "utf8-bom" } {
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return { text: buffer.subarray(3).toString("utf8"), encoding: "utf8-bom" };
  }
  return { text: buffer.toString("utf8"), encoding: "utf8" };
}

export function readCsvFile(filePath: string, options: ReadCsvOptions = {}): ReadCsvResult {
  const strictColumnCount = options.strictColumnCount ?? true;
  const buffer = fs.readFileSync(filePath);
  const { text, encoding } = detectEncoding(buffer);
  const records = splitCsvRecords(text);

  if (records.length === 0) {
    return {
      filePath,
      encoding,
      headers: [],
      rows: [],
      rejectedRows: [],
    };
  }

  const rawHeaders = parseCsvLine(records[0]).map(normalizeHeaderName);
  const headerIndex = buildHeaderIndex(rawHeaders);
  const headers = [...headerIndex.values()];
  const expectedCount = rawHeaders.length;
  const rows: Record<string, string>[] = [];
  const rejectedRows: ReadCsvResult["rejectedRows"] = [];

  for (let i = 1; i < records.length; i++) {
    const lineNumber = i + 1;
    const raw = records[i];
    if (!raw.trim()) {
      continue;
    }

    const values = parseCsvLine(raw);
    if (strictColumnCount && values.length !== expectedCount) {
      rejectedRows.push({
        lineNumber,
        reason: `Expected ${expectedCount} columns, found ${values.length}`,
        raw,
      });
      continue;
    }

    const row: Record<string, string> = {};
    for (let col = 0; col < rawHeaders.length; col++) {
      const header = rawHeaders[col];
      row[header] = values[col] ?? "";
    }
    rows.push(row);
  }

  return {
    filePath,
    encoding,
    headers,
    rows,
    rejectedRows,
  };
}

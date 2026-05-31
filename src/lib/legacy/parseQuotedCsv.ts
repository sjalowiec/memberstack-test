/**
 * RFC 4180-style CSV parser (quoted fields, doubled quotes, commas in fields).
 * Use instead of String.split(",") for legacy SQL exports with HTML descriptions.
 */
export function parseQuotedCsv(text: string): string[][] {
  const records: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (c === '"' && next === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || (c === "\r" && next === "\n")) {
      if (c === "\r") i++;
      row.push(field);
      field = "";
      if (row.length > 1 || row[0] !== "") records.push(row);
      row = [];
    } else {
      field += c;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.length > 1 || row[0] !== "") records.push(row);
  }

  return records;
}

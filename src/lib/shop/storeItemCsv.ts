/** Quote one CSV field when it contains a comma, quote, or line break. */
export function serializeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function serializeCsvRow(fields: string[]): string {
  return fields.map(serializeCsvField).join(",");
}

/**
 * Split a CSV into records without breaking quoted commas or newlines.
 * A trailing newline does not create an extra empty record.
 */
export function splitCsvRecords(text: string): { newline: "\n" | "\r\n"; records: string[] } {
  const newline: "\n" | "\r\n" = text.includes("\r\n") ? "\r\n" : "\n";
  const records: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      current += char;
      if (char === '"' && next === '"') {
        current += next;
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      current += char;
      continue;
    }

    if (char === "\n" || (char === "\r" && next === "\n")) {
      if (char === "\r") i += 1;
      records.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  if (current.length > 0) records.push(current);
  return { newline, records };
}

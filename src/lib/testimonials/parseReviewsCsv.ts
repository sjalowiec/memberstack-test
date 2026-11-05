export type ParsedLegacyReview = {
  legacyRatingId: number;
  rating: number | null;
  attribution: string;
  reviewDate: string | null;
  quote: string;
  legacyShow: boolean | null;
  legacyMemberId: string | null;
  legacyViewed: boolean | null;
  legacyUseInEmail: boolean | null;
};

export function parseReviewsCsv(text: string): ParsedLegacyReview[] {
  const rows = parseCsvRows(text.replace(/^\uFEFF/, ""));
  const [header, ...body] = rows.filter((row) => row.some((value) => value !== ""));
  if (!header) return [];
  const index = new Map(header.map((name, position) => [name.trim(), position]));
  return body.map((values) => {
    const read = (name: string) => values[index.get(name) ?? -1] ?? "";
    const legacyRatingId = Number(read("ratingid"));
    if (!Number.isInteger(legacyRatingId)) {
      throw new Error(`Legacy review ratingid is not an integer: ${read("ratingid")}`);
    }
    return {
      legacyRatingId,
      rating: readBitNumber(read("Rating")),
      attribution: read("Consumer").trim() || "Member",
      reviewDate: read("Dateadd").trim().slice(0, 10) || null,
      quote: read("Description"),
      legacyShow: readBit(read("Show")),
      legacyMemberId: blankToNull(read("Memberid")),
      legacyViewed: readBit(read("Viewed")),
      legacyUseInEmail: readBit(read("UseInEmail")),
    };
  });
}

function readBit(value: string): boolean | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed.toUpperCase() === "NULL") return null;
  if (trimmed === "1") return true;
  if (trimmed === "0") return false;
  return null;
}

function readBitNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed.toUpperCase() === "NULL") return null;
  const parsed = Number(trimmed);
  return Number.isInteger(parsed) ? parsed : null;
}

function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed.toUpperCase() === "NULL") return null;
  return trimmed;
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

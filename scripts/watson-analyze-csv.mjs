import fs from "fs";
import path from "path";

const dir = process.argv[2] || "legacy-data/exports/2026-07-11";

function parseCsvLine(line) {
  const fields = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQuotes = false;
      } else cur += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") {
        fields.push(cur);
        cur = "";
      } else cur += c;
    }
  }
  fields.push(cur);
  return fields;
}

function splitCsvRows(text) {
  const rows = [];
  let row = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      inQuotes = !inQuotes;
      row += c;
    } else if ((c === "\n" || (c === "\r" && text[i + 1] !== "\n")) && !inQuotes) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      if (row.trim()) rows.push(row);
      row = "";
    } else row += c;
  }
  if (row.trim()) rows.push(row);
  return rows;
}

function analyze(filePath) {
  const buf = fs.readFileSync(filePath);
  let encoding = "utf8";
  let text;
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    text = buf.slice(3).toString("utf8");
    encoding = "utf8-bom";
  } else {
    text = buf.toString("utf8");
    if (text.includes("\uFFFD")) encoding = "utf8-with-replacement-chars";
  }

  const rows = splitCsvRows(text);
  const header = parseCsvLine(rows[0] || "");
  const dataRows = rows.slice(1);
  const colCounts = dataRows.map((r) => parseCsvLine(r).length);
  const badCols = colCounts.filter((n) => n !== header.length);
  const emptyHeaders = header.filter((h) => !h || !h.trim());
  const dupHeaders = header.filter((h, i) => header.indexOf(h) !== i);

  const blankCols = header
    .map((h, i) => ({
      h,
      allBlank: dataRows.every((r) => !parseCsvLine(r)[i]?.trim()),
    }))
    .filter((x) => x.allBlank)
    .map((x) => x.h);

  return {
    encoding,
    header,
    dataRowCount: dataRows.length,
    badColCount: badCols.length,
    emptyHeaders,
    dupHeaders: [...new Set(dupHeaders)],
    blankCols,
  };
}

const files = fs.readdirSync(dir).sort();
for (const f of files) {
  const info = analyze(path.join(dir, f));
  console.log(`=== ${f} ===`);
  console.log("Encoding:", info.encoding);
  console.log("Data rows:", info.dataRowCount);
  console.log("Header count:", info.header.length);
  console.log("Headers:", JSON.stringify(info.header));
  if (info.badColCount) console.log("Malformed rows:", info.badColCount);
  if (info.emptyHeaders.length) console.log("Empty headers:", info.emptyHeaders);
  if (info.dupHeaders.length) console.log("Duplicate headers:", info.dupHeaders);
  if (info.blankCols.length) console.log("All-blank columns:", info.blankCols);
  console.log("");
}

const hasStoreTx = files.some(
  (f) => /store_transactions/i.test(f) && !/items/i.test(f),
);
console.log("Missing Store_Transactions:", !hasStoreTx);

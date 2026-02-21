import fs from "node:fs";
import path from "node:path";

const PROJECT_ROOT = process.cwd();

const CSV_PATH = path.join(PROJECT_ROOT, "data", "video-category-map.csv");
const JSON_PATH = path.join(PROJECT_ROOT, "src", "data", "videos-public.json");

function parseCsvLine(line) {
  // Handles simple CSV; also supports quoted fields with commas.
  const out = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      // double-quote escape inside quoted string
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }

    cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function readCsvMap(csvText) {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) throw new Error("CSV is empty.");

  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const idxContentId = header.indexOf("contentid");
  const idxCategory = header.indexOf("category");
  const idxSubcategory = header.indexOf("subcategory");

  if (idxContentId === -1) throw new Error("CSV missing header: contentid");
  if (idxCategory === -1) throw new Error("CSV missing header: category");
  if (idxSubcategory === -1) throw new Error("CSV missing header: subcategory");

  const map = new Map();
  let rowCount = 0;

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const rawId = cols[idxContentId];
    if (!rawId) continue;

    const contentid = Number(rawId);
    if (!Number.isFinite(contentid)) continue;

    const category = (cols[idxCategory] ?? "").trim();
    const subcategory = (cols[idxSubcategory] ?? "").trim();

    map.set(contentid, { category, subcategory });
    rowCount++;
  }

  return { map, rowCount };
}

function main() {
  if (!fs.existsSync(CSV_PATH)) {
    throw new Error(`CSV not found: ${CSV_PATH}`);
  }
  if (!fs.existsSync(JSON_PATH)) {
    throw new Error(`JSON not found: ${JSON_PATH}`);
  }

  const csvText = fs.readFileSync(CSV_PATH, "utf8");
  const { map, rowCount: csvRowsParsed } = readCsvMap(csvText);

  const jsonText = fs.readFileSync(JSON_PATH, "utf8");
  const videos = JSON.parse(jsonText);

  if (!Array.isArray(videos)) {
    throw new Error("videos-public.json is not an array at the top level.");
  }

  let matched = 0;
  let jsonUnmatched = 0;
  const usedCsvIds = new Set();

  for (const v of videos) {
    const id = Number(v?.content_id);
    if (!Number.isFinite(id)) {
      jsonUnmatched++;
      continue;
    }

    const row = map.get(id);
    if (!row) {
      jsonUnmatched++;
      continue;
    }

    v.category = row.category;

    // only set subcategory if present
    if (row.subcategory) v.subcategory = row.subcategory;
    else if ("subcategory" in v) delete v.subcategory;

    matched++;
    usedCsvIds.add(id);
  }

  let csvUnused = 0;
  for (const id of map.keys()) {
    if (!usedCsvIds.has(id)) csvUnused++;
  }

  fs.writeFileSync(JSON_PATH, JSON.stringify(videos, null, 2) + "\n", "utf8");

  console.log("Merge complete ✅");
  console.log("JSON videos:", videos.length);
  console.log("CSV rows parsed:", csvRowsParsed);
  console.log("Matched:", matched);
  console.log("JSON unmatched:", jsonUnmatched);
  console.log("CSV unused:", csvUnused);
}

main();
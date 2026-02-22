import fs from "node:fs";
import path from "node:path";

const PROJECT_ROOT = process.cwd();
const CSV_PATH = path.join(PROJECT_ROOT, "src", "data", "contentid-vimeoid.csv");
const JSON_PATH = path.join(PROJECT_ROOT, "src", "data", "videos-public.json");
const OUTPUT_PATH = path.join(PROJECT_ROOT, "src", "data", "videos-public.with-vimeo.json");

/**
 * Parse CSV text into rows; first column = content_id, last column = vimeo_id.
 * Skips header row if it looks like "content_id,vimeo_id".
 */
function parseCsv(csvText) {
  const rows = [];
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim() !== "");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const parts = line.split(",").map((p) => p.trim());
    if (parts.length < 2) continue;
    const contentId = parts[0];
    const vimeoId = parts[parts.length - 1];
    if (i === 0 && contentId === "content_id" && vimeoId === "vimeo_id") continue;
    rows.push({ content_id: contentId, vimeo_id: vimeoId });
  }
  return rows;
}

const csvText = fs.readFileSync(CSV_PATH, "utf8");
const csvRows = parseCsv(csvText);
const vimeoByContentId = new Map();
for (const row of csvRows) {
  if (row.vimeo_id != null && String(row.vimeo_id) !== "0") {
    vimeoByContentId.set(String(row.content_id), row.vimeo_id);
  }
}

const jsonText = fs.readFileSync(JSON_PATH, "utf8");
const videos = JSON.parse(jsonText);
if (!Array.isArray(videos)) {
  throw new Error("Expected videos-public.json to be a JSON array");
}

let updated = 0;
const merged = videos.map((video) => {
  const contentId = video.content_id;
  const key = contentId != null ? String(contentId) : "";
  const vimeoId = vimeoByContentId.get(key);
  const out = { ...video };
  if (vimeoId !== undefined) {
    out.vimeo_id = typeof contentId === "number" && /^\d+$/.test(String(vimeoId)) ? Number(vimeoId) : vimeoId;
    updated++;
  }
  return out;
});

fs.writeFileSync(OUTPUT_PATH, JSON.stringify(merged, null, 2), "utf8");
console.log(updated);

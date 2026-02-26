import fs from "node:fs";

const FILE = "src/data/videos-public.json"; // adjust if your path is different
const data = JSON.parse(fs.readFileSync(FILE, "utf8"));

// Finds URLs that point to knititnow.com (with or without www)
const URL_REGEX = /https?:\/\/(?:www\.)?knititnow\.com\/[^\s"'<>]+/gi;

const findings = [];
const urlCounts = new Map();

for (const v of data) {
  const desc = String(v.description ?? "");
  const matches = desc.match(URL_REGEX) ?? [];
  if (!matches.length) continue;

  const unique = [...new Set(matches)];

  findings.push({
    content_id: v.content_id,
    slug: v.slug,
    title: v.title,
    urls: unique,
  });

  for (const u of unique) urlCounts.set(u, (urlCounts.get(u) ?? 0) + 1);
}

const topUrls = [...urlCounts.entries()].sort((a, b) => b[1] - a[1]);

fs.writeFileSync(
  "scripts/video-description-links.report.json",
  JSON.stringify(
    {
      scannedFile: FILE,
      totalVideos: data.length,
      affectedVideos: findings.length,
      findings,
      topUrls,
    },
    null,
    2
  )
);

console.log(`Done. Affected videos: ${findings.length}`);
console.log(`Report written to: scripts/video-description-links.report.json`);
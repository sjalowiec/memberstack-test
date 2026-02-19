import fs from "fs";

const glossary = JSON.parse(
  fs.readFileSync("./src/data/glossary.json", "utf-8")
);

const results = [];

glossary.forEach((entry, index) => {
  const content = JSON.stringify(entry);

  if (content.toLowerCase().includes("knititnow")) {
    results.push({
      index,
      term: entry.english || "(no term)",
    });
  }
});

console.log(`Found ${results.length} entries containing "knititnow"\n`);

results.forEach((r, i) => {
  console.log(`${i + 1}. ${r.term} (index ${r.index})`);
});

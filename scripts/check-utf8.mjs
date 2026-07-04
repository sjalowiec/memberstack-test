/**
 * UTF-8 guard: scans authored source files for encoding corruption.
 *
 * Fails (exit 1) when a file either:
 *   - is not valid UTF-8 (e.g. stray Windows-1252 bytes like 0x97 em dash, 0x85 ellipsis), or
 *   - contains a baked-in U+FFFD replacement character (bytes EF BF BD).
 *
 * These artifacts show up as the mojibake replacement glyph in the UI. See the encoding
 * root cause: content written through Windows PowerShell 5.1 (ANSI / non-UTF-8 codepage).
 *
 * Usage: node scripts/check-utf8.mjs
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

// Directories we author / ship text from.
const SCAN_ROOTS = ["src", "data", "scripts", "public", ".cursor"];

// Text extensions worth decoding (skip binaries / images / fonts).
const TEXT_EXTENSIONS = new Set([
  ".astro", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".css", ".scss", ".sass", ".less",
  ".md", ".mdx", ".txt", ".html", ".svg",
  ".json", ".jsonc", ".yml", ".yaml", ".csv",
]);

// Never descend into these directory names.
const SKIP_DIRS = new Set([
  "node_modules", ".git", "dist", ".astro", ".netlify", ".vercel",
  "coverage", ".turbo", ".cache",
]);

// Vendored / generated artifacts that legitimately contain U+FFFD and are not hand-authored UI.
const EXCLUDED_FILE_PATTERNS = [
  /\/public\/challenge\/.*\/player\/rlplayer\.js$/i,
  /\/src\/data\/legacy_kin\/reports\/cleanup-.*\.json$/i,
  /\/src\/data\/legacy_kin\/reports\/cleanup-.*\.md$/i,
];

const toPosix = (p) => p.split(path.sep).join("/");

function isExcluded(absPath) {
  const rel = "/" + toPosix(path.relative(ROOT, absPath));
  return EXCLUDED_FILE_PATTERNS.some((re) => re.test(rel));
}

function* walk(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      yield* walk(full);
    } else if (entry.isFile()) {
      if (TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        yield full;
      }
    }
  }
}

/** Returns the byte offset of the first invalid UTF-8 sequence, or -1 if valid. */
function firstInvalidUtf8Offset(buf) {
  const decoder = new TextDecoder("utf-8", { fatal: true });
  try {
    decoder.decode(buf);
    return -1;
  } catch {
    // Re-scan to locate the first offending byte for a helpful message.
    for (let i = 0; i < buf.length; i++) {
      try {
        new TextDecoder("utf-8", { fatal: true }).decode(buf.subarray(0, i + 1));
      } catch {
        // The failing prefix ends at/around i; report the first high byte in this window.
        for (let j = Math.max(0, i - 3); j <= i; j++) {
          if (buf[j] >= 0x80) return j;
        }
        return i;
      }
    }
    return 0;
  }
}

/** Returns byte offset of first U+FFFD (EF BF BD), or -1. */
function firstReplacementCharOffset(buf) {
  for (let i = 0; i + 2 < buf.length; i++) {
    if (buf[i] === 0xef && buf[i + 1] === 0xbf && buf[i + 2] === 0xbd) return i;
  }
  return -1;
}

function offsetToLineCol(buf, offset) {
  let line = 1;
  let col = 1;
  const safe = Math.min(offset, buf.length);
  for (let i = 0; i < safe; i++) {
    if (buf[i] === 0x0a) {
      line++;
      col = 1;
    } else {
      col++;
    }
  }
  return { line, col };
}

const problems = [];
let scanned = 0;

for (const root of SCAN_ROOTS) {
  const abs = path.join(ROOT, root);
  if (!fs.existsSync(abs)) continue;
  for (const file of walk(abs)) {
    if (isExcluded(file)) continue;
    scanned++;
    const buf = fs.readFileSync(file);
    const rel = toPosix(path.relative(ROOT, file));

    const invalidAt = firstInvalidUtf8Offset(buf);
    if (invalidAt !== -1) {
      const { line, col } = offsetToLineCol(buf, invalidAt);
      const byte = buf[invalidAt];
      problems.push(
        `${rel}:${line}:${col}  invalid UTF-8 byte 0x${byte
          .toString(16)
          .padStart(2, "0")
          .toUpperCase()}`
      );
      continue; // one report per file is enough
    }

    const fffdAt = firstReplacementCharOffset(buf);
    if (fffdAt !== -1) {
      const { line, col } = offsetToLineCol(buf, fffdAt);
      problems.push(`${rel}:${line}:${col}  contains U+FFFD replacement character`);
    }
  }
}

if (problems.length === 0) {
  console.log(`check:utf8 - OK. Scanned ${scanned} source files; all valid UTF-8, no U+FFFD.`);
  process.exit(0);
}

console.error(`check:utf8 - FAILED. ${problems.length} file(s) with encoding artifacts:\n`);
for (const p of problems) console.error(`  ${p}`);
console.error(
  "\nFix: restore the intended plain text (UTF-8, no BOM). These usually come from writing files\n" +
    "through a non-UTF-8 codepage (e.g. Windows PowerShell 5.1). Do not commit replacement characters."
);
process.exit(1);

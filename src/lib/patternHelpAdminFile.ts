import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const PATTERN_HELP_JSON_PATH = join(process.cwd(), "src", "data", "pattern-help.json");

export type PatternHelpEntry = {
  title: string;
  text: string[];
  vimeoId: string;
};

export type PatternHelpData = Record<string, PatternHelpEntry>;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/** Normalize and validate JSON from disk or API; throws with a short message if invalid. */
export function parsePatternHelpData(raw: unknown): PatternHelpData {
  if (!isPlainObject(raw)) {
    throw new Error("Root must be a JSON object keyed by help ID.");
  }
  const out: PatternHelpData = {};
  for (const [id, entry] of Object.entries(raw)) {
    if (typeof id !== "string" || id.trim() === "") continue;
    if (!isPlainObject(entry)) {
      throw new Error(`Entry "${id}" must be an object.`);
    }
    const title = typeof entry.title === "string" ? entry.title : "";
    let text: string[] = [];
    if (Array.isArray(entry.text)) {
      text = entry.text.map((t) => String(t));
    } else if (typeof entry.text === "string") {
      text = [entry.text];
    }
    const vimeoId = typeof entry.vimeoId === "string" ? entry.vimeoId : "";
    out[id.trim()] = { title, text, vimeoId };
  }
  return out;
}

export function readPatternHelpFile(): PatternHelpData {
  const raw = readFileSync(PATTERN_HELP_JSON_PATH, "utf-8");
  const data = JSON.parse(raw) as unknown;
  return parsePatternHelpData(data);
}

export function writePatternHelpFile(data: PatternHelpData): void {
  writeFileSync(PATTERN_HELP_JSON_PATH, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

import { parseVttToReadableText } from "./parseVtt";

/**
 * English transcript files live in `src/data/transcripts/en/`.
 * Filenames: `<vimeoId>.vtt` or `<vimeoId>_EN.vtt` / `<vimeoId>_en.vtt`.
 * Vite `?raw` keeps them out of `public/` (no public VTT URL).
 */
const ENGLISH_VTT_MODULES = import.meta.glob("../../data/transcripts/en/*.vtt", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const TRANSCRIPT_FILE = /(\d+)(?:_en(?:-US)?)?\.vtt$/i;

export function vimeoIdFromTranscriptFilename(pathOrName: string): string | null {
  const base = String(pathOrName ?? "").trim().replace(/^.*[/\\]/, "");
  const match = base.match(TRANSCRIPT_FILE);
  return match ? match[1] : null;
}

export function indexEnglishTranscriptSources(
  modules: Record<string, string>,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const [path, raw] of Object.entries(modules)) {
    const id = vimeoIdFromTranscriptFilename(path);
    if (!id || typeof raw !== "string") continue;
    const existing = map.get(id);
    if (existing == null || raw.length > existing.length) {
      map.set(id, raw);
    }
  }
  return map;
}

export function readableEnglishTranscriptForVimeoId(
  vimeoId: string | number | null | undefined,
  sources: Record<string, string> | Map<string, string> = ENGLISH_VTT_MODULES,
): string | null {
  const id = String(vimeoId ?? "").trim();
  if (!/^\d+$/.test(id)) return null;
  const map = sources instanceof Map ? sources : indexEnglishTranscriptSources(sources);
  const raw = map.get(id);
  if (raw == null) return null;
  return parseVttToReadableText(raw);
}

export function englishTranscriptParagraphs(
  readable: string | null | undefined,
): string[] {
  if (!readable) return [];
  return readable
    .split(/\n{2,}/)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

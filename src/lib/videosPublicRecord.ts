/**
 * Types and helpers for `src/data/videos-public.json` (catalog + admin).
 * Optional fields (`transcript_json`, `vtt_url`, `search_ready`) are safe to omit at runtime.
 */

export type VideoPublicRecord = {
  content_id: string | number;
  slug: string;
  title: string;
  description?: string;
  access_level?: string;
  posterUrl?: string;
  category?: string;
  subcategory?: string;
  vimeo_id?: number;
  isTipOfWeek?: boolean;
  videoType?: string;
  clips?: string[];
  /** Present on some clip rows */
  sourceVideoId?: string | number;
  /** Future: structured transcript (object/array), optional */
  transcript_json?: unknown;
  /** Future: WebVTT URL */
  vtt_url?: string;
  /** Future: ready for search indexing */
  search_ready?: boolean;
};

function trimStr(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function parseContentId(v: unknown): string | number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = String(v).trim();
  if (!s) return null;
  if (/^-?\d+$/.test(s)) {
    const n = parseInt(s, 10);
    if (Number.isFinite(n)) return n;
  }
  return s;
}

function parseVimeoId(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  const s = trimStr(v);
  if (!s) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * Normalize one record for API save. Preserves unknown keys from `raw` for forward compatibility
 * (e.g. `vimeo_id_public`).
 */
export function normalizeVideoForSave(
  raw: unknown,
  index: number
): { ok: true; video: Record<string, unknown> } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: `Video ${index + 1} must be an object.` };
  }
  const base = { ...(raw as Record<string, unknown>) };

  const content_id = parseContentId(base.content_id);
  if (content_id === null) {
    return { ok: false, error: `Video ${index + 1}: content_id is required.` };
  }

  const slug = trimStr(base.slug);
  const title = trimStr(base.title);
  if (!slug) return { ok: false, error: `Video ${index + 1}: slug is required.` };
  if (!title) return { ok: false, error: `Video ${index + 1}: title is required.` };

  const vimeo_id = parseVimeoId(base.vimeo_id);
  if (vimeo_id === null) {
    return { ok: false, error: `Video ${index + 1}: vimeo_id is required (number).` };
  }

  const description = trimStr(base.description);
  const access_level = trimStr(base.access_level);
  const posterUrl = trimStr(base.posterUrl);
  const category = trimStr(base.category);
  const subcategory = trimStr(base.subcategory);
  const videoType = trimStr(base.videoType);
  const vtt_url = trimStr(base.vtt_url);

  let clips: string[] | undefined;
  if (base.clips === undefined || base.clips === null) {
    clips = undefined;
  } else if (Array.isArray(base.clips)) {
    clips = base.clips.map((x) => trimStr(x)).filter((s) => s.length > 0);
    if (clips.length === 0) clips = undefined;
  } else {
    return { ok: false, error: `Video ${index + 1}: clips must be an array of strings.` };
  }

  const isTipOfWeek = Boolean(base.isTipOfWeek);
  const search_ready = Boolean(base.search_ready);

  let transcript_json: unknown = undefined;
  if (base.transcript_json !== undefined && base.transcript_json !== null) {
    transcript_json = base.transcript_json;
  }

  const sourceVideoIdRaw = base.sourceVideoId;
  let sourceVideoId: string | number | undefined;
  if (sourceVideoIdRaw !== undefined && sourceVideoIdRaw !== null && trimStr(sourceVideoIdRaw) !== "") {
    if (typeof sourceVideoIdRaw === "number" && Number.isFinite(sourceVideoIdRaw)) {
      sourceVideoId = sourceVideoIdRaw;
    } else {
      const pid = parseContentId(sourceVideoIdRaw);
      sourceVideoId = pid === null ? trimStr(sourceVideoIdRaw) : pid;
    }
  }

  const out: Record<string, unknown> = { ...base };

  out.content_id = content_id;
  out.slug = slug;
  out.title = title;
  out.vimeo_id = vimeo_id;

  if (description) out.description = description;
  else delete out.description;

  if (access_level) out.access_level = access_level;
  else delete out.access_level;

  if (posterUrl) out.posterUrl = posterUrl;
  else delete out.posterUrl;

  if (category) out.category = category;
  else delete out.category;

  if (subcategory) out.subcategory = subcategory;
  else delete out.subcategory;

  if (videoType) out.videoType = videoType;
  else delete out.videoType;

  if (clips) out.clips = clips;
  else delete out.clips;

  out.isTipOfWeek = isTipOfWeek;

  if (sourceVideoId !== undefined) out.sourceVideoId = sourceVideoId;
  else delete out.sourceVideoId;

  if (transcript_json !== undefined) out.transcript_json = transcript_json;
  else delete out.transcript_json;

  if (vtt_url) out.vtt_url = vtt_url;
  else delete out.vtt_url;

  out.search_ready = search_ready;

  return { ok: true, video: out };
}

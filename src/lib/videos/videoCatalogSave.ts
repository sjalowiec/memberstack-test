/**
 * Plan one video save: the catalog record, its English VTT, and the generated
 * transcript JSON, as a single set of file changes for one commit.
 *
 * Rules the admin relies on:
 * - New videos get the next unused numeric video number. Numbers never change.
 * - Slugs and Vimeo IDs must be unique.
 * - A VTT lives in `transcripts/en/` only while its video is published, because
 *   the build rejects VTTs for unpublished videos. Otherwise it waits in
 *   `transcripts/drafts/en/` and moves over on publish.
 * - Member transcripts stay in member.json, never public.json.
 */
import type { PublicVideoRow } from "../lessonVideo";
import {
  englishTranscriptParagraphs,
  vimeoIdFromTranscriptFilename,
} from "../transcripts/englishTranscript";
import {
  canonicalTranscriptBytes,
  catalogTranscriptVimeoId,
  serializeCatalogTranscriptJson,
  updateCatalogTranscriptDocuments,
  type CatalogTranscriptDocuments,
  type TranscriptSourceFile,
} from "../transcripts/generateCatalogTranscripts";
import { parseVttToReadableText } from "../transcripts/parseVtt";
import { isValidVideoAccessLevel, normalizeAccessLevelRaw } from "../videoAccessLevel";
import { catalogVideoIsPublic } from "../videoPublic";
import { gitBlobSha } from "../machines/machineSalesGithub";
import { normalizeVideoForSave } from "../videosPublicRecord";
import { catalogRecordToStore, upsertCatalogRecordText } from "./videoCatalogFile";
import { videoContentIdKey } from "./videoPosterOverrides";
import {
  VIDEO_CATALOG_REPO_PATH,
  VIDEO_DRAFT_TRANSCRIPT_REPO_DIR,
  VIDEO_GENERATED_TRANSCRIPT_PATHS,
  VIDEO_TRANSCRIPT_REPO_DIR,
  type VideoRepoChange,
  type VideoRepoFileEntry,
} from "./videoCatalogGithub";
import type { VideoCatalogSnapshot } from "./videoCatalogRepo";

export type VideoSaveStatus = "draft" | "published" | "archived";

export type VideoSaveInput = {
  action: "create" | "update";
  /** Required for update. Ignored for create: the server assigns the number. */
  contentId?: string | number;
  video: Record<string, unknown>;
  status: VideoSaveStatus;
  vtt?: { filename: string; text: string } | null;
};

export type VideoTranscriptState = "published" | "draft" | "none";

export type VideoSavePlan = {
  contentId: string;
  added: boolean;
  record: Record<string, unknown>;
  changes: VideoRepoChange[];
  transcript: VideoTranscriptState;
  /** Plain-language lines describing what this save changes. */
  summary: string[];
};

export class VideoSaveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VideoSaveError";
  }
}

/** Fields the editor may change. Everything else on a stored record is kept as is. */
export const VIDEO_EDITABLE_FIELDS = [
  "slug",
  "title",
  "description",
  "access_level",
  "posterUrl",
  "category",
  "subcategory",
  "vimeo_id",
  "vimeo_hash",
  "videoType",
  "sourceVideoId",
  "clips",
  "tipOfWeek",
  "isTipOfWeek",
  "tipHeadline",
  "tipNote",
  "tipHistory",
  "search_ready",
] as const;

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VTT_MAX_BYTES = 2 * 1024 * 1024;

export function parseVideoCatalog(raw: string): Record<string, unknown>[] {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new VideoSaveError("The video catalog is not valid JSON, so nothing was saved.");
  }
  if (!Array.isArray(data)) throw new VideoSaveError("The video catalog must be a list of videos.");
  return data as Record<string, unknown>[];
}

/** Highest whole-number video number plus one. Clip numbers such as 249-1 are skipped. */
export function nextVideoContentId(catalog: Record<string, unknown>[]): number {
  let max = 0;
  for (const video of catalog) {
    const key = videoContentIdKey(video.content_id);
    if (/^\d+$/.test(key)) max = Math.max(max, parseInt(key, 10));
  }
  return max + 1;
}

export function slugFromTitle(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

function slugKey(video: Record<string, unknown>): string {
  return typeof video.slug === "string" ? video.slug.trim().toLowerCase() : "";
}

/** `base`, or `base-2`, `base-3`, … when another video already uses it. */
export function uniqueVideoSlug(
  base: string,
  catalog: Record<string, unknown>[],
  exceptContentId?: string,
): string {
  const taken = new Set(
    catalog
      .filter((video) => videoContentIdKey(video.content_id) !== exceptContentId)
      .map(slugKey),
  );
  const root = base || "video";
  if (!taken.has(root)) return root;
  for (let n = 2; ; n += 1) {
    const candidate = `${root}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

function vimeoKey(video: Record<string, unknown>): string {
  return catalogTranscriptVimeoId(video as PublicVideoRow);
}

export function transcriptFilesForVimeoId(
  snapshot: Pick<VideoCatalogSnapshot, "transcripts">,
  vimeoId: string,
): { published: VideoRepoFileEntry[]; drafts: VideoRepoFileEntry[] } {
  const match = (file: VideoRepoFileEntry) => vimeoIdFromTranscriptFilename(file.name) === vimeoId;
  return {
    published: snapshot.transcripts.published.filter(match),
    drafts: snapshot.transcripts.drafts.filter(match),
  };
}

export function transcriptStateForVimeoId(
  snapshot: Pick<VideoCatalogSnapshot, "transcripts">,
  vimeoId: string,
): VideoTranscriptState {
  if (!vimeoId) return "none";
  const files = transcriptFilesForVimeoId(snapshot, vimeoId);
  if (files.published.length) return "published";
  if (files.drafts.length) return "draft";
  return "none";
}

/** Paragraphs a VTT will show on the video page. Throws when there is no spoken text. */
export function readableVttParagraphs(bytes: Buffer, label = "This VTT file"): string[] {
  if (bytes.length > VTT_MAX_BYTES) throw new VideoSaveError(`${label} is larger than 2 MB, so nothing was saved.`);
  const text = canonicalTranscriptBytes(bytes).toString("utf8").replace(/^﻿/, "");
  if (!/^WEBVTT/.test(text)) {
    throw new VideoSaveError(`${label} does not start with WEBVTT, so it is not a caption file. Nothing was saved.`);
  }
  const paragraphs = englishTranscriptParagraphs(parseVttToReadableText(text));
  if (paragraphs.length === 0) {
    throw new VideoSaveError(`${label} has no spoken text, so nothing was saved.`);
  }
  return paragraphs;
}

function parseGenerated(snapshot: VideoCatalogSnapshot): CatalogTranscriptDocuments {
  try {
    return {
      publicDocument: JSON.parse(snapshot.generated.public),
      memberDocument: JSON.parse(snapshot.generated.member),
      audit: JSON.parse(snapshot.generated.audit),
    };
  } catch {
    throw new VideoSaveError("The generated transcript files could not be read, so nothing was saved.");
  }
}

function fieldValueIsEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/** Stored key order for new records, matching recent catalog entries. */
const NEW_RECORD_KEY_ORDER = [
  "content_id",
  "slug",
  "title",
  "description",
  "access_level",
  "status",
  "posterUrl",
  "category",
  "subcategory",
  "vimeo_id",
  "vimeo_hash",
];

function orderedNewRecord(video: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of NEW_RECORD_KEY_ORDER) if (video[key] !== undefined) out[key] = video[key];
  for (const [key, value] of Object.entries(video)) {
    if (key in out) continue;
    // New records leave out the false flags older rows never had.
    if ((key === "isTipOfWeek" || key === "tipOfWeek" || key === "search_ready") && value === false) continue;
    out[key] = value;
  }
  return out;
}

function describeVideo(video: Record<string, unknown>): string {
  const title = typeof video.title === "string" ? video.title : "";
  return `video ${videoContentIdKey(video.content_id)}${title ? ` (“${title}”)` : ""}`;
}

function validateRecord(
  next: Record<string, unknown>,
  previous: Record<string, unknown> | null,
  catalog: Record<string, unknown>[],
): void {
  const contentId = videoContentIdKey(next.content_id);
  const others = catalog.filter((video) => videoContentIdKey(video.content_id) !== contentId);
  const changed = (key: string) =>
    !previous || JSON.stringify(previous[key] ?? null) !== JSON.stringify(next[key] ?? null);

  const slug = typeof next.slug === "string" ? next.slug : "";
  if (changed("slug")) {
    if (!SLUG_RE.test(slug)) {
      throw new VideoSaveError(
        "The slug may use only lowercase letters, numbers, and single hyphens (for example shaping-a-v-neck). Nothing was saved.",
      );
    }
    if (/^\d+$/.test(slug)) {
      throw new VideoSaveError("The slug cannot be only numbers, because it would look like a video number. Nothing was saved.");
    }
  }
  const slugClash = others.find((video) => slugKey(video) === slug.toLowerCase());
  if (slugClash) {
    throw new VideoSaveError(`The slug “${slug}” is already used by ${describeVideo(slugClash)}. Nothing was saved.`);
  }
  const keyClash = others.find((video) => videoContentIdKey(video.content_id) === slug);
  if (keyClash) {
    throw new VideoSaveError(`The slug “${slug}” matches the number of ${describeVideo(keyClash)}. Nothing was saved.`);
  }

  if (changed("vimeo_id") || changed("vimeo_id_public")) {
    const vimeoId = vimeoKey(next);
    const vimeoClash = vimeoId ? others.find((video) => vimeoKey(video) === vimeoId) : undefined;
    if (vimeoClash) {
      throw new VideoSaveError(
        `Vimeo ID ${vimeoId} is already used by ${describeVideo(vimeoClash)}. Edit that video instead of adding it again. Nothing was saved.`,
      );
    }
  }

  if (changed("access_level")) {
    if (!isValidVideoAccessLevel(normalizeAccessLevelRaw(next.access_level))) {
      throw new VideoSaveError("Choose Members only or Free for everyone for access. Nothing was saved.");
    }
  }
}

/**
 * Plan the file changes for one save. `readFile` reads stored VTTs at the
 * snapshot's commit; it is only called for transcripts this save touches.
 */
export async function planVideoSave(
  snapshot: VideoCatalogSnapshot,
  input: VideoSaveInput,
  readFile: (path: string) => Promise<Buffer | null>,
): Promise<VideoSavePlan> {
  if (input.action !== "create" && input.action !== "update") {
    throw new VideoSaveError("Choose whether to create or update a video.");
  }
  if (!["draft", "published", "archived"].includes(input.status)) {
    throw new VideoSaveError("Choose draft, published, or archived.");
  }
  if (!input.video || typeof input.video !== "object" || Array.isArray(input.video)) {
    throw new VideoSaveError("The video details are missing, so nothing was saved.");
  }

  const catalog = parseVideoCatalog(snapshot.catalogRaw);
  let existing: Record<string, unknown> | null = null;
  let contentId: string | number;
  if (input.action === "update") {
    const key = videoContentIdKey(input.contentId);
    const matches = catalog.filter((video) => videoContentIdKey(video.content_id) === key);
    if (!key || matches.length === 0) {
      throw new VideoSaveError(`Video ${key || "(no number)"} is not in the catalog. Reload the page and try again.`);
    }
    if (matches.length > 1) throw new VideoSaveError(`Video number ${key} appears more than once, so nothing was saved.`);
    existing = matches[0];
    contentId = existing.content_id as string | number;
  } else {
    contentId = nextVideoContentId(catalog);
  }

  const draft: Record<string, unknown> = { ...(existing ?? {}) };
  for (const field of VIDEO_EDITABLE_FIELDS) {
    if (!(field in input.video)) continue;
    const value = input.video[field];
    if (fieldValueIsEmpty(value)) delete draft[field];
    else draft[field] = field === "access_level" ? normalizeAccessLevelRaw(value) : value;
  }
  draft.content_id = contentId;
  draft.status = input.status;

  const normalized = normalizeVideoForSave(draft, 0);
  if (!normalized.ok) throw new VideoSaveError(`${normalized.error.replace(/^Video 1: /, "")} Nothing was saved.`);
  const nextVideo = normalized.video;
  validateRecord(nextVideo, existing, catalog);

  const record = existing ? catalogRecordToStore(existing, nextVideo) : orderedNewRecord(nextVideo);
  const catalogAfter = existing
    ? catalog.map((video) => (video === existing ? record : video))
    : [...catalog, record];

  const upsert = upsertCatalogRecordText(snapshot.catalogRaw, record);
  if (!upsert.ok) throw new VideoSaveError(upsert.error);

  const changes: VideoRepoChange[] = [];
  const summary: string[] = [];
  const contentKey = videoContentIdKey(contentId);
  if (upsert.text !== snapshot.catalogRaw) {
    changes.push({ path: VIDEO_CATALOG_REPO_PATH, content: Buffer.from(upsert.text, "utf8") });
    summary.push(existing ? `Updated video ${contentKey}.` : `Added video ${contentKey}.`);
  }

  // Transcripts: every Vimeo ID this save touches, before and after.
  const oldVimeo = existing ? vimeoKey(existing) : "";
  const newVimeo = vimeoKey(record);
  const publishedVimeoIds = new Set(
    catalogAfter.filter((video) => catalogVideoIsPublic(video)).map(vimeoKey).filter(Boolean),
  );
  const upload = input.vtt && input.vtt.text ? input.vtt : null;
  if (upload && !newVimeo) throw new VideoSaveError("Add the Vimeo ID before uploading a VTT. Nothing was saved.");

  const affected = new Map<string, TranscriptSourceFile[]>();
  for (const vimeoId of new Set([oldVimeo, newVimeo].filter(Boolean))) {
    const files = transcriptFilesForVimeoId(snapshot, vimeoId);
    const targetDir = publishedVimeoIds.has(vimeoId) ? VIDEO_TRANSCRIPT_REPO_DIR : VIDEO_DRAFT_TRANSCRIPT_REPO_DIR;
    const located = [
      ...files.published.map((file) => ({ ...file, dir: VIDEO_TRANSCRIPT_REPO_DIR })),
      ...files.drafts.map((file) => ({ ...file, dir: VIDEO_DRAFT_TRANSCRIPT_REPO_DIR })),
    ];

    if (upload && vimeoId === newVimeo) {
      const bytes = canonicalTranscriptBytes(Buffer.from(upload.text, "utf8"));
      readableVttParagraphs(bytes, "The uploaded VTT");
      const name = `${vimeoId}.vtt`;
      const target = `${targetDir}/${name}`;
      for (const file of located) {
        if (`${file.dir}/${file.name}` !== target) changes.push({ path: `${file.dir}/${file.name}`, delete: true });
      }
      const current = located.find((file) => `${file.dir}/${file.name}` === target);
      if (!current || current.sha !== gitBlobSha(bytes)) {
        changes.push({ path: target, content: bytes });
        summary.push(located.length ? "Replaced the English transcript." : "Added the English transcript.");
      }
      affected.set(vimeoId, targetDir === VIDEO_TRANSCRIPT_REPO_DIR ? [{ name, bytes }] : []);
      continue;
    }

    if (located.length === 0) {
      affected.set(vimeoId, []);
      continue;
    }
    const sources: TranscriptSourceFile[] = [];
    let moved = false;
    for (const file of located) {
      const from = `${file.dir}/${file.name}`;
      const to = `${targetDir}/${file.name}`;
      if (targetDir === VIDEO_TRANSCRIPT_REPO_DIR) {
        const bytes = await readFile(from);
        if (!bytes) throw new VideoSaveError(`The stored transcript ${from} could not be read, so nothing was saved.`);
        sources.push({ name: file.name, bytes });
      }
      if (from === to) continue;
      moved = true;
      const alreadyThere = located.some((other) => `${other.dir}/${other.name}` === to);
      if (!alreadyThere) changes.push({ path: to, copyOf: { path: from, sha: file.sha } });
      changes.push({ path: from, delete: true });
    }
    if (moved) {
      summary.push(
        targetDir === VIDEO_TRANSCRIPT_REPO_DIR
          ? "Moved the transcript onto the published video."
          : "Moved the transcript aside until the video is published again.",
      );
    }
    affected.set(vimeoId, sources);
  }

  let generated: CatalogTranscriptDocuments;
  try {
    generated = updateCatalogTranscriptDocuments({
      documents: parseGenerated(snapshot),
      catalog: catalogAfter as PublicVideoRow[],
      affected,
    });
  } catch (error) {
    if (error instanceof VideoSaveError) throw error;
    const message = error instanceof Error ? error.message : "The transcript could not be processed.";
    throw new VideoSaveError(`${message} Nothing was saved.`);
  }
  const before = parseGenerated(snapshot);
  const pairs = [
    [VIDEO_GENERATED_TRANSCRIPT_PATHS[0], before.publicDocument, generated.publicDocument],
    [VIDEO_GENERATED_TRANSCRIPT_PATHS[1], before.memberDocument, generated.memberDocument],
    [VIDEO_GENERATED_TRANSCRIPT_PATHS[2], before.audit, generated.audit],
  ] as const;
  for (const [path, previous, next] of pairs) {
    if (JSON.stringify(previous) === JSON.stringify(next)) continue;
    changes.push({ path, content: Buffer.from(serializeCatalogTranscriptJson(next), "utf8") });
  }
  if (pairs.some(([, previous, next]) => JSON.stringify(previous) !== JSON.stringify(next))) {
    summary.push("Updated the transcript shown on the video page.");
  }

  if (changes.length === 0) throw new VideoSaveError("Nothing changed, so there was nothing to save.");

  const afterSnapshot = {
    transcripts: {
      published: applyListing(snapshot.transcripts.published, changes, VIDEO_TRANSCRIPT_REPO_DIR),
      drafts: applyListing(snapshot.transcripts.drafts, changes, VIDEO_DRAFT_TRANSCRIPT_REPO_DIR),
    },
  };

  return {
    contentId: contentKey,
    added: !existing,
    record,
    changes,
    transcript: transcriptStateForVimeoId(afterSnapshot, newVimeo),
    summary,
  };
}

function applyListing(
  files: VideoRepoFileEntry[],
  changes: VideoRepoChange[],
  dir: string,
): VideoRepoFileEntry[] {
  const byName = new Map(files.map((file) => [file.name, file]));
  for (const change of changes) {
    if (!change.path.startsWith(`${dir}/`)) continue;
    const name = change.path.slice(dir.length + 1);
    if ("delete" in change) byName.delete(name);
    else byName.set(name, { name, sha: "copyOf" in change ? change.copyOf.sha : gitBlobSha(change.content) });
  }
  return [...byName.values()];
}

export function videoSaveCommitMessage(plan: VideoSavePlan, actor: string | null): string {
  const title = typeof plan.record.title === "string" ? plan.record.title : "";
  const status = typeof plan.record.status === "string" ? plan.record.status : "published";
  const lines = [
    `${plan.added ? "Add" : "Update"} video ${plan.contentId}: ${title} (${status})`,
    "",
    ...plan.summary,
    "",
    `Saved from the hosted video admin${actor ? ` by ${actor}` : ""}.`,
  ];
  return lines.join("\n");
}

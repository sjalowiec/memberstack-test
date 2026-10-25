/**
 * Run video saves against a catalog repo: read the latest files, plan, commit.
 * A save that races another commit is re-planned once on the newer files, so
 * two admins cannot both take the same new video number.
 */
import { normalizeVideoCatalogStatus } from "../videoPublic";
import { VideoCatalogConflictError, type VideoRepoChange } from "./videoCatalogGithub";
import type { VideoCatalogCommitResult, VideoCatalogRepo, VideoCatalogSnapshot } from "./videoCatalogRepo";
import {
  parseVideoCatalog,
  planVideoSave,
  VideoSaveError,
  videoSaveCommitMessage,
  type VideoSaveInput,
  type VideoSavePlan,
  type VideoSaveStatus,
} from "./videoCatalogSave";
import { videoContentIdKey } from "./videoPosterOverrides";

export type VideoSaveResult = {
  plan: VideoSavePlan;
  commit: VideoCatalogCommitResult;
};

async function withConflictRetry<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (!(error instanceof VideoCatalogConflictError)) throw error;
    return run();
  }
}

export function saveCatalogVideo(
  repo: VideoCatalogRepo,
  input: VideoSaveInput,
  actor: string | null,
): Promise<VideoSaveResult> {
  return withConflictRetry(async () => {
    const snapshot = await repo.readSnapshot();
    const plan = await planVideoSave(snapshot, input, (path) => repo.readFile(path, snapshot.ref));
    const commit = await repo.commit(snapshot, plan.changes, videoSaveCommitMessage(plan, actor));
    return { plan, commit };
  });
}

function storedStatus(video: Record<string, unknown>): VideoSaveStatus {
  return normalizeVideoCatalogStatus(video.status);
}

/** Carry one plan's file changes into the snapshot the next plan reads. */
function snapshotAfter(snapshot: VideoCatalogSnapshot, changes: VideoRepoChange[]): VideoCatalogSnapshot {
  const next: VideoCatalogSnapshot = {
    ...snapshot,
    generated: { ...snapshot.generated },
    transcripts: { published: [...snapshot.transcripts.published], drafts: [...snapshot.transcripts.drafts] },
  };
  for (const change of changes) {
    if (!("content" in change)) {
      throw new VideoSaveError("Access changes cannot move transcript files. Save those videos one at a time.");
    }
    const text = change.content.toString("utf8");
    if (change.path.endsWith("videos-public.json")) next.catalogRaw = text;
    else if (change.path.endsWith("generated/public.json")) next.generated.public = text;
    else if (change.path.endsWith("generated/member.json")) next.generated.member = text;
    else if (change.path.endsWith("generated/audit.json")) next.generated.audit = text;
    else throw new VideoSaveError("Access changes cannot change transcript files. Save those videos one at a time.");
  }
  return next;
}

export type AccessLevelUpdate = { content_id: string | number; access_level: string };

/** Change access on several videos in one commit, moving each transcript to the matching file. */
export function saveCatalogAccessLevels(
  repo: VideoCatalogRepo,
  updates: AccessLevelUpdate[],
  actor: string | null,
): Promise<{ updated: AccessLevelUpdate[]; notFound: string[]; commit: VideoCatalogCommitResult | null }> {
  return withConflictRetry(async () => {
    const original = await repo.readSnapshot();
    let snapshot = original;
    const updated: AccessLevelUpdate[] = [];
    const notFound: string[] = [];
    for (const update of updates) {
      const key = videoContentIdKey(update.content_id);
      const video = parseVideoCatalog(snapshot.catalogRaw).find(
        (row) => videoContentIdKey(row.content_id) === key,
      );
      if (!video) {
        notFound.push(key);
        continue;
      }
      let plan: VideoSavePlan;
      try {
        plan = await planVideoSave(
          snapshot,
          { action: "update", contentId: key, status: storedStatus(video), video: { access_level: update.access_level } },
          (path) => repo.readFile(path, original.ref),
        );
      } catch (error) {
        if (error instanceof VideoSaveError && /Nothing changed/.test(error.message)) continue;
        if (error instanceof Error) throw new VideoSaveError(`Video ${key}: ${error.message}`);
        throw error;
      }
      snapshot = snapshotAfter(snapshot, plan.changes);
      updated.push({ content_id: video.content_id as string | number, access_level: String(plan.record.access_level ?? "") });
    }

    if (updated.length === 0) {
      if (notFound.length) throw new VideoSaveError(`No matching videos found for content_id: ${notFound.join(", ")}.`);
      return { updated, notFound, commit: null };
    }

    const changes: VideoRepoChange[] = [];
    const pairs = [
      ["src/data/videos-public.json", original.catalogRaw, snapshot.catalogRaw],
      ["src/data/transcripts/generated/public.json", original.generated.public, snapshot.generated.public],
      ["src/data/transcripts/generated/member.json", original.generated.member, snapshot.generated.member],
      ["src/data/transcripts/generated/audit.json", original.generated.audit, snapshot.generated.audit],
    ] as const;
    for (const [path, before, after] of pairs) {
      if (before !== after) changes.push({ path, content: Buffer.from(after, "utf8") });
    }
    const message = [
      `Update access for ${updated.length} video${updated.length === 1 ? "" : "s"}`,
      "",
      ...updated.map((row) => `Video ${videoContentIdKey(row.content_id)}: ${row.access_level}`),
      "",
      `Saved from the hosted video admin${actor ? ` by ${actor}` : ""}.`,
    ].join("\n");
    const commit = await repo.commit(original, changes, message);
    return { updated, notFound, commit };
  });
}

function stableJson(value: unknown): string {
  const sort = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(sort);
    if (!input || typeof input !== "object") return input;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(input as Record<string, unknown>).sort()) {
      out[key] = sort((input as Record<string, unknown>)[key]);
    }
    return out;
  };
  return JSON.stringify(sort(value));
}

export type VideoLiveState = "live" | "building" | "new";

/** Compare the saved record with the catalog this deploy was built from. */
export function videoLiveState(
  saved: Record<string, unknown> | undefined,
  deployedCatalog: unknown[],
): VideoLiveState {
  if (!saved) return "new";
  const key = videoContentIdKey(saved.content_id);
  const deployed = deployedCatalog.find(
    (row) => row && typeof row === "object" && videoContentIdKey((row as Record<string, unknown>).content_id) === key,
  );
  if (!deployed) return "new";
  return stableJson(deployed) === stableJson(saved) ? "live" : "building";
}

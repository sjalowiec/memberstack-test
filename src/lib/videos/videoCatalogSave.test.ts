import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { PublicVideoRow } from "../lessonVideo";
import { gitBlobSha } from "../machines/machineSalesGithub";
import {
  buildCatalogTranscriptDocuments,
  serializeCatalogTranscriptJson,
} from "../transcripts/generateCatalogTranscripts";
import { VideoCatalogConflictError, type VideoRepoChange } from "./videoCatalogGithub";
import { deployedVideoCatalogRepo, filesystemVideoCatalogRepo, type VideoCatalogRepo, type VideoCatalogSnapshot } from "./videoCatalogRepo";
import {
  nextVideoContentId,
  planVideoSave,
  slugFromTitle,
  uniqueVideoSlug,
  type VideoSaveInput,
} from "./videoCatalogSave";
import { changesKeptForRepo, saveCatalogAccessLevels, saveCatalogVideo, videoLiveState } from "./videoCatalogService";

const EN = "src/data/transcripts/en";
const DRAFTS = "src/data/transcripts/drafts/en";
const CATALOG = "src/data/videos-public.json";
const GENERATED = {
  public: "src/data/transcripts/generated/public.json",
  member: "src/data/transcripts/generated/member.json",
  audit: "src/data/transcripts/generated/audit.json",
};

function vtt(line: string): string {
  return `WEBVTT\n\n00:00:01.000 --> 00:00:03.000\n${line}\n`;
}

const seedCatalog = [
  { content_id: 249, slug: "full-video", title: "Full Video", access_level: "member", vimeo_id: 100, clips: ["249-1"] },
  { content_id: "249-1", slug: "full-video-clip", title: "Clip", access_level: "member", vimeo_id: 101 },
  { content_id: 5003, slug: "shaping-a-sideways-v-neck", title: "Shaping a Sideways V-Neck", access_level: "member", status: "published", vimeo_id: 1239125400 },
  { content_id: 300, slug: "free-swatch", title: "Free Swatch", access_level: "public", vimeo_id: 300300 },
];

/** In-memory repo whose files change only through commit, like GitHub. */
function memoryRepo(initial: Record<string, string>) {
  const files = new Map<string, Buffer>(
    Object.entries(initial).map(([path, body]) => [path, Buffer.from(body, "utf8")]),
  );
  let head = 1;
  const commits: string[] = [];
  const list = (dir: string) =>
    [...files.keys()]
      .filter((path) => path.startsWith(`${dir}/`) && !path.slice(dir.length + 1).includes("/"))
      .map((path) => ({ name: path.slice(dir.length + 1), sha: gitBlobSha(files.get(path)!) }));
  const repo: VideoCatalogRepo & { files: typeof files; commits: string[]; beforeCommit?: () => void } = {
    mode: "github",
    branch: "dev",
    files,
    commits,
    async readSnapshot(): Promise<VideoCatalogSnapshot> {
      const read = (path: string) => files.get(path)!.toString("utf8");
      return {
        ref: String(head),
        catalogRaw: read(CATALOG),
        generated: { public: read(GENERATED.public), member: read(GENERATED.member), audit: read(GENERATED.audit) },
        transcripts: { published: list(EN), drafts: list(DRAFTS) },
      };
    },
    async readFile(path) {
      return files.get(path) ?? null;
    },
    async commit(snapshot, changes: VideoRepoChange[], message) {
      repo.beforeCommit?.();
      if (snapshot.ref !== String(head)) throw new VideoCatalogConflictError();
      const copies = new Map<string, Buffer>();
      for (const change of changes) if ("copyOf" in change) copies.set(change.path, files.get(change.copyOf.path)!);
      for (const change of changes) {
        if ("delete" in change) files.delete(change.path);
        else files.set(change.path, "copyOf" in change ? copies.get(change.path)! : change.content);
      }
      head += 1;
      commits.push(message);
      return { persistedVia: "github", branch: "dev", commitSha: `sha${head}` };
    },
  };
  return repo;
}

function seededRepo(extra: Record<string, string> = {}) {
  const transcripts: Record<string, string> = {
    [`${EN}/1239125400.vtt`]: vtt("Shape the first side of the neck."),
    [`${EN}/300300.vtt`]: vtt("Knit a proper swatch."),
    ...extra,
  };
  const sources = Object.entries(transcripts)
    .filter(([path]) => path.startsWith(`${EN}/`))
    .map(([path, body]) => ({ name: path.slice(EN.length + 1), bytes: Buffer.from(body, "utf8") }));
  const docs = buildCatalogTranscriptDocuments({ sources, catalog: seedCatalog as PublicVideoRow[] });
  return memoryRepo({
    [CATALOG]: `${JSON.stringify(seedCatalog, null, 2)}\n`,
    [GENERATED.public]: serializeCatalogTranscriptJson(docs.publicDocument),
    [GENERATED.member]: serializeCatalogTranscriptJson(docs.memberDocument),
    [GENERATED.audit]: serializeCatalogTranscriptJson(docs.audit),
    ...transcripts,
  });
}

function catalogOf(repo: ReturnType<typeof memoryRepo>): Record<string, unknown>[] {
  return JSON.parse(repo.files.get(CATALOG)!.toString("utf8"));
}

function generatedOf(repo: ReturnType<typeof memoryRepo>, kind: keyof typeof GENERATED) {
  return JSON.parse(repo.files.get(GENERATED[kind])!.toString("utf8"));
}

const newVideo = {
  slug: "casting-on-test",
  title: "Casting On Test",
  description: "A short test video.",
  category: "Basics",
  access_level: "member",
  vimeo_id: 777000,
};

function create(video: Record<string, unknown> = newVideo, extra: Partial<VideoSaveInput> = {}): VideoSaveInput {
  return { action: "create", status: "draft", video, ...extra };
}

describe("video numbers and slugs", () => {
  it("assigns the next whole number and skips clip numbers", () => {
    expect(nextVideoContentId(seedCatalog)).toBe(5004);
  });

  it("makes a slug from the title and keeps it unique", () => {
    expect(slugFromTitle("Shaping a Sideways V-Neck!")).toBe("shaping-a-sideways-v-neck");
    expect(slugFromTitle("Café & Cast-On's")).toBe("cafe-and-cast-ons");
    expect(uniqueVideoSlug("shaping-a-sideways-v-neck", seedCatalog)).toBe("shaping-a-sideways-v-neck-2");
    expect(uniqueVideoSlug("shaping-a-sideways-v-neck", seedCatalog, "5003")).toBe("shaping-a-sideways-v-neck");
  });
});

describe("saving a video", () => {
  it("creates a draft with the next number and keeps its VTT out of the build", async () => {
    const repo = seededRepo();
    const before = repo.files.get(CATALOG)!.toString("utf8");
    const { plan } = await saveCatalogVideo(repo, create(newVideo, { vtt: { filename: "x.vtt", text: vtt("Hello knitters.") } }), "sue@example.com");

    expect(plan.contentId).toBe("5004");
    expect(plan.added).toBe(true);
    expect(plan.transcript).toBe("draft");
    const saved = catalogOf(repo).at(-1)!;
    expect(saved).toMatchObject({ content_id: 5004, status: "draft", slug: "casting-on-test", vimeo_id: 777000 });
    expect(Object.keys(saved).slice(0, 3)).toEqual(["content_id", "slug", "title"]);
    expect(saved).not.toHaveProperty("isTipOfWeek");
    // Every existing record keeps its exact text.
    expect(repo.files.get(CATALOG)!.toString("utf8").startsWith(before.slice(0, before.lastIndexOf("}") + 1))).toBe(true);
    expect(repo.files.has(`${DRAFTS}/777000.vtt`)).toBe(true);
    expect(repo.files.has(`${EN}/777000.vtt`)).toBe(false);
    expect(generatedOf(repo, "audit").records.map((r: { vimeoId: string }) => r.vimeoId)).not.toContain("777000");
    expect(repo.commits[0]).toContain("Add video 5004: Casting On Test (draft)");
    expect(repo.commits[0]).toContain("sue@example.com");
  });

  it("publishes a draft, moves its VTT into the build, and keeps a member transcript out of public.json", async () => {
    const repo = seededRepo();
    await saveCatalogVideo(repo, create(newVideo, { vtt: { filename: "x.vtt", text: vtt("Hello knitters.") } }), null);
    const { plan } = await saveCatalogVideo(
      repo,
      { action: "update", contentId: 5004, status: "published", video: newVideo },
      null,
    );

    expect(plan.transcript).toBe("published");
    expect(repo.files.has(`${EN}/777000.vtt`)).toBe(true);
    expect(repo.files.has(`${DRAFTS}/777000.vtt`)).toBe(false);
    expect(JSON.stringify(generatedOf(repo, "member"))).toContain("Hello knitters.");
    expect(JSON.stringify(generatedOf(repo, "public"))).not.toContain("Hello knitters.");
    expect(catalogOf(repo).find((row) => row.content_id === 5004)?.status).toBe("published");
  });

  it("puts a free video's transcript in public.json", async () => {
    const repo = seededRepo();
    await saveCatalogVideo(
      repo,
      create({ ...newVideo, access_level: "public" }, { status: "published", vtt: { filename: "x.vtt", text: vtt("Free words.") } }),
      null,
    );
    expect(JSON.stringify(generatedOf(repo, "public"))).toContain("Free words.");
    expect(JSON.stringify(generatedOf(repo, "member"))).not.toContain("Free words.");
  });

  it("edits a video without changing its number or other fields", async () => {
    const repo = seededRepo();
    await saveCatalogVideo(
      repo,
      { action: "update", contentId: "249", status: "published", video: { content_id: 999, title: "Renamed Full Video" } },
      null,
    );
    const row = catalogOf(repo).find((video) => video.slug === "full-video")!;
    expect(row).toMatchObject({ content_id: 249, title: "Renamed Full Video", clips: ["249-1"] });
    expect(row).not.toHaveProperty("status");
    expect(catalogOf(repo).find((video) => video.content_id === "249-1")).toEqual(seedCatalog[1]);
  });

  it("refuses a second video with the same Vimeo ID", async () => {
    const repo = seededRepo();
    await expect(saveCatalogVideo(repo, create({ ...newVideo, vimeo_id: 1239125400 }), null)).rejects.toThrow(
      /Vimeo ID 1239125400 is already used by video 5003/,
    );
    expect(repo.commits).toHaveLength(0);
  });

  it("refuses a slug another video uses, or one that is not URL-safe", async () => {
    const repo = seededRepo();
    await expect(saveCatalogVideo(repo, create({ ...newVideo, slug: "free-swatch" }), null)).rejects.toThrow(
      /already used by video 300/,
    );
    await expect(saveCatalogVideo(repo, create({ ...newVideo, slug: "Bad Slug" }), null)).rejects.toThrow(/lowercase/);
  });

  it("replaces a published VTT, drops an older variant file, and refreshes the transcript", async () => {
    const repo = seededRepo({ [`${EN}/300300_en.vtt`]: vtt("Knit a proper swatch.") });
    await saveCatalogVideo(
      repo,
      {
        action: "update",
        contentId: 300,
        status: "published",
        video: {},
        vtt: { filename: "new.vtt", text: vtt("A better swatch.").replace(/\n/g, "\r\n") },
      },
      null,
    );
    expect(repo.files.has(`${EN}/300300_en.vtt`)).toBe(false);
    expect(repo.files.get(`${EN}/300300.vtt`)!.toString("utf8")).not.toContain("\r");
    expect(JSON.stringify(generatedOf(repo, "public"))).toContain("A better swatch.");
    expect(JSON.stringify(generatedOf(repo, "public"))).not.toContain("Knit a proper swatch.");
  });

  it("moves an archived video's VTT aside and removes its transcript", async () => {
    const repo = seededRepo();
    await saveCatalogVideo(repo, { action: "update", contentId: 300, status: "archived", video: {} }, null);
    expect(repo.files.has(`${EN}/300300.vtt`)).toBe(false);
    expect(repo.files.has(`${DRAFTS}/300300.vtt`)).toBe(true);
    expect(generatedOf(repo, "public").records).toHaveLength(0);
  });

  it("rejects a file that is not a caption file", async () => {
    const repo = seededRepo();
    await expect(
      saveCatalogVideo(repo, create(newVideo, { vtt: { filename: "x.vtt", text: "hello" } }), null),
    ).rejects.toThrow(/does not start with WEBVTT/);
    await expect(
      saveCatalogVideo(repo, create(newVideo, { vtt: { filename: "x.vtt", text: "WEBVTT\n\n" } }), null),
    ).rejects.toThrow(/no spoken text/);
  });

  it("re-plans on the newer catalog when another save lands first", async () => {
    const repo = seededRepo();
    let raced = false;
    repo.beforeCommit = () => {
      if (raced) return;
      raced = true;
      // Someone else adds video 5004 between our read and our commit.
      const others = catalogOf(repo);
      others.push({ content_id: 5004, slug: "someone-else", title: "Someone Else", vimeo_id: 888 });
      repo.files.set(CATALOG, Buffer.from(`${JSON.stringify(others, null, 2)}\n`, "utf8"));
      void repo.commit({ ref: "1" } as VideoCatalogSnapshot, [], "other");
    };
    const { plan } = await saveCatalogVideo(repo, create(), null);
    expect(plan.contentId).toBe("5005");
    expect(catalogOf(repo).map((row) => row.content_id)).toEqual([249, "249-1", 5003, 300, 5004, 5005]);
  });

  it("changes access for several videos in one commit and moves their transcripts", async () => {
    const repo = seededRepo();
    const result = await saveCatalogAccessLevels(
      repo,
      [
        { content_id: 5003, access_level: "public" },
        { content_id: "nope", access_level: "member" },
      ],
      null,
    );
    expect(result.updated).toEqual([{ content_id: 5003, access_level: "public" }]);
    expect(result.notFound).toEqual(["nope"]);
    expect(repo.commits).toHaveLength(1);
    expect(JSON.stringify(generatedOf(repo, "public"))).toContain("Shape the first side");
    expect(JSON.stringify(generatedOf(repo, "member"))).not.toContain("Shape the first side");
  });
});

describe("database catalog without GitHub", () => {
  it("reads the deployed catalog when GitHub is not configured", async () => {
    const snapshot = await deployedVideoCatalogRepo().readSnapshot();
    expect(snapshot.catalogRaw).toContain("5003");
    expect(JSON.parse(snapshot.generated.member)).toBeTruthy();
    await expect(deployedVideoCatalogRepo().commit(snapshot, [], "unused")).resolves.toEqual({
      persistedVia: "database",
    });
  });
});

describe("database catalog commits", () => {
  it("keeps transcript files and leaves the catalog and generated JSON out of the repo commit", () => {
    const changes: VideoRepoChange[] = [
      { path: "src/data/videos-public.json", content: Buffer.from("[]") },
      { path: "src/data/transcripts/generated/public.json", content: Buffer.from("{}") },
      { path: "src/data/transcripts/en/1.vtt", content: Buffer.from("WEBVTT") },
    ];
    expect(changesKeptForRepo(changes, true).map((change) => change.path)).toEqual(["src/data/transcripts/en/1.vtt"]);
    expect(changesKeptForRepo(changes, false)).toHaveLength(3);
  });
});

describe("live check", () => {
  it("reports live once the deployed record matches the saved one", () => {
    const saved = { content_id: 5003, title: "A", slug: "a" };
    expect(videoLiveState(saved, [{ slug: "a", title: "A", content_id: 5003 }])).toBe("live");
    expect(videoLiveState(saved, [{ content_id: 5003, title: "Old", slug: "a" }])).toBe("building");
    expect(videoLiveState(saved, [])).toBe("new");
  });
});

describe("saving against the real catalog", () => {
  const root = process.cwd();
  const realRepo = filesystemVideoCatalogRepo(root);

  it("adds and publishes a new video with only that record and its transcript changing", async () => {
    const snapshot = await realRepo.readSnapshot();
    const plan = await planVideoSave(
      snapshot,
      create({ ...newVideo, vimeo_id: 999999001 }, { status: "published", vtt: { filename: "a.vtt", text: vtt("Brand new words.") } }),
      (path) => realRepo.readFile(path, null),
    );
    expect(plan.contentId).toBe("5004");
    const catalogChange = plan.changes.find((change) => change.path === CATALOG);
    const nextRaw = catalogChange && "content" in catalogChange ? catalogChange.content.toString("utf8") : "";
    const before = snapshot.catalogRaw.replace(/\r\n/g, "\n");
    const lastRecordEnd = before.lastIndexOf("}");
    expect(nextRaw.replace(/\r\n/g, "\n").slice(0, lastRecordEnd + 1)).toBe(before.slice(0, lastRecordEnd + 1));

    const catalogAfter = JSON.parse(nextRaw) as PublicVideoRow[];
    expect(catalogAfter.find((row) => row.content_id === 5003)).toEqual(
      (JSON.parse(snapshot.catalogRaw) as PublicVideoRow[]).find((row) => row.content_id === 5003),
    );

    // The generated files equal a full run over the stored VTTs plus the new one.
    const sources = readdirSync(join(root, EN))
      .filter((name) => name.endsWith(".vtt"))
      .map((name) => ({ name, bytes: readFileSync(join(root, EN, name)) }));
    sources.push({ name: "999999001.vtt", bytes: Buffer.from(vtt("Brand new words."), "utf8") });
    const full = buildCatalogTranscriptDocuments({ sources, catalog: catalogAfter });
    const byPath = new Map(
      plan.changes.filter((change) => "content" in change).map((change) => [change.path, (change as { content: Buffer }).content.toString("utf8")]),
    );
    expect(byPath.get(GENERATED.member)).toBe(serializeCatalogTranscriptJson(full.memberDocument));
    expect(byPath.get(GENERATED.audit)).toBe(serializeCatalogTranscriptJson(full.audit));
    expect(byPath.has(GENERATED.public)).toBe(false);
    expect(plan.changes.map((change) => change.path).sort()).toEqual(
      [CATALOG, `${EN}/999999001.vtt`, GENERATED.audit, GENERATED.member].sort(),
    );
  });
});

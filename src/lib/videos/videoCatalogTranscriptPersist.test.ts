import { beforeEach, describe, expect, it, vi } from "vitest";

import videos from "../../data/videos-public.json";
import type { CatalogTranscriptArtifact } from "../transcripts/catalogTranscriptData";
import { paragraphsForVimeoId } from "../transcripts/catalogTranscriptData";
import type { VideoRepoChange } from "./videoCatalogGithub";
import { deployedVideoCatalogRepo, type VideoCatalogSnapshot } from "./videoCatalogRepo";
import { transcriptStateForVimeoId } from "./videoCatalogSave";
import { saveCatalogVideo } from "./videoCatalogService";

const state = vi.hoisted(() => ({
  catalog: [] as unknown[],
  docs: {} as { public?: string; member?: string; audit?: string },
  files: [] as { path: string; content: string; sha: string }[],
  failFiles: false,
}));

vi.mock("./videoCatalogStore", () => ({
  videoCatalogDatabaseEnabled: () => true,
  loadMergedVideoCatalog: async () => state.catalog,
  saveVideoCatalogEdits: async (rows: unknown[]) => {
    state.catalog = rows;
    return rows;
  },
}));

vi.mock("./videoTranscriptStore", () => ({
  transcriptStorageErrorMessage: (_error: unknown, fallback: string) => fallback,
  saveGeneratedTranscriptDocuments: async (changes: VideoRepoChange[]) => {
    for (const change of changes) {
      if (!("content" in change)) continue;
      const text = change.content.toString("utf8");
      if (change.path.endsWith("/public.json")) state.docs.public = text;
      else if (change.path.endsWith("/member.json")) state.docs.member = text;
      else if (change.path.endsWith("/audit.json")) state.docs.audit = text;
    }
  },
  loadStoredGeneratedTranscriptTexts: async () => ({ ...state.docs }),
  applyStoredTranscriptFileChanges: async (changes: VideoRepoChange[]) => {
    if (state.failFiles) throw new Error("The transcript could not be stored. Nothing was saved.");
    for (const change of changes) {
      const path = change.path.replace(/\\/g, "/");
      if (!path.endsWith(".vtt")) throw new Error("The transcript upload could not be stored. Nothing was saved.");
      if ("delete" in change) {
        state.files = state.files.filter((file) => file.path !== path);
        continue;
      }
      if (!("content" in change)) continue;
      state.files = state.files.filter((file) => file.path !== path);
      state.files.push({ path, content: change.content.toString("utf8"), sha: "stored" });
    }
  },
  listStoredTranscriptFiles: async () => ({
    published: state.files
      .filter((file) => file.path.includes("/transcripts/en/"))
      .map((file) => ({ name: file.path.split("/").pop()!, sha: file.sha })),
    drafts: state.files
      .filter((file) => file.path.includes("/drafts/"))
      .map((file) => ({ name: file.path.split("/").pop()!, sha: file.sha })),
  }),
  readStoredTranscriptFile: async (path: string) => {
    const file = state.files.find((item) => item.path === path);
    return file ? Buffer.from(file.content, "utf8") : null;
  },
}));

function vtt(line: string): string {
  return `WEBVTT\n\n00:00:01.000 --> 00:00:03.000\n${line}\n`;
}

const sentence = "Pinwheel short rows make the circle.";

describe("database transcript persistence", () => {
  beforeEach(() => {
    state.catalog = JSON.parse(JSON.stringify(videos));
    state.docs = {};
    state.files = [];
    state.failFiles = false;
  });

  it("returns success for an empty commit and does not invent stored files", async () => {
    const repo = deployedVideoCatalogRepo();
    await expect(repo.commit({} as VideoCatalogSnapshot, [], "unused")).resolves.toEqual({
      persistedVia: "database",
    });
    expect(state.files).toEqual([]);
  });

  it("stores a published member VTT, shows it when the editor reopens, and keeps it out of the public transcript", async () => {
    const repo = deployedVideoCatalogRepo();
    const saved = await saveCatalogVideo(
      repo,
      {
        action: "create",
        status: "published",
        video: {
          slug: "transcript-persist-test",
          title: "Transcript Persist Test",
          description: "A stored transcript.",
          category: "Basics",
          access_level: "member",
          vimeo_id: 999999001,
        },
        vtt: { filename: "upload.vtt", text: vtt(sentence) },
      },
      "sue@example.com",
    );

    expect(saved.commit.persistedVia).toBe("database");
    const snapshot = await repo.readSnapshot();
    expect(transcriptStateForVimeoId(snapshot, "999999001")).toBe("published");
    const bytes = await repo.readFile("src/data/transcripts/en/999999001.vtt", null);
    expect(bytes?.toString("utf8")).toContain(sentence);
    expect(state.docs.member).toContain(sentence);
    expect(state.docs.public ?? "").not.toContain(sentence);
    expect(paragraphsForVimeoId(JSON.parse(state.docs.member!) as CatalogTranscriptArtifact, "999999001")).toEqual([
      sentence,
    ]);
    expect(JSON.parse(state.docs.member!).records.length).toBeGreaterThan(10);

    await saveCatalogVideo(
      repo,
      {
        action: "update",
        contentId: saved.plan.contentId,
        status: "published",
        video: { title: "Transcript Persist Test renamed" },
      },
      null,
    );
    const reopened = await repo.readSnapshot();
    expect(transcriptStateForVimeoId(reopened, "999999001")).toBe("published");
    expect(JSON.parse(reopened.generated.member).records).toEqual(
      expect.arrayContaining([expect.objectContaining({ vimeoId: "999999001", paragraphs: [sentence] })]),
    );
    expect(JSON.stringify(JSON.parse(reopened.generated.public))).not.toContain(sentence);
  });

  it("does not report success or publish the video when the VTT is discarded", async () => {
    state.failFiles = true;
    const before = state.catalog.length;
    await expect(
      saveCatalogVideo(
        deployedVideoCatalogRepo(),
        {
          action: "create",
          status: "published",
          video: {
            slug: "transcript-discard-test",
            title: "Transcript Discard Test",
            description: "Should not publish.",
            category: "Basics",
            access_level: "member",
            vimeo_id: 999999002,
          },
          vtt: { filename: "upload.vtt", text: vtt(sentence) },
        },
        null,
      ),
    ).rejects.toThrow(/could not be stored/);
    expect(state.catalog).toHaveLength(before);
    expect(state.files).toEqual([]);
    expect(JSON.stringify(state.catalog)).not.toContain("transcript-discard-test");
  });
});

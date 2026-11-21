import { describe, expect, it, vi } from "vitest";

import { CATALOG_TRANSCRIPT_GENERATOR } from "../transcripts/catalogTranscriptData";
import { serializeCatalogTranscriptJson } from "../transcripts/generateCatalogTranscripts";
import type { VideoRepoChange } from "./videoCatalogGithub";
import {
  applyStoredTranscriptFileChanges,
  applyTranscriptFileEdits,
  generatedDocumentsFromChanges,
  saveGeneratedTranscriptDocuments,
  transcriptListings,
  VIDEO_TRANSCRIPT_FILE_DELETE_SQL,
  VIDEO_TRANSCRIPT_FILE_UPSERT_SQL,
} from "./videoTranscriptStore";

const MEMBER = "src/data/transcripts/generated/member.json";
const PUBLIC = "src/data/transcripts/generated/public.json";
const EN = "src/data/transcripts/en";
const DRAFTS = "src/data/transcripts/drafts/en";

function doc(kind: "public" | "member", paragraph: string) {
  return Buffer.from(
    serializeCatalogTranscriptJson({
      generator: CATALOG_TRANSCRIPT_GENERATOR,
      kind,
      records: [{ vimeoId: "151859578", sourceFile: "151859578.vtt", sourceSha256: "abc", paragraphs: [paragraph] }],
    }),
    "utf8",
  );
}

describe("transcript file edits", () => {
  it("stores a published VTT and lists it for the editor", () => {
    const next = applyTranscriptFileEdits([], [
      { path: `${EN}/151859578.vtt`, content: Buffer.from("WEBVTT\n\nHello pinwheel.\n", "utf8") },
    ]);
    expect(next).toHaveLength(1);
    expect(next[0].content).toContain("Hello pinwheel.");
    expect(transcriptListings(next).published.map((file) => file.name)).toEqual(["151859578.vtt"]);
    expect(transcriptListings(next).drafts).toEqual([]);
  });

  it("moves a draft to the published folder and deletes the draft", () => {
    const existing = applyTranscriptFileEdits([], [
      { path: `${DRAFTS}/151859578.vtt`, content: Buffer.from("WEBVTT\n\nHello pinwheel.\n", "utf8") },
    ]);
    const next = applyTranscriptFileEdits(existing, [
      { path: `${EN}/151859578.vtt`, copyOf: { path: `${DRAFTS}/151859578.vtt`, sha: existing[0].sha } },
      { path: `${DRAFTS}/151859578.vtt`, delete: true },
    ]);
    expect(next.map((file) => file.path)).toEqual([`${EN}/151859578.vtt`]);
    expect(next[0].content).toContain("Hello pinwheel.");
  });

  it("refuses to discard a file that is not an English VTT", () => {
    const change: VideoRepoChange = { path: "src/data/videos-public.json", content: Buffer.from("[]") };
    expect(() => applyTranscriptFileEdits([], [change])).toThrow(/could not be stored/);
  });

  it("refuses a copy when the stored VTT is missing", () => {
    expect(() =>
      applyTranscriptFileEdits([], [
        { path: `${EN}/151859578.vtt`, copyOf: { path: `${DRAFTS}/151859578.vtt`, sha: "missing" } },
      ]),
    ).toThrow(/could not be read/);
  });
});

describe("generated transcript documents", () => {
  it("keeps public and member documents and ignores the VTT bytes", () => {
    const docs = generatedDocumentsFromChanges([
      { path: MEMBER, content: doc("member", "Member only pinwheel.") },
      { path: PUBLIC, content: doc("public", "Free pinwheel.") },
      { path: `${EN}/151859578.vtt`, content: Buffer.from("WEBVTT") },
    ]);
    expect(docs.map((item) => item.kind)).toEqual(["member", "public"]);
    expect(docs[0].text).toContain("Member only pinwheel.");
    expect(docs[1].text).not.toContain("Member only pinwheel.");
  });

  it("refuses a document that is not a generated transcript", () => {
    expect(() =>
      generatedDocumentsFromChanges([{ path: MEMBER, content: Buffer.from("{}", "utf8") }]),
    ).toThrow(/could not be stored/);
  });
});

describe("transcript database writes", () => {
  it("upserts generated JSON and does not write the catalog", async () => {
    const writes: Array<{ sql: string; params?: unknown[] }> = [];
    await saveGeneratedTranscriptDocuments(
      [
        { path: MEMBER, content: doc("member", "Member only pinwheel.") },
        { path: `${EN}/151859578.vtt`, content: Buffer.from("WEBVTT") },
      ],
      async (run) => {
        await run(async (sql, params) => {
          writes.push({ sql, params });
          return [];
        });
      },
    );
    expect(writes).toHaveLength(1);
    expect(writes[0].sql).toContain("video_transcript_documents");
    expect(writes[0].params?.[0]).toBe("member");
    expect(String(writes[0].params?.[1])).toContain("Member only pinwheel.");
    expect(writes[0].sql).not.toContain("videos-public");
  });

  it("writes a VTT and does not report a delete of a file that was stored", async () => {
    const writes: string[] = [];
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("SELECT")) {
        return [{ path: `${DRAFTS}/151859578.vtt`, content: "WEBVTT\n\nold\n", sha: "old" }];
      }
      return [];
    });
    await applyStoredTranscriptFileChanges(
      [
        { path: `${EN}/151859578.vtt`, content: Buffer.from("WEBVTT\n\nHello pinwheel.\n", "utf8") },
        { path: `${DRAFTS}/151859578.vtt`, delete: true },
      ],
      query,
      async (run) => {
        await run(async (sql, params) => {
          writes.push(`${sql} ${JSON.stringify(params)}`);
          return [];
        });
      },
    );
    expect(writes.some((sql) => sql.includes(VIDEO_TRANSCRIPT_FILE_UPSERT_SQL.trim().slice(0, 20)))).toBe(true);
    expect(writes.some((sql) => sql.includes("Hello pinwheel."))).toBe(true);
    expect(writes.some((sql) => sql.includes(VIDEO_TRANSCRIPT_FILE_DELETE_SQL.trim().slice(0, 20)))).toBe(true);
    expect(writes.join("\n")).not.toContain("videos-public");
  });

  it("does not write when the upload path is refused", async () => {
    const transaction = vi.fn();
    await expect(
      applyStoredTranscriptFileChanges(
        [{ path: "notes.txt", content: Buffer.from("WEBVTT") }],
        async () => [],
        transaction,
      ),
    ).rejects.toThrow(/could not be stored/);
    expect(transaction).not.toHaveBeenCalled();
  });
});

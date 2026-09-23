import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { PublicVideoRow } from "../lessonVideo";
import {
  assertSafeTranscriptOverwrite,
  buildCatalogTranscriptDocuments,
  serializeCatalogTranscriptJson,
} from "./generateCatalogTranscripts";

const repo = process.cwd();
const MEMBER_SENTENCE = "Begin by casting on three stitches";
const PUBLIC_SENTENCE = "Knitting a proper swatch is the key to success with your knitting machine.";

describe("catalog transcript generation", () => {
  it("splits the committed proof VTTs into separate public and member documents", () => {
    const catalog = JSON.parse(
      readFileSync(join(repo, "src", "data", "videos-public.json"), "utf8"),
    ) as PublicVideoRow[];
    const docs = buildCatalogTranscriptDocuments({
      sourceDir: join(repo, "src", "data", "transcripts", "en"),
      catalog,
    });

    const publicProof = docs.publicDocument.records.find((record) => record.vimeoId === "1046394794");
    const memberProof = docs.memberDocument.records.find((record) => record.vimeoId === "151857129");
    expect(publicProof?.paragraphs.join(" ")).toContain(PUBLIC_SENTENCE);
    expect(memberProof?.paragraphs.join(" ")).toContain(MEMBER_SENTENCE);
    expect(docs.memberDocument.records.some((record) => record.vimeoId === "1046394794")).toBe(false);
    expect(docs.publicDocument.records.some((record) => record.vimeoId === "151857129")).toBe(false);
    expect(JSON.stringify(docs.publicDocument)).not.toContain(MEMBER_SENTENCE);
    expect(JSON.stringify(docs.publicDocument)).not.toContain("WEBVTT");
    expect(JSON.stringify(docs.memberDocument)).not.toContain(PUBLIC_SENTENCE);
    expect(publicProof?.sourceSha256).toBe(
      "e719cee93c063d08b7d0238a7761c9773d07cf1f6d727aa1ab208829e34f9107",
    );
    expect(memberProof?.sourceSha256).toBe(
      "a66776f8a7148e1744abb28a3ff9fcbf7f18b541a866c8cde43d936eaddbb421",
    );
    expect(docs.audit.publicCount).toBe(13);
    expect(docs.audit.memberCount).toBe(236);
    // Published, but the source VTTs have no spoken text: content 487
    // (151858276) is a WEBVTT header only, and content 503 (151858332)
    // is that header plus the placeholder "dsfsd".
    expect(docs.audit.records.some((record) => record.vimeoId === "151858276")).toBe(false);
    expect(docs.audit.records.some((record) => record.vimeoId === "151858332")).toBe(false);
    expect(docs.audit.duplicatePublishedRows).toEqual([
      { vimeoId: "537425558", contentIds: ["237", "1035"] },
      { vimeoId: "569614718", contentIds: ["2060", "2061"] },
    ]);
  });

  it("reports duplicate published rows once and rejects an unusable VTT", () => {
    const dir = mkdtempSync(join(tmpdir(), "kin-transcripts-"));
    try {
      writeFileSync(
        join(dir, "111.vtt"),
        "WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nSpoken line.\n",
        "utf8",
      );
      const catalog = [
        { content_id: 1, status: "published", access_level: "member", vimeo_id: 111 },
        { content_id: 2, status: "published", access_level: "member", vimeo_id: 111 },
      ] as PublicVideoRow[];
      const docs = buildCatalogTranscriptDocuments({ sourceDir: dir, catalog });
      expect(docs.memberDocument.records).toHaveLength(1);
      expect(docs.audit.duplicatePublishedRows).toEqual([
        { vimeoId: "111", contentIds: ["1", "2"] },
      ]);

      writeFileSync(join(dir, "222.vtt"), "WEBVTT\n\n", "utf8");
      expect(() =>
        buildCatalogTranscriptDocuments({
          sourceDir: dir,
          catalog: [
            ...catalog,
            { content_id: 3, status: "published", access_level: "public", vimeo_id: 222 },
          ] as PublicVideoRow[],
        }),
      ).toThrow(/Unusable transcript 222\.vtt/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("refuses to drop a Vimeo id already stored in a generated artifact", () => {
    const existing = serializeCatalogTranscriptJson({
      generator: "catalog-transcripts",
      kind: "member",
      records: [
        { vimeoId: "151857129", sourceFile: "151857129.vtt", sourceSha256: "abc", paragraphs: ["A."] },
        { vimeoId: "999", sourceFile: "999.vtt", sourceSha256: "def", paragraphs: ["B."] },
      ],
    });
    expect(() => assertSafeTranscriptOverwrite("member.json", existing, ["151857129"])).toThrow(
      /unexpected Vimeo IDs \(999\)/,
    );
    expect(() => assertSafeTranscriptOverwrite("member.json", existing, ["151857129", "999"])).not.toThrow();
  });
});

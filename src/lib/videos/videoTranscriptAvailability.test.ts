import { describe, expect, it } from "vitest";

import { CATALOG_TRANSCRIPT_GENERATOR, type CatalogTranscriptArtifact } from "../transcripts/catalogTranscriptData";
import { transcriptIsLive } from "./videoTranscriptAvailability";

function artifact(kind: "public" | "member", vimeoId: string, paragraph: string): CatalogTranscriptArtifact {
  return {
    generator: CATALOG_TRANSCRIPT_GENERATOR,
    kind,
    records: [{ vimeoId, sourceFile: `${vimeoId}.vtt`, sourceSha256: "abc", paragraphs: [paragraph] }],
  };
}

const memberSentence = "Members hear the pinwheel directions.";
const publicSentence = "Everyone hears the swatch directions.";

describe("admin transcript availability", () => {
  const documents = {
    public: artifact("public", "300300", publicSentence),
    member: artifact("member", "151859578", memberSentence),
  };

  it("is live only when the video page can show the stored transcript", () => {
    expect(
      transcriptIsLive(
        { content_id: 658, status: "published", access_level: "member", vimeo_id: 151859578 },
        documents,
      ),
    ).toBe(true);
    expect(
      transcriptIsLive(
        { content_id: 300, status: "published", access_level: "public", vimeo_id: 300300 },
        documents,
      ),
    ).toBe(true);
  });

  it("does not treat a member transcript as available on a free video, or a missing one as live", () => {
    expect(
      transcriptIsLive(
        { content_id: 300, status: "published", access_level: "public", vimeo_id: 151859578 },
        documents,
      ),
    ).toBe(false);
    expect(
      transcriptIsLive(
        { content_id: 658, status: "published", access_level: "member", vimeo_id: 300300 },
        documents,
      ),
    ).toBe(false);
    expect(
      transcriptIsLive(
        { content_id: 658, status: "draft", access_level: "member", vimeo_id: 151859578 },
        documents,
      ),
    ).toBe(false);
    expect(
      transcriptIsLive(
        { content_id: 659, status: "published", access_level: "member", vimeo_id: 151859583 },
        documents,
      ),
    ).toBe(false);
  });

  it("uses the public transcript when the video is playing as the free tip", () => {
    expect(
      transcriptIsLive(
        {
          content_id: 658,
          status: "published",
          access_level: "member",
          vimeo_id: 151859578,
          featuredTipPlayback: true,
        },
        documents,
      ),
    ).toBe(false);
  });
});

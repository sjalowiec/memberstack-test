import fs from "fs";
import path from "path";

import { describe, expect, it } from "vitest";

import {
  isVideoReplyPubliclyAvailable,
  toPublicVideoReplyView,
  type VideoReply,
} from "../../lib/videoReplies/videoRepliesStore";

describe("public video reply page", () => {
  it("defines a tokenized public route without Memberstack or Watson exposure", () => {
    const page = fs.readFileSync(
      path.resolve("src/pages/video-reply/[token].astro"),
      "utf8",
    );

    expect(page).toContain('export const prerender = false');
    expect(page).toContain("noindex, nofollow");
    expect(page).toContain("Cache-Control");
    expect(page).toContain("recordVideoReplyOpen");
    expect(page).toContain("toPublicVideoReplyView");
    expect(page).toContain("This video was created for");
    expect(page).toContain("This video is unavailable");
    expect(page).not.toContain("WatsonPageShell");
    expect(page).not.toContain("memberEmail");
    expect(page).not.toContain("privateNotes");
    expect(page).not.toContain("requireMemberstack");
  });

  it("keeps private fields out of the public view payload", () => {
    const record: VideoReply = {
      id: "id-1",
      publicToken: "abcdefghijklmnopqrstuvwxyz0123456789ABCD",
      memberName: "Alex Rivera",
      memberFirstName: "Alex",
      memberEmail: "alex@example.com",
      topic: "Help",
      originalVimeoUrl: "https://vimeo.com/1",
      safeVimeoEmbedUrl: "https://player.vimeo.com/video/1",
      privateNotes: "secret note",
      createdAt: "2026-07-19T12:00:00.000Z",
      updatedAt: "2026-07-19T12:00:00.000Z",
      sentAt: null,
      sentCount: 0,
      sentEvents: [],
      firstOpenedAt: null,
      lastOpenedAt: null,
      openCount: 0,
      status: "active",
      disabledAt: null,
    };

    const view = toPublicVideoReplyView(record);
    const serialized = JSON.stringify(view);
    expect(serialized).not.toContain("alex@example.com");
    expect(serialized).not.toContain("secret note");
    expect(serialized).not.toContain("publicToken");
    expect(isVideoReplyPubliclyAvailable(record)).toBe(true);
    expect(
      isVideoReplyPubliclyAvailable({
        ...record,
        status: "disabled",
        disabledAt: "2026-07-19T13:00:00.000Z",
      }),
    ).toBe(false);
  });
});

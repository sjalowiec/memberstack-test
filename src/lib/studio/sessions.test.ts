import { describe, expect, it } from "vitest";

import {
  resolveStudioVideo,
  studioPreviewAction,
  studioSessionDiscussionId,
  studioSessionIsVisible,
  studioSessionPrivateMessageHref,
  studioSlugFromTitle,
  validateStudioSessionInput,
} from "./sessions";

const ID = "11111111-1111-4111-8111-111111111111";

describe("studio sessions", () => {
  it("keeps comments on the permanent id when the title, video, and URL change", () => {
    const session = {
      id: ID,
      title: "Shoulder shaping",
      introduction: "Start at the shoulder.",
      video: "https://vimeo.com/1235389908",
      slug: "shoulder-shaping",
      status: "draft" as const,
    };
    expect(studioSessionDiscussionId(session)).toBe(`studio-post:${ID}`);
    expect(studioSessionDiscussionId({ ...session, title: "New title", video: "999999999", slug: "new-url" })).toBe(
      `studio-post:${ID}`,
    );
    expect(studioSessionDiscussionId(session)).not.toContain("1235389908");

    const message = studioSessionPrivateMessageHref({
      title: "New title",
      slug: "new-url",
    });
    const url = new URL(message, "http://localhost");
    expect(url.pathname).toBe("/contact/");
    expect(url.searchParams.get("subject")).toContain("New title");
    expect(url.searchParams.get("page")).toBe("/studio/new-url");
    expect(message).not.toContain("1235389908");
  });

  it("accepts a Vimeo URL or numeric ID and rejects another host", () => {
    expect(resolveStudioVideo("1235389908")?.vimeoId).toBe("1235389908");
    expect(resolveStudioVideo("https://vimeo.com/1235389908/abcdef")?.privacyHash).toBe("abcdef");
    expect(resolveStudioVideo("https://www.youtube.com/watch?v=abc")).toBeNull();
    expect(validateStudioSessionInput({ title: "Shoulders", video: "not-a-video", status: "draft" }).ok).toBe(
      false,
    );
  });

  it("lets a draft omit the video and requires one to publish", () => {
    const draft = validateStudioSessionInput({
      title: "Shoulder shaping",
      introduction: "Above the video.",
      status: "draft",
    });
    expect(draft.ok && draft.value.slug).toBe("shoulder-shaping");
    expect(draft.ok && draft.value.introduction).toBe("Above the video.");

    const published = validateStudioSessionInput({
      title: "Shoulder shaping",
      status: "published",
    });
    expect(published.ok).toBe(false);
    if (!published.ok) expect(published.field).toBe("video");
  });

  it("refuses the comments-test URL and a slug already in use", () => {
    expect(validateStudioSessionInput({ title: "Test", slug: "comments-test", status: "draft" }).ok).toBe(false);
    const taken = validateStudioSessionInput(
      { title: "Test", slug: "shoulder-shaping", video: "1235389908", status: "published" },
      { slugTaken: true },
    );
    expect(taken.ok).toBe(false);
  });

  it("shows published sessions to everyone and drafts only in Watson preview", () => {
    const draft = { id: ID, status: "draft" as const };
    expect(studioSessionIsVisible(draft, { previewId: "", watsonAuthed: false })).toBe(false);
    expect(studioSessionIsVisible(draft, { previewId: ID, watsonAuthed: false })).toBe(false);
    expect(studioSessionIsVisible(draft, { previewId: ID, watsonAuthed: true })).toBe(true);
    expect(studioSessionIsVisible({ id: ID, status: "published" }, { previewId: "", watsonAuthed: false })).toBe(
      true,
    );
  });

  it("asks for a save before previewing unsaved changes", () => {
    expect(
      studioPreviewAction({ id: "", dirty: true, status: "", slug: "shoulder-shaping" }).type,
    ).toBe("blocked");
    expect(
      studioPreviewAction({ id: ID, dirty: false, status: "draft", slug: "shoulder-shaping" }),
    ).toEqual({
      type: "open",
      href: `/studio/shoulder-shaping?preview=${encodeURIComponent(ID)}`,
    });
    expect(studioSlugFromTitle("Shoulder shaping!")).toBe("shoulder-shaping");
  });
});

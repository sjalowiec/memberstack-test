import { normalizeVimeoUrl } from "../videoReplies/vimeoUrl";
import { studioDiscussionId, studioPrivateMessageHref } from "./fastcommentsPocAccess";

export const STUDIO_SESSION_STATUSES = ["draft", "published"] as const;
export type StudioSessionStatus = (typeof STUDIO_SESSION_STATUSES)[number];

export const STUDIO_TITLE_MAX_LENGTH = 120;
export const STUDIO_INTRODUCTION_MAX_LENGTH = 8_000;
export const STUDIO_VIDEO_MAX_LENGTH = 500;
export const STUDIO_SLUG_MAX_LENGTH = 80;
export const STUDIO_RESERVED_SLUGS = new Set(["comments-test"]);

export type StudioSessionInput = {
  title: string;
  introduction: string;
  video: string;
  slug: string;
  status: StudioSessionStatus;
};

export type StudioSessionRecord = StudioSessionInput & {
  id: string;
  createdAt: string;
  updatedAt: string;
};

export type StudioSessionResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; field?: string };

export type ResolvedStudioVideo = {
  vimeoId: string;
  privacyHash?: string;
};

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function studioSlugFromTitle(title: string): string {
  const slug = title
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, STUDIO_SLUG_MAX_LENGTH)
    .replace(/-+$/g, "");
  return slug || "session";
}

export function studioSessionPath(slug: string): string {
  return `/studio/${slug}`;
}

export function studioSessionPreviewHref(session: { id: string; slug: string; status: StudioSessionStatus }): string {
  const path = studioSessionPath(session.slug);
  if (session.status === "published") return path;
  return `${path}?preview=${encodeURIComponent(session.id)}`;
}

export function studioSessionDiscussionId(session: { id: string }): string {
  return studioDiscussionId(session.id);
}

export function studioSessionPrivateMessageHref(session: { title: string; slug: string }): string {
  return studioPrivateMessageHref({
    title: session.title,
    path: studioSessionPath(session.slug),
  });
}

/** Vimeo URL, including a private-link hash, or a numeric Vimeo ID. */
export function resolveStudioVideo(value: string): ResolvedStudioVideo | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > STUDIO_VIDEO_MAX_LENGTH) return null;
  if (/^\d{6,12}$/.test(trimmed)) return { vimeoId: trimmed };
  const normalized = normalizeVimeoUrl(trimmed);
  if (!normalized) return null;
  return {
    vimeoId: normalized.vimeoId,
    ...(normalized.privacyHash ? { privacyHash: normalized.privacyHash } : {}),
  };
}

export function studioSessionIsVisible(
  session: { id: string; status: StudioSessionStatus },
  options: { previewId: string; watsonAuthed: boolean },
): boolean {
  if (session.status === "published") return true;
  return options.watsonAuthed && options.previewId === session.id;
}

export function validateStudioSessionInput(
  input: Record<string, unknown>,
  options: { slugTaken?: boolean } = {},
): StudioSessionResult<StudioSessionInput> {
  const title = text(input.title);
  if (!title) return { ok: false, error: "Session title is required.", field: "title" };
  if (title.length > STUDIO_TITLE_MAX_LENGTH) {
    return {
      ok: false,
      error: `Session title must be at most ${STUDIO_TITLE_MAX_LENGTH} characters.`,
      field: "title",
    };
  }

  const introduction = text(input.introduction);
  if (introduction.length > STUDIO_INTRODUCTION_MAX_LENGTH) {
    return {
      ok: false,
      error: `Introduction must be at most ${STUDIO_INTRODUCTION_MAX_LENGTH} characters.`,
      field: "introduction",
    };
  }

  const video = text(input.video);
  if (video.length > STUDIO_VIDEO_MAX_LENGTH) {
    return {
      ok: false,
      error: `Video must be at most ${STUDIO_VIDEO_MAX_LENGTH} characters.`,
      field: "video",
    };
  }

  const status = text(input.status);
  if (status !== "draft" && status !== "published") {
    return { ok: false, error: "Status must be draft or published.", field: "status" };
  }

  const requestedSlug = text(input.slug);
  const slug = (requestedSlug || studioSlugFromTitle(title)).toLowerCase();
  if (!SLUG_PATTERN.test(slug) || slug.length > STUDIO_SLUG_MAX_LENGTH || STUDIO_RESERVED_SLUGS.has(slug)) {
    return {
      ok: false,
      error: "Public URL must use letters, numbers, and hyphens.",
      field: "slug",
    };
  }
  if (options.slugTaken) {
    return { ok: false, error: "That public URL is already used by another session.", field: "slug" };
  }

  if (video && !resolveStudioVideo(video)) {
    return {
      ok: false,
      error: "Enter a Vimeo URL or a numeric Vimeo ID.",
      field: "video",
    };
  }
  if (status === "published" && !video) {
    return { ok: false, error: "Add a Vimeo URL or ID before publishing.", field: "video" };
  }

  return {
    ok: true,
    value: { title, introduction, video, slug, status },
  };
}

export function studioPreviewAction(input: {
  id: string;
  dirty: boolean;
  status: StudioSessionStatus | "";
  slug: string;
}): { type: "open"; href: string } | { type: "blocked"; message: string } {
  if (!input.id || input.dirty || (input.status !== "draft" && input.status !== "published")) {
    return {
      type: "blocked",
      message: "Save Draft or Publish to preview these changes.",
    };
  }
  return {
    type: "open",
    href: studioSessionPreviewHref({
      id: input.id,
      slug: input.slug,
      status: input.status,
    }),
  };
}

function text(value: unknown): string {
  return typeof value === "string" ? value.replace(/\u0000/g, "").trim() : "";
}

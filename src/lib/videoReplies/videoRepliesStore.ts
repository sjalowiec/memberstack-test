/**
 * Netlify Blobs store for Watson Video Replies.
 * Keys:
 *   replies/{id}.json          ù full record
 *   by-token/{publicToken}.json ù { id } index for public lookup
 */

import { getStore, type Store } from "@netlify/blobs";
import { randomUUID } from "node:crypto";

import { isValidEmailAddress, normalizeEmailAddress } from "../email/validateEmailAddress";
import {
  buildDefaultVideoReplyEmailMessage,
  extractFirstName,
} from "./videoReplyMessage";
import { generateVideoReplyPublicToken, isPlausibleVideoReplyPublicToken } from "./videoReplyToken";
import { normalizeVimeoUrl } from "./vimeoUrl";

export const VIDEO_REPLIES_BLOB_STORE = "video-replies";
export const VIDEO_REPLIES_KEY_PREFIX = "replies/";
export const VIDEO_REPLIES_TOKEN_PREFIX = "by-token/";

export const VIDEO_REPLY_STATUSES = ["active", "disabled"] as const;
export type VideoReplyStatus = (typeof VIDEO_REPLY_STATUSES)[number];

export type VideoReplySentEvent = {
  sentAt: string;
};

export type VideoReply = {
  id: string;
  publicToken: string;
  memberName: string;
  memberFirstName: string;
  memberEmail: string;
  topic: string;
  originalVimeoUrl: string;
  safeVimeoEmbedUrl: string;
  privateNotes: string;
  createdAt: string;
  updatedAt: string;
  sentAt: string | null;
  sentCount: number;
  sentEvents: VideoReplySentEvent[];
  firstOpenedAt: string | null;
  lastOpenedAt: string | null;
  openCount: number;
  status: VideoReplyStatus;
  disabledAt: string | null;
};

export type CreateVideoReplyInput = {
  memberName: string;
  memberEmail: string;
  topic: string;
  vimeoUrl: string;
  privateNotes?: string;
  now?: string;
  id?: string;
  publicToken?: string;
};

export type UpdateVideoReplyFieldsInput = {
  memberName?: string;
  memberEmail?: string;
  topic?: string;
  vimeoUrl?: string;
  privateNotes?: string | null;
  now?: string;
};

export type VideoReplyAdminView = VideoReply & {
  publicViewingUrl?: string;
  defaultEmailMessage?: string;
};

export type VideoReplyPublicView = {
  topic: string;
  memberFirstName: string;
  safeVimeoEmbedUrl: string;
};

type BlobStoreLike = Pick<Store, "get" | "setJSON" | "list">;

export class VideoReplyValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VideoReplyValidationError";
  }
}

export function isVideoReplyStatus(value: unknown): value is VideoReplyStatus {
  return (
    typeof value === "string" &&
    (VIDEO_REPLY_STATUSES as readonly string[]).includes(value)
  );
}

export function sanitizeKeySegment(segment: string): string {
  return String(segment)
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 120);
}

export function videoReplyBlobKey(id: string): string {
  return `${VIDEO_REPLIES_KEY_PREFIX}${sanitizeKeySegment(id)}.json`;
}

export function videoReplyTokenBlobKey(publicToken: string): string {
  return `${VIDEO_REPLIES_TOKEN_PREFIX}${sanitizeKeySegment(publicToken)}.json`;
}

export function getVideoRepliesStore(): Store {
  return getStore({
    name: VIDEO_REPLIES_BLOB_STORE,
    consistency: "strong",
  });
}

function requireNonEmpty(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== "string") {
    throw new VideoReplyValidationError(`${label} is required.`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new VideoReplyValidationError(`${label} is required.`);
  }
  if (trimmed.length > maxLength) {
    throw new VideoReplyValidationError(`${label} must be at most ${maxLength} characters.`);
  }
  return trimmed;
}

export function buildVideoReply(input: CreateVideoReplyInput): VideoReply {
  const memberName = requireNonEmpty(input.memberName, "Name", 200);
  const memberEmail = normalizeEmailAddress(input.memberEmail);
  if (!memberEmail) {
    throw new VideoReplyValidationError("Email is required.");
  }
  if (!isValidEmailAddress(memberEmail)) {
    throw new VideoReplyValidationError("Email must be a valid email address.");
  }

  const topic = requireNonEmpty(input.topic, "Topic", 200);
  const vimeo = normalizeVimeoUrl(input.vimeoUrl);
  if (!vimeo) {
    throw new VideoReplyValidationError(
      "Vimeo URL must be a valid Vimeo video or player link.",
    );
  }

  const privateNotes =
    typeof input.privateNotes === "string" ? input.privateNotes.trim().slice(0, 5000) : "";

  const now = input.now ?? new Date().toISOString();
  const id = input.id ?? randomUUID();
  const publicToken = input.publicToken ?? generateVideoReplyPublicToken();

  if (!isPlausibleVideoReplyPublicToken(publicToken)) {
    throw new VideoReplyValidationError("Invalid public token.");
  }

  return {
    id,
    publicToken,
    memberName,
    memberFirstName: extractFirstName(memberName),
    memberEmail,
    topic,
    originalVimeoUrl: vimeo.originalVimeoUrl,
    safeVimeoEmbedUrl: vimeo.safeVimeoEmbedUrl,
    privateNotes,
    createdAt: now,
    updatedAt: now,
    sentAt: null,
    sentCount: 0,
    sentEvents: [],
    firstOpenedAt: null,
    lastOpenedAt: null,
    openCount: 0,
    status: "active",
    disabledAt: null,
  };
}

export function normalizeVideoReply(raw: unknown): VideoReply | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;

  const id = typeof row.id === "string" ? row.id.trim() : "";
  const publicToken = typeof row.publicToken === "string" ? row.publicToken.trim() : "";
  const memberName = typeof row.memberName === "string" ? row.memberName.trim() : "";
  const memberEmail = typeof row.memberEmail === "string" ? row.memberEmail.trim() : "";
  const topic = typeof row.topic === "string" ? row.topic.trim() : "";
  const originalVimeoUrl =
    typeof row.originalVimeoUrl === "string" ? row.originalVimeoUrl.trim() : "";
  const safeVimeoEmbedUrl =
    typeof row.safeVimeoEmbedUrl === "string" ? row.safeVimeoEmbedUrl.trim() : "";
  const createdAt = typeof row.createdAt === "string" ? row.createdAt : "";
  const updatedAt = typeof row.updatedAt === "string" ? row.updatedAt : createdAt;
  const status = isVideoReplyStatus(row.status) ? row.status : null;

  if (
    !id ||
    !publicToken ||
    !memberName ||
    !memberEmail ||
    !topic ||
    !originalVimeoUrl ||
    !safeVimeoEmbedUrl ||
    !createdAt ||
    !status
  ) {
    return null;
  }

  const sentEvents: VideoReplySentEvent[] = [];
  if (Array.isArray(row.sentEvents)) {
    for (const event of row.sentEvents) {
      if (event && typeof event === "object" && !Array.isArray(event)) {
        const sentAt =
          typeof (event as Record<string, unknown>).sentAt === "string"
            ? String((event as Record<string, unknown>).sentAt)
            : "";
        if (sentAt) sentEvents.push({ sentAt });
      }
    }
  }

  const memberFirstName =
    typeof row.memberFirstName === "string" && row.memberFirstName.trim()
      ? row.memberFirstName.trim()
      : extractFirstName(memberName);

  return {
    id,
    publicToken,
    memberName,
    memberFirstName,
    memberEmail,
    topic,
    originalVimeoUrl,
    safeVimeoEmbedUrl,
    privateNotes: typeof row.privateNotes === "string" ? row.privateNotes : "",
    createdAt,
    updatedAt: updatedAt || createdAt,
    sentAt: typeof row.sentAt === "string" ? row.sentAt : null,
    sentCount: Number.isFinite(Number(row.sentCount)) ? Math.max(0, Number(row.sentCount)) : 0,
    sentEvents,
    firstOpenedAt: typeof row.firstOpenedAt === "string" ? row.firstOpenedAt : null,
    lastOpenedAt: typeof row.lastOpenedAt === "string" ? row.lastOpenedAt : null,
    openCount: Number.isFinite(Number(row.openCount)) ? Math.max(0, Number(row.openCount)) : 0,
    status,
    disabledAt: typeof row.disabledAt === "string" ? row.disabledAt : null,
  };
}

export function toPublicVideoReplyView(record: VideoReply): VideoReplyPublicView {
  return {
    topic: record.topic,
    memberFirstName: record.memberFirstName,
    safeVimeoEmbedUrl: record.safeVimeoEmbedUrl,
  };
}

export function withAdminPresentation(
  record: VideoReply,
  origin: string,
): VideoReplyAdminView {
  const publicViewingUrl = `${origin.replace(/\/$/, "")}/video-reply/${encodeURIComponent(record.publicToken)}`;
  return {
    ...record,
    publicViewingUrl,
    defaultEmailMessage: buildDefaultVideoReplyEmailMessage({
      memberName: record.memberName,
      publicViewingUrl,
    }),
  };
}

async function writeVideoReply(store: BlobStoreLike, record: VideoReply): Promise<void> {
  await store.setJSON(videoReplyBlobKey(record.id), record);
  await store.setJSON(videoReplyTokenBlobKey(record.publicToken), { id: record.id });
}

export async function saveVideoReply(
  store: BlobStoreLike,
  input: CreateVideoReplyInput,
): Promise<VideoReply> {
  const record = buildVideoReply(input);
  await writeVideoReply(store, record);
  return record;
}

export async function getVideoReplyById(
  store: BlobStoreLike,
  id: string,
): Promise<VideoReply | null> {
  if (!id?.trim()) return null;
  try {
    const raw = await store.get(videoReplyBlobKey(id), { type: "json" });
    return normalizeVideoReply(raw);
  } catch {
    return null;
  }
}

export async function getVideoReplyByPublicToken(
  store: BlobStoreLike,
  publicToken: string,
): Promise<VideoReply | null> {
  if (!isPlausibleVideoReplyPublicToken(publicToken)) return null;
  try {
    const indexRaw = await store.get(videoReplyTokenBlobKey(publicToken.trim()), {
      type: "json",
    });
    if (!indexRaw || typeof indexRaw !== "object" || Array.isArray(indexRaw)) {
      return null;
    }
    const id =
      typeof (indexRaw as Record<string, unknown>).id === "string"
        ? String((indexRaw as Record<string, unknown>).id).trim()
        : "";
    if (!id) return null;
    const record = await getVideoReplyById(store, id);
    if (!record || record.publicToken !== publicToken.trim()) return null;
    return record;
  } catch {
    return null;
  }
}

export async function listVideoReplies(store: BlobStoreLike): Promise<VideoReply[]> {
  const listed = await store.list({ prefix: VIDEO_REPLIES_KEY_PREFIX });
  const keys = (listed?.blobs ?? []).map((blob) => blob.key).filter(Boolean);

  const replies: VideoReply[] = [];
  for (const key of keys) {
    try {
      const raw = await store.get(key, { type: "json" });
      const reply = normalizeVideoReply(raw);
      if (reply) replies.push(reply);
    } catch {
      // skip unreadable blobs
    }
  }

  replies.sort((a, b) => {
    const byCreated = b.createdAt.localeCompare(a.createdAt);
    if (byCreated !== 0) return byCreated;
    return b.id.localeCompare(a.id);
  });

  return replies;
}

export async function updateVideoReplyFields(
  store: BlobStoreLike,
  id: string,
  patch: UpdateVideoReplyFieldsInput,
): Promise<VideoReply | null> {
  const existing = await getVideoReplyById(store, id);
  if (!existing) return null;

  const next: VideoReply = { ...existing };
  const now = patch.now ?? new Date().toISOString();

  if (patch.memberName !== undefined) {
    next.memberName = requireNonEmpty(patch.memberName, "Name", 200);
    next.memberFirstName = extractFirstName(next.memberName);
  }

  if (patch.memberEmail !== undefined) {
    const memberEmail = normalizeEmailAddress(patch.memberEmail);
    if (!memberEmail) {
      throw new VideoReplyValidationError("Email is required.");
    }
    if (!isValidEmailAddress(memberEmail)) {
      throw new VideoReplyValidationError("Email must be a valid email address.");
    }
    next.memberEmail = memberEmail;
  }

  if (patch.topic !== undefined) {
    next.topic = requireNonEmpty(patch.topic, "Topic", 200);
  }

  if (patch.vimeoUrl !== undefined) {
    const vimeo = normalizeVimeoUrl(patch.vimeoUrl);
    if (!vimeo) {
      throw new VideoReplyValidationError(
        "Vimeo URL must be a valid Vimeo video or player link.",
      );
    }
    next.originalVimeoUrl = vimeo.originalVimeoUrl;
    next.safeVimeoEmbedUrl = vimeo.safeVimeoEmbedUrl;
  }

  if (patch.privateNotes !== undefined) {
    if (patch.privateNotes === null) {
      next.privateNotes = "";
    } else {
      next.privateNotes = String(patch.privateNotes).trim().slice(0, 5000);
    }
  }

  next.updatedAt = now;
  // publicToken intentionally unchanged
  await store.setJSON(videoReplyBlobKey(next.id), next);
  return next;
}

export async function markVideoReplySent(
  store: BlobStoreLike,
  id: string,
  options?: { now?: string; force?: boolean },
): Promise<VideoReply | null> {
  const existing = await getVideoReplyById(store, id);
  if (!existing) return null;

  const now = options?.now ?? new Date().toISOString();
  const force = options?.force === true;

  // Prevent accidental duplicate sent timestamps within a short window unless forced.
  if (!force && existing.sentAt) {
    const lastMs = Date.parse(existing.sentAt);
    const nowMs = Date.parse(now);
    if (Number.isFinite(lastMs) && Number.isFinite(nowMs) && nowMs - lastMs < 60_000) {
      return existing;
    }
  }

  const next: VideoReply = {
    ...existing,
    sentAt: now,
    sentCount: existing.sentCount + 1,
    sentEvents: [...existing.sentEvents, { sentAt: now }],
    updatedAt: now,
  };

  await store.setJSON(videoReplyBlobKey(next.id), next);
  return next;
}

export async function disableVideoReply(
  store: BlobStoreLike,
  id: string,
  options?: { now?: string },
): Promise<VideoReply | null> {
  const existing = await getVideoReplyById(store, id);
  if (!existing) return null;

  if (existing.status === "disabled") {
    return existing;
  }

  const now = options?.now ?? new Date().toISOString();
  const next: VideoReply = {
    ...existing,
    status: "disabled",
    disabledAt: now,
    updatedAt: now,
  };

  await store.setJSON(videoReplyBlobKey(next.id), next);
  return next;
}

export async function recordVideoReplyOpen(
  store: BlobStoreLike,
  publicToken: string,
  options?: { now?: string },
): Promise<VideoReply | null> {
  const existing = await getVideoReplyByPublicToken(store, publicToken);
  if (!existing) return null;
  if (existing.status === "disabled") return null;

  const now = options?.now ?? new Date().toISOString();
  const next: VideoReply = {
    ...existing,
    firstOpenedAt: existing.firstOpenedAt ?? now,
    lastOpenedAt: now,
    openCount: existing.openCount + 1,
    updatedAt: now,
  };

  await store.setJSON(videoReplyBlobKey(next.id), next);
  return next;
}

export function isVideoReplyPubliclyAvailable(record: VideoReply | null): boolean {
  return Boolean(record && record.status === "active" && !record.disabledAt);
}

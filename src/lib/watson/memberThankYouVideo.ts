/**
 * Attach one video reply to one membership thank-you charge.
 * Saving a video does not mark it sent or complete the thank-you.
 */

import {
  disableVideoReply,
  getVideoRepliesStore,
  getVideoReplyById,
  markVideoReplySent,
  saveVideoReply,
  updateVideoReplyFields,
  type VideoReply,
} from "../videoReplies/videoRepliesStore";
import { MEMBERSHIP_THANK_YOU_HEADING } from "../videoReplies/videoReplyMessage";
import type { WatsonQueryFn } from "./memberSearch";
import {
  getThankYouStatus,
  setThankYouStatus,
  setThankYouVideoReplyId,
  type ThankYouStatusRecord,
} from "./memberThankYouStore";

export class MemberThankYouVideoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MemberThankYouVideoError";
  }
}

type VideoStore = Parameters<typeof saveVideoReply>[0];

export async function connectMemberThankYouVideo(
  input: {
    stripeChargeId: string;
    memberName: string;
    memberEmail: string;
    vimeoUrl: string;
    now?: string;
    store?: VideoStore;
    queryFn?: WatsonQueryFn;
  },
): Promise<{ status: ThankYouStatusRecord; reply: VideoReply }> {
  const store = input.store ?? getVideoRepliesStore();
  const queryFn = input.queryFn;
  const now = input.now ?? new Date().toISOString();
  const existing = queryFn
    ? await getThankYouStatus(input.stripeChargeId, queryFn)
    : await getThankYouStatus(input.stripeChargeId);

  if (existing?.videoReplyId) {
    const current = await getVideoReplyById(store, existing.videoReplyId);
    if (!current) {
      throw new MemberThankYouVideoError(
        "The saved thank-you video could not be loaded, so it was not replaced.",
      );
    }
    const updated = await updateVideoReplyFields(store, current.id, {
      memberName: input.memberName,
      memberEmail: input.memberEmail,
      topic: MEMBERSHIP_THANK_YOU_HEADING,
      vimeoUrl: input.vimeoUrl,
      presentation: "membership_thank_you",
      now,
    });
    if (!updated) {
      throw new MemberThankYouVideoError("The thank-you video could not be updated.");
    }
    return { status: existing, reply: updated };
  }

  const created = await saveVideoReply(store, {
    memberName: input.memberName,
    memberEmail: input.memberEmail,
    topic: MEMBERSHIP_THANK_YOU_HEADING,
    vimeoUrl: input.vimeoUrl,
    privateNotes: "",
    presentation: "membership_thank_you",
    now,
  });

  const status = queryFn
    ? await setThankYouVideoReplyId(
        { stripeChargeId: input.stripeChargeId, videoReplyId: created.id },
        queryFn,
      )
    : await setThankYouVideoReplyId({
        stripeChargeId: input.stripeChargeId,
        videoReplyId: created.id,
      });

  if (status.videoReplyId && status.videoReplyId !== created.id) {
    const winner = await getVideoReplyById(store, status.videoReplyId);
    if (winner) {
      const updated = await updateVideoReplyFields(store, winner.id, {
        memberName: input.memberName,
        memberEmail: input.memberEmail,
        topic: MEMBERSHIP_THANK_YOU_HEADING,
        vimeoUrl: input.vimeoUrl,
        presentation: "membership_thank_you",
        now,
      });
      await disableVideoReply(store, created.id, { now });
      if (!updated) {
        throw new MemberThankYouVideoError("The thank-you video could not be updated.");
      }
      return { status, reply: updated };
    }
  }

  return { status, reply: created };
}

export async function markMemberThankYouVideoEmailSent(
  input: {
    stripeChargeId: string;
    now?: string;
    store?: VideoStore;
    queryFn?: WatsonQueryFn;
  },
): Promise<ThankYouStatusRecord> {
  const store = input.store ?? getVideoRepliesStore();
  const now = input.now ?? new Date().toISOString();
  const existing = input.queryFn
    ? await getThankYouStatus(input.stripeChargeId, input.queryFn)
    : await getThankYouStatus(input.stripeChargeId);
  if (!existing?.videoReplyId) {
    throw new MemberThankYouVideoError("Add a thank-you video before marking the email sent.");
  }
  const reply = await getVideoReplyById(store, existing.videoReplyId);
  if (!reply) {
    throw new MemberThankYouVideoError("The thank-you video could not be loaded.");
  }
  await markVideoReplySent(store, reply.id, { now, force: false });
  const saved = input.queryFn
    ? await setThankYouStatus(
        { stripeChargeId: input.stripeChargeId, field: "video", sent: true, sentAt: now },
        input.queryFn,
      )
    : await setThankYouStatus({
        stripeChargeId: input.stripeChargeId,
        field: "video",
        sent: true,
        sentAt: now,
      });
  return saved;
}

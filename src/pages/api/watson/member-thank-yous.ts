import type { APIRoute } from "astro";

import { readStripeMembershipConfig } from "../../../config/stripeMembership";
import { formatLaTimestamp } from "../../../lib/watson/salesReportDates";
import {
  explainAnnualThankYouEligibility,
  isValidThankYouChargeId,
  thankYouPaymentYmd,
} from "../../../lib/watson/memberThankYouRules";
import { loadThankYouChargeForSave } from "../../../lib/watson/memberThankYouLoad";
import { normalizeEmailAddress } from "../../../lib/email/validateEmailAddress";
import {
  buildMembershipThankYouEmailMessage,
  buildVideoReplyPublicUrl,
  MEMBERSHIP_THANK_YOU_EMAIL_SUBJECT,
} from "../../../lib/videoReplies/videoReplyMessage";
import { VideoReplyValidationError } from "../../../lib/videoReplies/videoRepliesStore";
import {
  isMissingThankYouColumn,
  isMissingThankYouTable,
  MemberThankYouStoreError,
  setThankYouCompleted,
  setThankYouStatus,
  type ThankYouStatusField,
  type ThankYouStatusRecord,
} from "../../../lib/watson/memberThankYouStore";
import {
  connectMemberThankYouVideo,
  markMemberThankYouVideoEmailSent,
  MemberThankYouVideoError,
} from "../../../lib/watson/memberThankYouVideo";
import {
  readWatsonJsonBody,
  requireWatsonAdminJson,
  watsonJsonResponse,
} from "../../../lib/watson/watsonApiAuth";

export const prerender = false;

function sentLabel(iso: string | null): string | null {
  if (!iso) return null;
  const label = formatLaTimestamp(iso);
  return label === "-" ? null : `Sent ${label}`;
}

function completedLabel(iso: string | null): string | null {
  if (!iso) return null;
  const label = formatLaTimestamp(iso);
  return label === "-" ? null : `Completed ${label}`;
}

function statusBody(record: ThankYouStatusRecord) {
  return {
    stripeChargeId: record.stripeChargeId,
    videoSentAt: record.videoSentAt,
    cardSentAt: record.cardSentAt,
    videoSentLabel: sentLabel(record.videoSentAt),
    cardSentLabel: sentLabel(record.cardSentAt),
    videoReplyId: record.videoReplyId,
    completedAt: record.completedAt,
    completedLabel: completedLabel(record.completedAt),
  };
}

function sameEmail(left: string, right: string): boolean {
  return normalizeEmailAddress(left).toLowerCase() === normalizeEmailAddress(right).toLowerCase();
}

function videoBody(reply: {
  id: string;
  publicToken: string;
  originalVimeoUrl: string;
  memberName: string;
}, origin: string) {
  const publicViewingUrl = buildVideoReplyPublicUrl(origin, reply.publicToken);
  return {
    id: reply.id,
    publicViewingUrl,
    originalVimeoUrl: reply.originalVimeoUrl,
    emailSubject: MEMBERSHIP_THANK_YOU_EMAIL_SUBJECT,
    emailMessage: buildMembershipThankYouEmailMessage({
      memberName: reply.memberName,
      publicViewingUrl,
    }),
  };
}

export const PATCH: APIRoute = async (context) => {
  const auth = await requireWatsonAdminJson(context);
  if (!auth.ok) return auth;

  const bodyResult = await readWatsonJsonBody(context.request);
  if (!bodyResult.ok) return bodyResult.response;

  const stripeChargeId =
    typeof bodyResult.body.stripeChargeId === "string" ? bodyResult.body.stripeChargeId.trim() : "";
  const action = typeof bodyResult.body.action === "string" ? bodyResult.body.action.trim() : "";
  const field = bodyResult.body.field;
  const sent = bodyResult.body.sent;
  if (!isValidThankYouChargeId(stripeChargeId)) {
    return watsonJsonResponse({ ok: false, error: "Stripe charge id is invalid." }, 400);
  }

  const eligible = await requireEligibleThankYou(stripeChargeId);
  if (!eligible.ok) return eligible.response;

  if (
    action === "save_video" ||
    action === "mark_video_email_sent" ||
    action === "complete" ||
    action === "reopen"
  ) {
    return handleThankYouAction(action, stripeChargeId, bodyResult.body, eligible.chargeEmail, context.url.origin);
  }

  if (field !== "video" && field !== "card") {
    return watsonJsonResponse({ ok: false, error: 'Field must be "video" or "card".' }, 400);
  }
  if (typeof sent !== "boolean") {
    return watsonJsonResponse({ ok: false, error: "Sent must be true or false." }, 400);
  }

  try {
    const status = await setThankYouStatus({
      stripeChargeId,
      field: field as ThankYouStatusField,
      sent,
    });
    return watsonJsonResponse({ ok: true, status: statusBody(status) });
  } catch (error) {
    if (error instanceof MemberThankYouStoreError) {
      return watsonJsonResponse({ ok: false, error: error.message }, 400);
    }
    if (isMissingThankYouTable(error)) {
      return watsonJsonResponse(
        {
          ok: false,
          error: "Thank-you status is not in the database yet, so this box was not saved.",
        },
        503,
      );
    }
    return watsonJsonResponse({ ok: false, error: "The thank-you box could not be saved." }, 500);
  }
};

async function requireEligibleThankYou(
  stripeChargeId: string,
): Promise<{ ok: true; chargeEmail: string } | { ok: false; response: Response }> {
  const priceConfig = readStripeMembershipConfig();
  if (priceConfig.annualPriceIds.size === 0) {
    return {
      ok: false,
      response: watsonJsonResponse(
        {
          ok: false,
          error: "Annual membership price IDs are not configured, so this box was not saved.",
        },
        409,
      ),
    };
  }

  let charge;
  try {
    charge = await loadThankYouChargeForSave(stripeChargeId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The payment could not be confirmed.";
    return { ok: false, response: watsonJsonResponse({ ok: false, error: message }, 502) };
  }
  if (!charge) {
    return {
      ok: false,
      response: watsonJsonResponse({ ok: false, error: "That payment could not be found." }, 404),
    };
  }

  const paymentYmd = thankYouPaymentYmd(charge.created);
  if (!paymentYmd) {
    return {
      ok: false,
      response: watsonJsonResponse({ ok: false, error: "That payment date could not be read." }, 409),
    };
  }
  const decision = explainAnnualThankYouEligibility({
    charge,
    annualPriceIds: priceConfig.annualPriceIds,
    monthlyPriceIds: priceConfig.monthlyPriceIds,
    paymentYmd,
  });
  if (!decision.eligible) {
    return {
      ok: false,
      response: watsonJsonResponse(
        { ok: false, error: "This payment is not an annual membership thank-you." },
        409,
      ),
    };
  }
  return { ok: true, chargeEmail: charge.customerEmail?.trim() ?? "" };
}

async function handleThankYouAction(
  action: "save_video" | "mark_video_email_sent" | "complete" | "reopen",
  stripeChargeId: string,
  body: Record<string, unknown>,
  chargeEmail: string,
  origin: string,
): Promise<Response> {
  try {
    if (action === "complete" || action === "reopen") {
      const status = await setThankYouCompleted({
        stripeChargeId,
        completed: action === "complete",
      });
      return watsonJsonResponse({ ok: true, status: statusBody(status) });
    }

    if (action === "mark_video_email_sent") {
      const status = await markMemberThankYouVideoEmailSent({ stripeChargeId });
      return watsonJsonResponse({ ok: true, status: statusBody(status) });
    }

    const memberName = typeof body.memberName === "string" ? body.memberName.trim() : "";
    const memberEmail = typeof body.memberEmail === "string" ? body.memberEmail.trim() : "";
    const vimeoUrl = typeof body.vimeoUrl === "string" ? body.vimeoUrl : "";
    if (!memberName) {
      return watsonJsonResponse({ ok: false, error: "This thank-you has no member name." }, 400);
    }
    if (!chargeEmail || !sameEmail(memberEmail, chargeEmail)) {
      return watsonJsonResponse(
        { ok: false, error: "This thank-you email does not match the payment." },
        409,
      );
    }

    const connected = await connectMemberThankYouVideo({
      stripeChargeId,
      memberName,
      memberEmail: chargeEmail,
      vimeoUrl,
    });
    return watsonJsonResponse({
      ok: true,
      status: statusBody(connected.status),
      video: videoBody(connected.reply, origin),
    });
  } catch (error) {
    if (error instanceof VideoReplyValidationError || error instanceof MemberThankYouVideoError) {
      return watsonJsonResponse({ ok: false, error: error.message }, 400);
    }
    if (error instanceof MemberThankYouStoreError) {
      return watsonJsonResponse({ ok: false, error: error.message }, 400);
    }
    if (isMissingThankYouColumn(error)) {
      return watsonJsonResponse(
        {
          ok: false,
          error: "The thank-you video migration is not applied yet, so this was not saved.",
        },
        503,
      );
    }
    if (isMissingThankYouTable(error)) {
      return watsonJsonResponse(
        { ok: false, error: "Thank-you status is not in the database yet, so this was not saved." },
        503,
      );
    }
    const message = error instanceof Error ? error.message : "The thank-you could not be saved.";
    return watsonJsonResponse({ ok: false, error: message }, 500);
  }
}

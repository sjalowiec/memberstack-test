import type { APIRoute } from "astro";

import { readStripeMembershipConfig } from "../../../config/stripeMembership";
import { formatLaTimestamp } from "../../../lib/watson/salesReportDates";
import {
  explainAnnualThankYouEligibility,
  isValidThankYouChargeId,
  thankYouPaymentYmd,
} from "../../../lib/watson/memberThankYouRules";
import { loadThankYouChargeForSave } from "../../../lib/watson/memberThankYouLoad";
import {
  isMissingThankYouTable,
  MemberThankYouStoreError,
  setThankYouStatus,
  type ThankYouStatusField,
  type ThankYouStatusRecord,
} from "../../../lib/watson/memberThankYouStore";
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

function statusBody(record: ThankYouStatusRecord) {
  return {
    stripeChargeId: record.stripeChargeId,
    videoSentAt: record.videoSentAt,
    cardSentAt: record.cardSentAt,
    videoSentLabel: sentLabel(record.videoSentAt),
    cardSentLabel: sentLabel(record.cardSentAt),
  };
}

export const PATCH: APIRoute = async (context) => {
  const auth = await requireWatsonAdminJson(context);
  if (!auth.ok) return auth;

  const bodyResult = await readWatsonJsonBody(context.request);
  if (!bodyResult.ok) return bodyResult.response;

  const stripeChargeId =
    typeof bodyResult.body.stripeChargeId === "string" ? bodyResult.body.stripeChargeId.trim() : "";
  const field = bodyResult.body.field;
  const sent = bodyResult.body.sent;
  if (!isValidThankYouChargeId(stripeChargeId)) {
    return watsonJsonResponse({ ok: false, error: "Stripe charge id is invalid." }, 400);
  }
  if (field !== "video" && field !== "card") {
    return watsonJsonResponse({ ok: false, error: 'Field must be "video" or "card".' }, 400);
  }
  if (typeof sent !== "boolean") {
    return watsonJsonResponse({ ok: false, error: "Sent must be true or false." }, 400);
  }

  const priceConfig = readStripeMembershipConfig();
  if (priceConfig.annualPriceIds.size === 0) {
    return watsonJsonResponse(
      {
        ok: false,
        error: "Annual membership price IDs are not configured, so this box was not saved.",
      },
      409,
    );
  }

  let charge;
  try {
    charge = await loadThankYouChargeForSave(stripeChargeId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The payment could not be confirmed.";
    return watsonJsonResponse({ ok: false, error: message }, 502);
  }
  if (!charge) {
    return watsonJsonResponse({ ok: false, error: "That payment could not be found." }, 404);
  }

  const paymentYmd = thankYouPaymentYmd(charge.created);
  if (!paymentYmd) {
    return watsonJsonResponse({ ok: false, error: "That payment date could not be read." }, 409);
  }
  const decision = explainAnnualThankYouEligibility({
    charge,
    annualPriceIds: priceConfig.annualPriceIds,
    monthlyPriceIds: priceConfig.monthlyPriceIds,
    paymentYmd,
  });
  if (!decision.eligible) {
    return watsonJsonResponse(
      { ok: false, error: "This payment is not an annual membership thank-you." },
      409,
    );
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

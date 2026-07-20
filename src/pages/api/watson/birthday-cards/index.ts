import type { APIRoute } from "astro";

import {
  BirthdayCardValidationError,
  getBirthdayCardsStore,
  isBirthdayCardStatus,
  listBirthdayCardStatusesForYear,
  parseBirthdayYear,
  setBirthdayCardStatus,
} from "../../../../lib/watson/birthdayCardsStore";
import {
  readWatsonJsonBody,
  requireWatsonAdminJson,
  watsonJsonResponse,
} from "../../../../lib/watson/watsonApiAuth";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const auth = await requireWatsonAdminJson(context);
  if (!auth.ok) {
    return auth;
  }

  const year = parseBirthdayYear(context.url.searchParams.get("year"));
  if (year == null) {
    return watsonJsonResponse(
      { ok: false, error: "Query parameter year (YYYY) is required." },
      400,
    );
  }

  try {
    const store = getBirthdayCardsStore();
    const cards = await listBirthdayCardStatusesForYear(store, year);
    return watsonJsonResponse({ ok: true, year, cards });
  } catch (error) {
    if (error instanceof BirthdayCardValidationError) {
      return watsonJsonResponse({ ok: false, error: error.message }, 400);
    }
    const message =
      error instanceof Error ? error.message : "Unable to load birthday card statuses.";
    return watsonJsonResponse({ ok: false, error: message }, 500);
  }
};

export const PATCH: APIRoute = async (context) => {
  const auth = await requireWatsonAdminJson(context);
  if (!auth.ok) {
    return auth;
  }

  const bodyResult = await readWatsonJsonBody(context.request);
  if (!bodyResult.ok) {
    return bodyResult.response;
  }

  const { body } = bodyResult;
  const memberId = typeof body.memberId === "string" ? body.memberId.trim() : "";
  const birthdayYear = parseBirthdayYear(body.birthdayYear);
  const status = body.status;

  if (!memberId) {
    return watsonJsonResponse({ ok: false, error: "memberId is required." }, 400);
  }
  if (birthdayYear == null) {
    return watsonJsonResponse(
      { ok: false, error: "birthdayYear (YYYY) is required." },
      400,
    );
  }
  if (!isBirthdayCardStatus(status)) {
    return watsonJsonResponse(
      { ok: false, error: 'status must be "sent" or "not_sent".' },
      400,
    );
  }

  try {
    const store = getBirthdayCardsStore();
    const card = await setBirthdayCardStatus(store, {
      memberId,
      birthdayYear,
      status,
    });
    return watsonJsonResponse({ ok: true, card });
  } catch (error) {
    if (error instanceof BirthdayCardValidationError) {
      return watsonJsonResponse({ ok: false, error: error.message }, 400);
    }
    const message =
      error instanceof Error ? error.message : "Unable to update birthday card status.";
    return watsonJsonResponse({ ok: false, error: message }, 500);
  }
};

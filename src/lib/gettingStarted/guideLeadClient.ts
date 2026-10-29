/**
 * Browser client for the Getting Started Guide gate.
 * Never sends a tag name or list id.
 */

import {
  isValidEmailAddress,
  normalizeEmailAddress,
} from "../email/validateEmailAddress";
import {
  EMAIL_LIST_SIGNUP_MAX_EMAIL,
  EMAIL_LIST_SIGNUP_MAX_FIRST_NAME,
} from "../email/emailListSignupShared";
import {
  GETTING_STARTED_GUIDE_LEAD_ENDPOINT,
  GETTING_STARTED_GUIDE_MESSAGES,
} from "./guideLeadShared";

export type GettingStartedGuideLeadPayload = {
  firstName: string;
  email: string;
  "bot-field": string;
};

export type GettingStartedGuideLeadSubmitResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

export function buildGettingStartedGuideLeadPayload(args: {
  firstName: string;
  email: string;
  botField?: string;
}): GettingStartedGuideLeadPayload | { error: string } {
  const firstName = typeof args.firstName === "string" ? args.firstName.trim() : "";
  const email = normalizeEmailAddress(args.email);
  const botField = typeof args.botField === "string" ? args.botField.trim() : "";

  if (!firstName) return { error: GETTING_STARTED_GUIDE_MESSAGES.invalidFirstName };
  if (
    firstName.length > EMAIL_LIST_SIGNUP_MAX_FIRST_NAME ||
    email.length > EMAIL_LIST_SIGNUP_MAX_EMAIL
  ) {
    return { error: GETTING_STARTED_GUIDE_MESSAGES.fieldTooLong };
  }
  if (!isValidEmailAddress(email)) {
    return { error: GETTING_STARTED_GUIDE_MESSAGES.invalidEmail };
  }

  return { firstName, email, "bot-field": botField };
}

export async function submitGettingStartedGuideLead(
  payload: GettingStartedGuideLeadPayload,
  options: { fetchImpl?: typeof fetch; endpoint?: string } = {},
): Promise<GettingStartedGuideLeadSubmitResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl(options.endpoint ?? GETTING_STARTED_GUIDE_LEAD_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    let data: { ok?: boolean; message?: string; error?: string } | null = null;
    try {
      data = (await response.json()) as { ok?: boolean; message?: string; error?: string };
    } catch {
      data = null;
    }

    if (response.ok && data?.ok) {
      return {
        ok: true,
        message:
          typeof data.message === "string" && data.message.trim()
            ? data.message.trim()
            : GETTING_STARTED_GUIDE_MESSAGES.success,
      };
    }

    return {
      ok: false,
      error:
        typeof data?.error === "string" && data.error.trim()
          ? data.error.trim()
          : GETTING_STARTED_GUIDE_MESSAGES.genericFailure,
    };
  } catch {
    return { ok: false, error: GETTING_STARTED_GUIDE_MESSAGES.genericFailure };
  }
}

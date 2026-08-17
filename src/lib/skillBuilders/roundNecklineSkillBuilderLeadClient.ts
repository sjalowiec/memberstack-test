import {
  isValidEmailAddress,
  normalizeEmailAddress,
} from "../email/validateEmailAddress";
import {
  ROUND_NECKLINE_SKILL_BUILDER_LEAD_ENDPOINT,
  ROUND_NECKLINE_SKILL_BUILDER_LEAD_MAX_EMAIL,
  ROUND_NECKLINE_SKILL_BUILDER_LEAD_MAX_FIRST_NAME,
  ROUND_NECKLINE_SKILL_BUILDER_LEAD_MESSAGES,
} from "./roundNecklineSkillBuilderLeadShared";

export type RoundNecklineLeadSubmitPayload = {
  email: string;
  firstName?: string;
  /** Honeypot value (should be empty). */
  "bot-field": string;
};

export type RoundNecklineLeadSubmitResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

export function buildRoundNecklineLeadPayload(args: {
  email: string;
  firstName?: string;
  botField?: string;
}): RoundNecklineLeadSubmitPayload | { error: string } {
  const email = normalizeEmailAddress(args.email);
  const firstName = typeof args.firstName === "string" ? args.firstName.trim() : "";
  const botField = typeof args.botField === "string" ? args.botField.trim() : "";

  if (email.length > ROUND_NECKLINE_SKILL_BUILDER_LEAD_MAX_EMAIL) {
    return { error: ROUND_NECKLINE_SKILL_BUILDER_LEAD_MESSAGES.fieldTooLong };
  }
  if (firstName.length > ROUND_NECKLINE_SKILL_BUILDER_LEAD_MAX_FIRST_NAME) {
    return { error: ROUND_NECKLINE_SKILL_BUILDER_LEAD_MESSAGES.fieldTooLong };
  }
  if (!isValidEmailAddress(email)) {
    return { error: ROUND_NECKLINE_SKILL_BUILDER_LEAD_MESSAGES.invalidEmail };
  }

  const payload: RoundNecklineLeadSubmitPayload = {
    email,
    "bot-field": botField,
  };
  if (firstName) payload.firstName = firstName;
  return payload;
}

export async function submitRoundNecklineLeadRequest(
  payload: RoundNecklineLeadSubmitPayload,
  options: {
    fetchImpl?: typeof fetch;
    endpoint?: string;
  } = {},
): Promise<RoundNecklineLeadSubmitResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const endpoint = options.endpoint ?? ROUND_NECKLINE_SKILL_BUILDER_LEAD_ENDPOINT;

  try {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    let data: { ok?: boolean; message?: string; error?: string } | null = null;
    try {
      data = (await response.json()) as {
        ok?: boolean;
        message?: string;
        error?: string;
      };
    } catch {
      data = null;
    }

    if (response.ok && data?.ok) {
      return {
        ok: true,
        message:
          typeof data.message === "string" && data.message.trim()
            ? data.message.trim()
            : ROUND_NECKLINE_SKILL_BUILDER_LEAD_MESSAGES.success,
      };
    }

    // Integration / server failures must not block the free Skill Builder.
    if (response.status >= 500) {
      return {
        ok: true,
        message: ROUND_NECKLINE_SKILL_BUILDER_LEAD_MESSAGES.success,
      };
    }

    return {
      ok: false,
      error:
        typeof data?.error === "string" && data.error.trim()
          ? data.error.trim()
          : ROUND_NECKLINE_SKILL_BUILDER_LEAD_MESSAGES.genericFailure,
    };
  } catch {
    return {
      ok: false,
      error: ROUND_NECKLINE_SKILL_BUILDER_LEAD_MESSAGES.genericFailure,
    };
  }
}

/**
 * Browser client for first-party tagged lead endpoints.
 * Never includes ActiveCampaign credentials or tag names.
 */

import {
  isValidEmailAddress,
  normalizeEmailAddress,
} from "../email/validateEmailAddress";
import { TAGGED_LEAD_MAX_EMAIL, TAGGED_LEAD_MAX_FIRST_NAME } from "./taggedLeadCaptureLimits";

export type LeadSubmitPayload = {
  email: string;
  firstName?: string;
  /** Honeypot value (should be empty). */
  "bot-field": string;
};

export type LeadSubmitResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

export type LeadClientMessages = {
  success: string;
  genericFailure: string;
  invalidEmail: string;
  fieldTooLong: string;
};

export function buildLeadSubmitPayload(
  args: {
    email: string;
    firstName?: string;
    botField?: string;
  },
  messages: LeadClientMessages,
): LeadSubmitPayload | { error: string } {
  const email = normalizeEmailAddress(args.email);
  const firstName = typeof args.firstName === "string" ? args.firstName.trim() : "";
  const botField = typeof args.botField === "string" ? args.botField.trim() : "";

  if (email.length > TAGGED_LEAD_MAX_EMAIL) {
    return { error: messages.fieldTooLong };
  }
  if (firstName.length > TAGGED_LEAD_MAX_FIRST_NAME) {
    return { error: messages.fieldTooLong };
  }
  if (!isValidEmailAddress(email)) {
    return { error: messages.invalidEmail };
  }

  const payload: LeadSubmitPayload = {
    email,
    "bot-field": botField,
  };
  if (firstName) payload.firstName = firstName;
  return payload;
}

export async function submitLeadRequest(
  payload: LeadSubmitPayload,
  options: {
    endpoint: string;
    messages: LeadClientMessages;
    fetchImpl?: typeof fetch;
  },
): Promise<LeadSubmitResult> {
  const fetchImpl = options.fetchImpl ?? fetch;

  try {
    const response = await fetchImpl(options.endpoint, {
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
            : options.messages.success,
      };
    }

    // Integration / server failures must not block the free product.
    if (response.status >= 500) {
      return {
        ok: true,
        message: options.messages.success,
      };
    }

    return {
      ok: false,
      error:
        typeof data?.error === "string" && data.error.trim()
          ? data.error.trim()
          : options.messages.genericFailure,
    };
  } catch {
    return {
      ok: false,
      error: options.messages.genericFailure,
    };
  }
}

import {
  isValidEmailAddress,
  normalizeEmailAddress,
} from "../lib/email/validateEmailAddress";
import {
  EMAIL_LIST_SIGNUP_MAX_EMAIL,
  EMAIL_LIST_SIGNUP_MAX_FIRST_NAME,
  EMAIL_LIST_SIGNUP_MESSAGES,
} from "../lib/email/emailListSignupShared";

export const EMAIL_LIST_SIGNUP_ENDPOINT = "/api/email-list-signup";

export type EmailListSignupSubmitPayload = {
  firstName: string;
  email: string;
  /** Honeypot value (should be empty). */
  "bot-field": string;
  /** Reserved so Turnstile can be wired later without reshaping the client. */
  turnstileToken?: string;
};

export type EmailListSignupSubmitResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

export function normalizeSignupFirstName(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function buildEmailListSignupPayload(args: {
  firstName: string;
  email: string;
  botField?: string;
  turnstileToken?: string;
}): EmailListSignupSubmitPayload | { error: string } {
  const firstName = normalizeSignupFirstName(args.firstName);
  const email = normalizeEmailAddress(args.email);
  const botField =
    typeof args.botField === "string" ? args.botField.trim() : "";

  if (!firstName) {
    return { error: EMAIL_LIST_SIGNUP_MESSAGES.invalidFirstName };
  }
  if (
    firstName.length > EMAIL_LIST_SIGNUP_MAX_FIRST_NAME ||
    email.length > EMAIL_LIST_SIGNUP_MAX_EMAIL
  ) {
    return { error: EMAIL_LIST_SIGNUP_MESSAGES.fieldTooLong };
  }
  if (!isValidEmailAddress(email)) {
    return { error: EMAIL_LIST_SIGNUP_MESSAGES.invalidEmail };
  }

  const payload: EmailListSignupSubmitPayload = {
    firstName,
    email,
    "bot-field": botField,
  };
  if (args.turnstileToken) {
    payload.turnstileToken = args.turnstileToken;
  }
  return payload;
}

export async function submitEmailListSignupRequest(
  payload: EmailListSignupSubmitPayload,
  options: {
    fetchImpl?: typeof fetch;
    endpoint?: string;
  } = {},
): Promise<EmailListSignupSubmitResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const endpoint = options.endpoint ?? EMAIL_LIST_SIGNUP_ENDPOINT;

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
            : EMAIL_LIST_SIGNUP_MESSAGES.subscribed,
      };
    }

    return {
      ok: false,
      error:
        typeof data?.error === "string" && data.error.trim()
          ? data.error.trim()
          : EMAIL_LIST_SIGNUP_MESSAGES.genericFailure,
    };
  } catch {
    return {
      ok: false,
      error: EMAIL_LIST_SIGNUP_MESSAGES.genericFailure,
    };
  }
}

export function initEmailListSignupForms(root: ParentNode = document): void {
  root.querySelectorAll<HTMLFormElement>("[data-email-list-signup]").forEach((form) => {
    if (form.dataset.signupBound === "true") return;
    form.dataset.signupBound = "true";

    const firstNameInput = form.querySelector<HTMLInputElement>(
      'input[name="firstName"]',
    );
    const emailInput = form.querySelector<HTMLInputElement>(
      'input[name="email"]',
    );
    const botInput = form.querySelector<HTMLInputElement>(
      'input[name="bot-field"]',
    );
    const submitButton = form.querySelector<HTMLButtonElement>(
      'button[type="submit"]',
    );
    const errorEl = form.querySelector<HTMLElement>("[data-signup-error]");
    const statusRegion =
      form.closest("[data-email-list-signup-root]") ?? form.parentElement;
    const thanksEl = statusRegion?.querySelector<HTMLElement>(
      "[data-signup-thanks]",
    );
    const thanksTextEl = thanksEl?.querySelector<HTMLElement>(
      "[data-signup-thanks-message]",
    );

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (form.dataset.submitting === "true") return;

      const built = buildEmailListSignupPayload({
        firstName: firstNameInput?.value ?? "",
        email: emailInput?.value ?? "",
        botField: botInput?.value ?? "",
        // Slot for future Turnstile: read from data attribute / hidden input.
        turnstileToken: form.dataset.turnstileToken || undefined,
      });

      if ("error" in built) {
        if (errorEl) {
          errorEl.textContent = built.error;
          errorEl.hidden = false;
        }
        return;
      }

      form.dataset.submitting = "true";
      if (submitButton) submitButton.disabled = true;
      if (errorEl) {
        errorEl.hidden = true;
        errorEl.textContent = "";
      }

      const result = await submitEmailListSignupRequest(built);

      if (result.ok) {
        form.hidden = true;
        if (thanksTextEl) thanksTextEl.textContent = result.message;
        if (thanksEl) thanksEl.hidden = false;
        const doneBtn = statusRegion?.querySelector<HTMLElement>("[data-signup-done]");
        if (doneBtn) doneBtn.hidden = false;
        form.dispatchEvent(
          new CustomEvent("email-list-signup:success", {
            bubbles: true,
            detail: { message: result.message },
          }),
        );
        return;
      }

      // Preserve entered values; only re-enable for correctable errors.
      form.dataset.submitting = "false";
      if (submitButton) submitButton.disabled = false;
      if (errorEl) {
        errorEl.textContent = result.error;
        errorEl.hidden = false;
      }
    });
  });
}

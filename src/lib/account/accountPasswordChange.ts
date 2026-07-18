/**
 * Account-page password change helpers.
 *
 * Memberstack verifies the current password only as part of
 * `updateMemberAuth({ oldPassword, newPassword })` ù there is no separate
 * verify-current-password API. UI must not claim independent verification.
 *
 * Observed provider behavior (account password form):
 * - Wrong current password + valid new password rejects with
 *   `{ code: "invalid-password", message: "The provided password is invalid." }`
 * - That same `invalid-password` code is documented for new-password rule failures,
 *   so the UI must not blame a specific field when this code is returned.
 */

export const MEMBERSTACK_PASSWORD_MIN_LENGTH = 8;

/** Used when Memberstack does not reliably identify which password field failed. */
export const PASSWORD_CHANGE_PROVIDER_NEUTRAL_ERROR =
  "Your password could not be changed. Check your current password and make sure the new password meets the requirements, then try again.";

export type PasswordChangeFieldValues = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export type PasswordChangeClientIssue =
  | { ok: false; code: "current-required"; message: string }
  | { ok: false; code: "new-required"; message: string }
  | { ok: false; code: "confirm-required"; message: string }
  | { ok: false; code: "mismatch"; message: string }
  | { ok: false; code: "new-too-short"; message: string }
  | { ok: false; code: "same-as-current"; message: string };

export type PasswordChangeClientOk = { ok: true; values: PasswordChangeFieldValues };

export type PasswordChangeStatus =
  | { kind: "idle" }
  | { kind: "error"; message: string }
  | { kind: "success"; message: string };

/** Client-side checks before calling Memberstack. */
export function validatePasswordChangeFields(
  values: PasswordChangeFieldValues,
): PasswordChangeClientOk | PasswordChangeClientIssue {
  const currentPassword = values.currentPassword.trim();
  const newPassword = values.newPassword;
  const confirmPassword = values.confirmPassword;

  if (!currentPassword) {
    return {
      ok: false,
      code: "current-required",
      message: "Enter your current password.",
    };
  }
  if (!newPassword) {
    return {
      ok: false,
      code: "new-required",
      message: "Enter a new password.",
    };
  }
  if (!confirmPassword) {
    return {
      ok: false,
      code: "confirm-required",
      message: "Confirm your new password.",
    };
  }
  if (newPassword !== confirmPassword) {
    return {
      ok: false,
      code: "mismatch",
      message: "New password and confirmation do not match.",
    };
  }
  if (newPassword.length < MEMBERSTACK_PASSWORD_MIN_LENGTH) {
    return {
      ok: false,
      code: "new-too-short",
      message: `New password must be at least ${MEMBERSTACK_PASSWORD_MIN_LENGTH} characters.`,
    };
  }
  if (newPassword === currentPassword) {
    return {
      ok: false,
      code: "same-as-current",
      message: "Choose a new password that is different from your current password.",
    };
  }

  return {
    ok: true,
    values: { currentPassword, newPassword, confirmPassword },
  };
}

type MemberstackLikeError = {
  code?: unknown;
  message?: unknown;
  name?: unknown;
  type?: unknown;
  status?: unknown;
  statusCode?: unknown;
};

function readErrorCode(error: unknown): string {
  if (!error || typeof error !== "object") return "";
  const code = (error as MemberstackLikeError).code;
  return typeof code === "string" ? code.trim().toLowerCase() : "";
}

function readErrorMessage(error: unknown): string {
  if (!error || typeof error !== "object") return "";
  const message = (error as MemberstackLikeError).message;
  return typeof message === "string" ? message.trim() : "";
}

/** Safe, serializable summary of a rejected Memberstack error (for DEV inspection). */
export function inspectPasswordChangeProviderError(error: unknown): Record<string, unknown> {
  if (error == null) {
    return { value: error };
  }
  if (typeof error !== "object") {
    return { value: error, typeof: typeof error };
  }

  const err = error as MemberstackLikeError & Record<string, unknown>;
  const summary: Record<string, unknown> = {
    code: err.code ?? null,
    message: err.message ?? null,
    name: err.name ?? null,
    type: err.type ?? null,
    status: err.status ?? null,
    statusCode: err.statusCode ?? null,
  };

  // Include other own enumerable keys (nested fields) without assuming shape.
  for (const key of Object.keys(err)) {
    if (key in summary) continue;
    try {
      summary[key] = err[key];
    } catch {
      summary[key] = "[unreadable]";
    }
  }

  return summary;
}

/** DEV-only console dump of the full provider rejection (no secrets from our form). */
export function logPasswordChangeProviderErrorInDev(error: unknown): void {
  try {
    // Vite/Astro local server only ó skip production and Vitest noise.
    if (!import.meta.env?.DEV) return;
    if (import.meta.env?.MODE === "test") return;
  } catch {
    return;
  }
  console.info(
    "[account-password-change] updateMemberAuth rejected:",
    inspectPasswordChangeProviderError(error),
    error,
  );
}

function isGenericPasswordInvalidMessage(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  if (!normalized) return true;
  return (
    normalized === "the provided password is invalid." ||
    normalized === "the provided password is invalid" ||
    normalized === "password is invalid." ||
    normalized === "password is invalid" ||
    normalized === "invalid password." ||
    normalized === "invalid password" ||
    normalized === "password doesn't meet the requirements." ||
    normalized === "password doesn't meet the requirements" ||
    normalized === "password does not meet the requirements." ||
    normalized === "password does not meet the requirements"
  );
}

/**
 * Map Memberstack errors to user-facing copy.
 *
 * Do not blame "current" vs "new" password unless the provider code uniquely
 * identifies that case. Observed: wrong current password returns `invalid-password`.
 */
export function mapPasswordChangeProviderError(error: unknown): string {
  const code = readErrorCode(error);
  const providerMessage = readErrorMessage(error);

  // Length-specific code: safe to attribute to the new password (client also enforces this).
  if (
    code === "invalid-password-too-short" ||
    code === "password-too-short" ||
    code === "invalid_password_too_short"
  ) {
    return `New password must be at least ${MEMBERSTACK_PASSWORD_MIN_LENGTH} characters.`;
  }

  if (code === "login-required" || code === "client/invalid-token") {
    return "Please sign in again, then try changing your password.";
  }

  if (code === "no-password-set") {
    return 'This account does not have a password yet. Use ùReset it by email insteadù to set one.';
  }

  // Observed for wrong current password; also documented for new-password failures.
  // Same for invalid-credentials in this form ù do not guess which field failed.
  if (
    code === "invalid-password" ||
    code === "invalid_password" ||
    code === "invalid-credentials" ||
    code === "invalid_credentials"
  ) {
    return PASSWORD_CHANGE_PROVIDER_NEUTRAL_ERROR;
  }

  // Unknown code: use provider text only when it adds distinct information.
  if (providerMessage && !isGenericPasswordInvalidMessage(providerMessage)) {
    return providerMessage;
  }

  return PASSWORD_CHANGE_PROVIDER_NEUTRAL_ERROR;
}

export const PASSWORD_CHANGE_SUCCESS_MESSAGE = "Password updated successfully.";

/** Exclusive status helpers ù never keep success and error at once. */
export function passwordChangeIdleStatus(): PasswordChangeStatus {
  return { kind: "idle" };
}

export function passwordChangeErrorStatus(message: string): PasswordChangeStatus {
  return { kind: "error", message };
}

export function passwordChangeSuccessStatus(
  message = PASSWORD_CHANGE_SUCCESS_MESSAGE,
): PasswordChangeStatus {
  return { kind: "success", message };
}

export type PasswordChangeSubmitArgs = {
  values: PasswordChangeFieldValues;
  updateMemberAuth: (args: {
    oldPassword: string;
    newPassword: string;
  }) => Promise<unknown>;
  /** When true, ignore this result (superseded submit). */
  isStale?: () => boolean;
};

export type PasswordChangeSubmitResult =
  | { outcome: "client-error"; status: Extract<PasswordChangeStatus, { kind: "error" }> }
  | {
      outcome: "provider-error";
      status: Extract<PasswordChangeStatus, { kind: "error" }>;
      providerError: unknown;
    }
  | { outcome: "success"; status: Extract<PasswordChangeStatus, { kind: "success" }> }
  | { outcome: "stale" };

/**
 * Validate, then call Memberstack `updateMemberAuth`. Clears dual success/error by
 * returning a single exclusive status.
 */
export async function submitPasswordChange(
  args: PasswordChangeSubmitArgs,
): Promise<PasswordChangeSubmitResult> {
  const validated = validatePasswordChangeFields(args.values);
  if (!validated.ok) {
    return {
      outcome: "client-error",
      status: passwordChangeErrorStatus(validated.message),
    };
  }

  try {
    await args.updateMemberAuth({
      oldPassword: validated.values.currentPassword,
      newPassword: validated.values.newPassword,
    });
  } catch (error) {
    if (args.isStale?.()) return { outcome: "stale" };
    logPasswordChangeProviderErrorInDev(error);
    return {
      outcome: "provider-error",
      status: passwordChangeErrorStatus(mapPasswordChangeProviderError(error)),
      providerError: error,
    };
  }

  if (args.isStale?.()) return { outcome: "stale" };
  return {
    outcome: "success",
    status: passwordChangeSuccessStatus(),
  };
}

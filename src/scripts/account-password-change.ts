/**
 * Account settings password change ù programmatic Memberstack updateMemberAuth.
 * Does not use data-ms-form="password" (avoids opaque dual success/error messaging).
 */
import {
  MEMBERSTACK_PASSWORD_MIN_LENGTH,
  submitPasswordChange,
  validatePasswordChangeFields,
  type PasswordChangeStatus,
} from "../lib/account/accountPasswordChange";

const FORM_SELECTOR = "[data-kbm-password-change-form]";

type UpdateMemberAuth = (args: {
  oldPassword: string;
  newPassword: string;
}) => Promise<unknown>;

function getUpdateMemberAuth(): UpdateMemberAuth | null {
  const ms = window.$memberstackDom as
    | { updateMemberAuth?: UpdateMemberAuth; onReady?: Promise<unknown> }
    | undefined;
  if (typeof ms?.updateMemberAuth === "function") {
    return ms.updateMemberAuth.bind(ms);
  }
  return null;
}

async function waitForUpdateMemberAuth(timeoutMs = 8000): Promise<UpdateMemberAuth | null> {
  const existing = getUpdateMemberAuth();
  if (existing) return existing;

  const ms = window.$memberstackDom;
  if (ms?.onReady) {
    try {
      await Promise.race([
        ms.onReady,
        new Promise<void>((resolve) => {
          window.setTimeout(resolve, timeoutMs);
        }),
      ]);
    } catch {
      /* ignore */
    }
  }

  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const api = getUpdateMemberAuth();
    if (api) return api;
    await new Promise((r) => window.setTimeout(r, 50));
  }
  return getUpdateMemberAuth();
}

function applyStatus(
  errorEl: HTMLElement,
  successEl: HTMLElement,
  status: PasswordChangeStatus,
): void {
  if (status.kind === "error") {
    errorEl.textContent = status.message;
    errorEl.hidden = false;
    successEl.textContent = "";
    successEl.hidden = true;
    return;
  }
  if (status.kind === "success") {
    successEl.textContent = status.message;
    successEl.hidden = false;
    errorEl.textContent = "";
    errorEl.hidden = true;
    return;
  }
  errorEl.textContent = "";
  errorEl.hidden = true;
  successEl.textContent = "";
  successEl.hidden = true;
}

function setSubmitting(form: HTMLFormElement, submitting: boolean): void {
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (button) {
    button.disabled = submitting;
    button.setAttribute("aria-busy", submitting ? "true" : "false");
    if (!button.dataset.kbmIdleLabel) {
      button.dataset.kbmIdleLabel = button.textContent?.trim() || "Update Password";
    }
    button.textContent = submitting ? "Updating..." : button.dataset.kbmIdleLabel;
  }

  form.querySelectorAll<HTMLInputElement>("input").forEach((input) => {
    input.disabled = submitting;
  });
}

function readFields(form: HTMLFormElement) {
  const current = form.querySelector<HTMLInputElement>('[name="current-password"]');
  const next = form.querySelector<HTMLInputElement>('[name="new-password"]');
  const confirm = form.querySelector<HTMLInputElement>('[name="confirm-password"]');
  return {
    currentPassword: current?.value ?? "",
    newPassword: next?.value ?? "",
    confirmPassword: confirm?.value ?? "",
  };
}

function clearPasswordFields(form: HTMLFormElement): void {
  form.querySelectorAll<HTMLInputElement>('input[type="password"]').forEach((input) => {
    input.value = "";
  });
}

export function bootAccountPasswordChange(root: ParentNode = document): void {
  const form = root.querySelector<HTMLFormElement>(FORM_SELECTOR);
  if (!form || form.dataset.kbmPasswordChangeBound === "1") return;
  form.dataset.kbmPasswordChangeBound = "1";

  const errorEl = form.querySelector<HTMLElement>("[data-kbm-password-change-error]");
  const successEl = form.querySelector<HTMLElement>("[data-kbm-password-change-success]");
  if (!errorEl || !successEl) return;

  let inFlight = false;
  let submitGeneration = 0;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (inFlight) return;

    applyStatus(errorEl, successEl, { kind: "idle" });

    const values = readFields(form);
    const clientCheck = validatePasswordChangeFields(values);
    if (!clientCheck.ok) {
      applyStatus(errorEl, successEl, { kind: "error", message: clientCheck.message });
      return;
    }

    inFlight = true;
    const myGeneration = ++submitGeneration;
    setSubmitting(form, true);

    void (async () => {
      const updateMemberAuth = await waitForUpdateMemberAuth();
      if (!updateMemberAuth) {
        if (myGeneration !== submitGeneration) return;
        applyStatus(errorEl, successEl, {
          kind: "error",
          message: "Password update is unavailable right now. Please refresh and try again.",
        });
        return;
      }

      const result = await submitPasswordChange({
        values,
        updateMemberAuth,
        isStale: () => myGeneration !== submitGeneration,
      });

      if (result.outcome === "stale") return;

      if (result.outcome === "success") {
        applyStatus(errorEl, successEl, result.status);
        clearPasswordFields(form);
        return;
      }

      applyStatus(errorEl, successEl, result.status);
    })().finally(() => {
      if (myGeneration !== submitGeneration) return;
      inFlight = false;
      setSubmitting(form, false);
    });
  });

  // Soft hint only ù Memberstack still enforces rules server-side.
  const hint = form.querySelector<HTMLElement>("[data-kbm-password-change-hint]");
  if (hint && !hint.textContent?.trim()) {
    hint.textContent = `New password must be at least ${MEMBERSTACK_PASSWORD_MIN_LENGTH} characters.`;
  }
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => bootAccountPasswordChange());
  } else {
    bootAccountPasswordChange();
  }
}

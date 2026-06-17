/**
 * Site-wide two-step password reset modal (email code → new password).
 * Replaces MemberStack's forgot-password-only prebuilt modal for triggers on this site.
 */

const MODAL_ID = "kbm-account-password-reset-modal";
const RESET_HASH = "#kbm-reset-code";
const EMAIL_STEP = "email";
const CODE_STEP = "code";

let fetchHookInstalled = false;

function modalEl(): HTMLElement | null {
  return document.getElementById(MODAL_ID);
}

function emailForm(): HTMLFormElement | null {
  const form = document.getElementById("kbm-account-reset-email-form");
  return form instanceof HTMLFormElement ? form : null;
}

function codeForm(): HTMLFormElement | null {
  const form = document.getElementById("kbm-account-reset-code-form");
  return form instanceof HTMLFormElement ? form : null;
}

function emailInput(): HTMLInputElement | null {
  const input = document.getElementById("kbm-account-reset-email");
  return input instanceof HTMLInputElement ? input : null;
}

function codeLeadEl(): HTMLElement | null {
  return document.getElementById("kbm-account-reset-code-lead");
}

function stepPanel(step: typeof EMAIL_STEP | typeof CODE_STEP): HTMLElement | null {
  const modal = modalEl();
  if (!modal) return null;
  const panel = modal.querySelector(`[data-kbm-reset-step="${step}"]`);
  return panel instanceof HTMLElement ? panel : null;
}

function isOpen(): boolean {
  return modalEl()?.getAttribute("aria-hidden") === "false";
}

function setResetRedirect(): void {
  const form = codeForm();
  if (!form) return;
  const target = `${window.location.pathname}${window.location.search}`;
  form.setAttribute("redirect", target || "/account");
}

function showStep(step: typeof EMAIL_STEP | typeof CODE_STEP): void {
  const emailPanel = stepPanel(EMAIL_STEP);
  const codePanel = stepPanel(CODE_STEP);
  if (!emailPanel || !codePanel) return;

  const onCode = step === CODE_STEP;
  emailPanel.hidden = onCode;
  codePanel.hidden = !onCode;
}

function clearCodeFields(): void {
  const token = document.getElementById("kbm-account-reset-token");
  const password = document.getElementById("kbm-account-reset-password");
  if (token instanceof HTMLInputElement) token.value = "";
  if (password instanceof HTMLInputElement) password.value = "";
}

function updateCodeLead(email: string): void {
  const lead = codeLeadEl();
  if (!lead) return;
  const trimmed = email.trim();
  lead.textContent = trimmed
    ? `We sent a 6-digit code to ${trimmed}. Enter it below with your new password.`
    : "Check your email for a 6-digit code, then choose a new password below.";
}

function onEmailSent(): void {
  if (!isOpen()) return;

  const email = emailInput()?.value ?? "";
  updateCodeLead(email);
  showStep(CODE_STEP);

  if (window.location.hash === RESET_HASH) {
    history.replaceState(null, "", window.location.pathname + window.location.search);
  }

  const token = document.getElementById("kbm-account-reset-token");
  if (token instanceof HTMLInputElement) {
    window.requestAnimationFrame(() => token.focus());
  }
}

function installFetchHook(): void {
  if (fetchHookInstalled) return;
  fetchHookInstalled = true;

  const origFetch = window.fetch;
  if (typeof origFetch !== "function") return;

  window.fetch = async function accountResetFetchHook(...args: Parameters<typeof fetch>) {
    const res = await origFetch.apply(this, args);

    if (!isOpen()) return res;

    try {
      const req = args[0];
      const init = args[1] ?? {};
      const url = typeof req === "string" ? req : req instanceof Request ? req.url : "";
      const method = String(
        init.method ?? (req instanceof Request ? req.method : "GET"),
      ).toUpperCase();

      if (method === "POST" && /send-reset-password-email/i.test(url) && res.ok) {
        onEmailSent();
      }
    } catch {
      /* ignore hook errors */
    }

    return res;
  };
}

export function openAccountPasswordResetModal(prefillEmail = ""): void {
  const modal = modalEl();
  if (!modal) return;

  installFetchHook();
  setResetRedirect();
  showStep(EMAIL_STEP);
  clearCodeFields();

  const email = emailInput();
  if (email) {
    email.value = prefillEmail.trim();
  }
  updateCodeLead(prefillEmail);

  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";

  window.requestAnimationFrame(() => {
    email?.focus();
  });
}

export function closeAccountPasswordResetModal(): void {
  const modal = modalEl();
  if (!modal || !isOpen()) return;

  modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  showStep(EMAIL_STEP);
  clearCodeFields();

  if (window.location.hash === RESET_HASH) {
    history.replaceState(null, "", window.location.pathname + window.location.search);
  }
}

function resendCode(): void {
  const form = emailForm();
  if (!form) return;
  if (typeof form.requestSubmit === "function") {
    form.requestSubmit();
  } else {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  }
}

export function initAccountPasswordResetModal(): void {
  const modal = modalEl();
  if (!modal) return;

  window.kbmOpenAccountPasswordResetModal = openAccountPasswordResetModal;
  window.kbmCloseAccountPasswordResetModal = closeAccountPasswordResetModal;

  installFetchHook();

  modal.querySelectorAll("[data-kbm-account-reset-close]").forEach((el) => {
    el.addEventListener("click", () => closeAccountPasswordResetModal());
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen()) closeAccountPasswordResetModal();
  });

  modal.querySelector("[data-kbm-reset-back-email]")?.addEventListener("click", () => {
    showStep(EMAIL_STEP);
    clearCodeFields();
    emailInput()?.focus();
  });

  modal.querySelector("[data-kbm-reset-resend]")?.addEventListener("click", () => {
    resendCode();
  });

  window.addEventListener("hashchange", () => {
    if (window.location.hash === RESET_HASH) onEmailSent();
  });

  document.addEventListener(
    "click",
    (e) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      const trigger = target.closest('[data-ms-modal="forgot-password"]');
      if (!trigger) return;
      e.preventDefault();
      e.stopPropagation();
      openAccountPasswordResetModal();
    },
    true,
  );
}

if (typeof window !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAccountPasswordResetModal);
  } else {
    initAccountPasswordResetModal();
  }
}

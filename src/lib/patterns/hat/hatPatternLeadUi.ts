/**
 * Shared Hat lead-form DOM helpers. Presentation only — not membership gating.
 */

import { decideHatPatternLeadCapture } from "./hatPatternLead";
import {
  buildHatPatternLeadPayload,
  submitHatPatternLeadRequest,
} from "./hatPatternLeadClient";
import { markHatPatternLeadRecognized } from "./hatPatternLeadHint";
import { readKnownHatLeadMember } from "./hatPatternLeadMember";

export function hatLeadCapturePanel(root: ParentNode | Document): HTMLElement | null {
  return root.querySelector<HTMLElement>("[data-hat-lead-capture]");
}

export function setHatLeadCaptureVisible(
  root: ParentNode | Document,
  visible: boolean,
): void {
  const panel = hatLeadCapturePanel(root);
  if (!panel) return;
  panel.hidden = !visible;
}

export function showHatLeadCaptureError(
  root: ParentNode | Document,
  message: string,
): void {
  const error = root.querySelector<HTMLElement>("[data-hat-lead-error]");
  if (!error) return;
  error.hidden = !message;
  error.textContent = message;
}

export function clearHatLeadCaptureError(root: ParentNode | Document): void {
  showHatLeadCaptureError(root, "");
}

export function revealHatLeadCapture(root: ParentNode | Document): void {
  setHatLeadCaptureVisible(root, true);
  const panel = hatLeadCapturePanel(root);
  panel?.scrollIntoView({ behavior: "auto", block: "start" });
  const email = root.querySelector<HTMLInputElement>("[data-hat-lead-email]");
  email?.focus();
}

export async function submitHatLeadForm(
  root: ParentNode | Document,
  options: {
    email?: string;
    firstName?: string;
    botField?: string;
  } = {},
): Promise<boolean> {
  const emailInput = root.querySelector<HTMLInputElement>("[data-hat-lead-email]");
  const botInput = root.querySelector<HTMLInputElement>("[data-hat-lead-bot]");
  const submitBtn = root.querySelector<HTMLButtonElement>("[data-hat-lead-submit]");
  const email = options.email ?? emailInput?.value ?? "";
  const botField = options.botField ?? botInput?.value ?? "";

  const built = buildHatPatternLeadPayload({
    email,
    firstName: options.firstName,
    botField,
  });
  if ("error" in built) {
    showHatLeadCaptureError(root, built.error);
    return false;
  }

  if (submitBtn) submitBtn.disabled = true;
  clearHatLeadCaptureError(root);

  const result = await submitHatPatternLeadRequest(built);
  if (!result.ok) {
    if (submitBtn) submitBtn.disabled = false;
    showHatLeadCaptureError(root, result.error);
    return false;
  }

  markHatPatternLeadRecognized();
  return true;
}

export type HatLeadContinueDecision = "continue" | "show-capture";

/**
 * Resolve whether the visitor may continue to the finished pattern.
 * Skip the form only with a valid recognition marker or a known Memberstack email
 * (silently tagged). Login / membership state alone never skips capture.
 */
export async function resolveHatPatternLeadContinue(args: {
  alreadyCaptured: boolean;
  readMember?: typeof readKnownHatLeadMember;
}): Promise<HatLeadContinueDecision> {
  if (args.alreadyCaptured) return "continue";

  const member = await (args.readMember ?? readKnownHatLeadMember)();
  const decision = decideHatPatternLeadCapture({
    alreadyCaptured: args.alreadyCaptured,
    memberEmail: member?.email,
    memberFirstName: member?.firstName,
  });

  if (decision.action === "continue") return "continue";

  if (decision.action === "submit-known-email") {
    const built = buildHatPatternLeadPayload({
      email: decision.email,
      firstName: decision.firstName,
    });
    if (!("error" in built)) {
      const result = await submitHatPatternLeadRequest(built);
      if (result.ok) markHatPatternLeadRecognized();
    }
    return "continue";
  }

  return "show-capture";
}

export function bindHatLeadForm(
  root: ParentNode | Document,
  onSuccess: () => void | Promise<void>,
): void {
  const form = root.querySelector<HTMLFormElement>("[data-hat-lead-form]");
  if (!form || form.dataset.hatLeadBound === "true") return;
  form.dataset.hatLeadBound = "true";
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (form.dataset.submitting === "true") return;
    form.dataset.submitting = "true";
    void submitHatLeadForm(root)
      .then((ok) => {
        if (ok) return onSuccess();
      })
      .finally(() => {
        form.dataset.submitting = "false";
      });
  });
}

/**
 * Bind individual-course purchase buttons to Memberstack checkout.
 */
import { startCourseCheckout } from "../lib/kinCourse/courseCheckout";

const STATUS_ATTR = "data-course-checkout-status";

function statusEl(root: ParentNode): HTMLElement | null {
  return root instanceof Element
    ? root.querySelector<HTMLElement>(`[${STATUS_ATTR}]`)
    : document.querySelector<HTMLElement>(`[${STATUS_ATTR}]`);
}

function showStatus(root: ParentNode, message: string, tone: "info" | "error" = "info"): void {
  const el = statusEl(root) ?? document.querySelector<HTMLElement>(`[${STATUS_ATTR}]`);
  if (!el) return;
  el.hidden = false;
  el.textContent = message;
  el.dataset.tone = tone;
}

function clearStatus(root: ParentNode): void {
  const el = statusEl(root) ?? document.querySelector<HTMLElement>(`[${STATUS_ATTR}]`);
  if (!el) return;
  el.hidden = true;
  el.textContent = "";
  delete el.dataset.tone;
}

function setBusy(buttons: HTMLButtonElement[], busy: boolean): void {
  for (const btn of buttons) {
    btn.disabled = busy;
    btn.setAttribute("aria-busy", busy ? "true" : "false");
  }
}

const boundButtons = new WeakSet<HTMLButtonElement>();

export function initCourseCheckout(root: ParentNode = document): void {
  const buttons = Array.from(
    root.querySelectorAll<HTMLButtonElement>("[data-course-checkout]"),
  );
  if (!buttons.length) return;

  for (const btn of buttons) {
    if (boundButtons.has(btn)) continue;
    boundButtons.add(btn);
    btn.addEventListener("click", () => {
      void (async () => {
        const courseSlug = btn.dataset.courseSlug ?? btn.closest<HTMLElement>("[data-course-slug]")?.dataset.courseSlug;
        const gate = btn.closest<HTMLElement>("[data-course-gate], [data-kin-course-gate]") ?? document;
        clearStatus(gate);
        setBusy(buttons, true);
        const result = await startCourseCheckout(courseSlug);
        if (!result.ok) {
          if (result.reason !== "signup-canceled") {
            showStatus(gate, result.message, result.reason === "error" ? "error" : "info");
          } else {
            clearStatus(gate);
          }
          setBusy(buttons, false);
          return;
        }
        showStatus(gate, "Opening checkout...", "info");
      })();
    });
  }
}

export function runCourseCheckoutBoot(): void {
  if (typeof document === "undefined") return;
  const start = () => {
    if (document.querySelector("[data-course-checkout]")) initCourseCheckout();
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
}

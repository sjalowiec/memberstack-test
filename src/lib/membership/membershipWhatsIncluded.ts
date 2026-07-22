/**
 * Shared ùWhatùs includedù copy for the /membership sales section and member modal.
 * Keep wording in sync ù do not invent alternate benefits here.
 */

export const MEMBERSHIP_WHATS_INCLUDED_HEADING = "What's included";

export const MEMBERSHIP_WHATS_INCLUDED_GROUPS = [
  {
    title: "Pattern Builders",
    items: [
      "Access every current and future Pattern Builder",
      "Customize patterns using your measurements and preferences",
    ],
  },
  {
    title: "Learning and Support",
    items: [
      "Technique guides and instructional videos",
      "Troubleshooting help and practical machine knitting fixes",
      "Help Hub answers focused on real machine knitting problems",
      "All Knit It Now courses",
    ],
  },
  {
    title: "Tools and Resources",
    items: [
      "Project planning tools and calculators",
      "Ongoing updates, new tools, and future learning resources",
    ],
  },
] as const;

export const MEMBERSHIP_WHATS_INCLUDED_CALLOUT_TITLE = "More than just patterns";

export const MEMBERSHIP_WHATS_INCLUDED_CALLOUT_BODY =
  "Knit It Now supports the entire knitting process. Use your included Pattern Builders to customize garments, then turn to lessons, planning tools, troubleshooting help, and practical resources created specifically for machine knitters.";

const DIALOG_SELECTOR = "[data-membership-whats-included-modal]";
const BOUND_ATTR = "data-membership-whats-included-modal-bound";
const TRIGGER_SELECTOR = "[data-membership-whats-included-open]";
const TRIGGER_BOUND_ATTR = "data-membership-whats-included-open-bound";
const MODE_ATTR = "data-membership-whats-included-mode";

let whatsIncludedReturnFocus: HTMLElement | null = null;

function isDialogElement(el: Element | null): el is HTMLDialogElement {
  return (
    !!el &&
    typeof (el as HTMLDialogElement).showModal === "function" &&
    typeof (el as HTMLDialogElement).close === "function"
  );
}

function getDialog(root: ParentNode = document): HTMLDialogElement | null {
  const el = root.querySelector(DIALOG_SELECTOR);
  return isDialogElement(el) ? el : null;
}

function restoreWhatsIncludedFocus(): void {
  const target = whatsIncludedReturnFocus;
  whatsIncludedReturnFocus = null;
  if (target && typeof target.focus === "function" && document.contains(target)) {
    target.focus({ preventScroll: true });
  }
}

/** Active/canceling: hero opens modal. Sales visitors: hero keeps #whats-included anchor. */
export function setMembershipWhatsIncludedTriggerMode(
  mode: "modal" | "anchor",
  root: ParentNode = document,
): void {
  root.querySelectorAll<HTMLElement>(TRIGGER_SELECTOR).forEach((el) => {
    el.setAttribute(MODE_ATTR, mode);
  });
  if (mode === "anchor") {
    closeMembershipWhatsIncludedModal(root);
  }
}

export function openMembershipWhatsIncludedModal(
  root: ParentNode = document,
  options?: { returnFocus?: HTMLElement | null },
): boolean {
  const dialog = getDialog(root);
  if (!dialog) return false;

  if (options && "returnFocus" in options) {
    whatsIncludedReturnFocus = options.returnFocus ?? null;
  } else if (
    typeof HTMLElement !== "undefined" &&
    document.activeElement instanceof HTMLElement
  ) {
    whatsIncludedReturnFocus = document.activeElement;
  }

  if (!dialog.open) {
    dialog.showModal();
  }

  const closeBtn = dialog.querySelector<HTMLElement>(
    "[data-membership-whats-included-modal-close]",
  );
  (closeBtn ?? dialog).focus({ preventScroll: true });
  return true;
}

export function closeMembershipWhatsIncludedModal(root: ParentNode = document): void {
  const dialog = getDialog(root);
  if (dialog?.open) dialog.close();
}

/** Wire dialog + hero trigger once (no duplicate listeners). */
export function bindMembershipWhatsIncludedModal(root: ParentNode = document): void {
  const dialog = getDialog(root);
  if (dialog && dialog.getAttribute(BOUND_ATTR) !== "true") {
    dialog.setAttribute(BOUND_ATTR, "true");

    const close = (): void => {
      if (dialog.open) dialog.close();
    };

    dialog.querySelectorAll("[data-membership-whats-included-modal-close]").forEach((el) => {
      el.addEventListener("click", (event) => {
        event.preventDefault();
        close();
      });
    });

    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) close();
    });

    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      close();
    });

    dialog.addEventListener("close", () => {
      restoreWhatsIncludedFocus();
    });
  }

  root.querySelectorAll<HTMLElement>(TRIGGER_SELECTOR).forEach((trigger) => {
    if (trigger.getAttribute(TRIGGER_BOUND_ATTR) === "true") return;
    trigger.setAttribute(TRIGGER_BOUND_ATTR, "true");
    trigger.addEventListener("click", (event) => {
      if (trigger.getAttribute(MODE_ATTR) !== "modal") return;
      event.preventDefault();
      openMembershipWhatsIncludedModal(root, { returnFocus: trigger });
    });
  });
}

/** Test-only. */
export function __resetMembershipWhatsIncludedModalForTests(): void {
  whatsIncludedReturnFocus = null;
}

/**
 * Placeholder membership-plans modal (visual only).
 * No Memberstack / Stripe / plan detection.
 */

export const MEMBERSHIP_PLANS_PLACEHOLDER_MODAL_ID =
  "membership-plans-placeholder-modal";

export function openMembershipPlansPlaceholderModal(): void {
  const modal = document.querySelector<HTMLDialogElement>(
    "[data-membership-plans-placeholder-modal]",
  );
  if (!modal || modal.open) return;
  modal.showModal();
}

export function closeMembershipPlansPlaceholderModal(): void {
  const modal = document.querySelector<HTMLDialogElement>(
    "[data-membership-plans-placeholder-modal]",
  );
  if (!modal || !modal.open) return;
  modal.close();
}

export function initMembershipPlansPlaceholderModal(): void {
  const modal = document.querySelector<HTMLDialogElement>(
    "[data-membership-plans-placeholder-modal]",
  );
  if (!modal) return;

  modal.querySelectorAll<HTMLElement>("[data-membership-plans-placeholder-close]").forEach((el) => {
    el.addEventListener("click", () => closeMembershipPlansPlaceholderModal());
  });

  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeMembershipPlansPlaceholderModal();
  });

  modal.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeMembershipPlansPlaceholderModal();
  });
}

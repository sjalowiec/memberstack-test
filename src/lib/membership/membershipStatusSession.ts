/**
 * Once-per-browser-session auto-open tracking for the /membership status modal.
 * sessionStorage only — resets when the browser session ends.
 */

export const MEMBERSHIP_STATUS_MODAL_SESSION_VERSION = "v1";

export function membershipStatusModalSessionKey(memberId: string): string {
  const id = memberId.trim();
  return `kbm-membership-status-modal-${MEMBERSHIP_STATUS_MODAL_SESSION_VERSION}:${id}`;
}

export function hasMembershipStatusModalAutoOpened(
  memberId: string,
  storage: Pick<Storage, "getItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): boolean {
  if (!storage || !memberId.trim()) return false;
  try {
    return storage.getItem(membershipStatusModalSessionKey(memberId)) === "1";
  } catch {
    return false;
  }
}

export function markMembershipStatusModalAutoOpened(
  memberId: string,
  storage: Pick<Storage, "setItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): void {
  if (!storage || !memberId.trim()) return;
  try {
    storage.setItem(membershipStatusModalSessionKey(memberId), "1");
  } catch {
    /* ignore quota / privacy mode */
  }
}

/** Test helper. */
export function clearMembershipStatusModalAutoOpened(
  memberId: string,
  storage: Pick<Storage, "removeItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): void {
  if (!storage || !memberId.trim()) return;
  try {
    storage.removeItem(membershipStatusModalSessionKey(memberId));
  } catch {
    /* ignore */
  }
}

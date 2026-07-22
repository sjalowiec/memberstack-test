import { describe, expect, it } from "vitest";
import {
  clearMembershipStatusModalAutoOpened,
  hasMembershipStatusModalAutoOpened,
  markMembershipStatusModalAutoOpened,
  membershipStatusModalSessionKey,
  MEMBERSHIP_STATUS_MODAL_SESSION_VERSION,
} from "./membershipStatusSession";

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    key() {
      return null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
  };
}

describe("membershipStatusSession", () => {
  it("builds a session key with version and member id", () => {
    expect(membershipStatusModalSessionKey("mem_sb_123")).toBe(
      `kbm-membership-status-modal-${MEMBERSHIP_STATUS_MODAL_SESSION_VERSION}:mem_sb_123`,
    );
  });

  it("tracks once-per-session auto-open in sessionStorage", () => {
    const storage = memoryStorage();
    expect(hasMembershipStatusModalAutoOpened("mem_1", storage)).toBe(false);
    markMembershipStatusModalAutoOpened("mem_1", storage);
    expect(hasMembershipStatusModalAutoOpened("mem_1", storage)).toBe(true);
    expect(hasMembershipStatusModalAutoOpened("mem_2", storage)).toBe(false);
    clearMembershipStatusModalAutoOpened("mem_1", storage);
    expect(hasMembershipStatusModalAutoOpened("mem_1", storage)).toBe(false);
  });
});

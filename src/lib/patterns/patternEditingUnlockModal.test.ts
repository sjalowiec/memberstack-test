import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  dismissPatternEditingUnlockModalForSession,
  isPatternEditingUnlockModalDismissedForSession,
  offerPatternEditingUnlockModal,
  shouldOfferPatternEditingUnlockModal,
  showPatternEditingUnlockModal,
} from "./patternEditingUnlockModal";
import type { SleevelessUserAccess } from "./sleevelessPatternSystemAccess";

const claimedFree: SleevelessUserAccess = {
  loggedIn: true,
  memberId: "ms_free",
  hasSystemAccess: false,
  freeClaimed: true,
  freeClaimedPatternId: "pat_1",
};

const paidMember: SleevelessUserAccess = {
  loggedIn: true,
  memberId: "ms_member",
  hasSystemAccess: true,
  freeClaimed: false,
};

const sessionStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

beforeEach(() => {
  vi.stubGlobal("sessionStorage", sessionStorageMock);
  sessionStorageMock.clear();
});

afterEach(() => {
  sessionStorageMock.clear();
  vi.unstubAllGlobals();
});

describe("patternEditingUnlockModal", () => {
  it("offers the modal for logged-in knitters without edit access", () => {
    expect(shouldOfferPatternEditingUnlockModal(claimedFree)).toBe(true);
    expect(shouldOfferPatternEditingUnlockModal(paidMember)).toBe(false);
    expect(shouldOfferPatternEditingUnlockModal(null)).toBe(false);
  });

  it("remembers dismiss for the browser session", () => {
    expect(isPatternEditingUnlockModalDismissedForSession()).toBe(false);
    dismissPatternEditingUnlockModalForSession();
    expect(isPatternEditingUnlockModalDismissedForSession()).toBe(true);
  });

  it("re-opens on explicit edit attempts after the auto-prompt was dismissed", () => {
    const showModal = vi.fn();
    const dialog = {
      showModal,
      open: false,
      close: vi.fn(),
      getAttribute: () => null,
      setAttribute: vi.fn(),
      querySelectorAll: () => [],
      addEventListener: vi.fn(),
    } as unknown as HTMLDialogElement;

    vi.stubGlobal("document", {
      querySelector: () => dialog,
    });

    dismissPatternEditingUnlockModalForSession();
    expect(showPatternEditingUnlockModal()).toBe(false);
    expect(offerPatternEditingUnlockModal(claimedFree)).toBe(true);
    expect(showModal).toHaveBeenCalledTimes(1);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyLockedPatternEditButtonState,
  dismissPatternEditingUnlockModalForSession,
  isPatternEditingUnlockModalDismissedForSession,
  offerPatternEditingUnlockModal,
  shouldOfferPatternEditingUnlockModal,
  showPatternEditingUnlockModal,
} from "./patternEditingUnlockModal";
import type { SleevelessUserAccess } from "./sleevelessPatternSystemAccess";

import { testAccess } from "./patternAccessTestFixtures";

const claimedFree = testAccess({
  loggedIn: true,
  memberId: "ms_free",
  hasSystemAccess: false,
  freeClaimed: true,
  freeClaimedPatternId: "pat_1",
});

const paidMember = testAccess({
  loggedIn: true,
  memberId: "ms_member",
  hasSystemAccess: true,
  freeClaimed: false,
});

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

  it("checks edit access per pattern system when the system is passed explicitly", () => {
    const dropShoulderClaimed = testAccess({
      loggedIn: true,
      memberId: "ms_free",
      hasSystemAccess: false,
      claimedSystem: "drop-shoulder",
      freeClaimed: true,
      freeClaimedPatternId: "pat_ds",
    });
    // On /account (or any page without drop-shoulder context), page resolution defaults to sleeveless.
    expect(shouldOfferPatternEditingUnlockModal(dropShoulderClaimed)).toBe(false);
    expect(shouldOfferPatternEditingUnlockModal(dropShoulderClaimed, "drop-shoulder")).toBe(true);
    expect(shouldOfferPatternEditingUnlockModal(dropShoulderClaimed, "sleeveless")).toBe(false);
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

  it("keeps the pattern workspace Edit button visible but locked", () => {
    const button = {
      hidden: true,
      classList: { toggle: vi.fn() },
      removeAttribute: vi.fn(),
      setAttribute: vi.fn(),
    } as unknown as HTMLElement;

    applyLockedPatternEditButtonState(button, true);
    expect(button.hidden).toBe(false);
    expect(button.classList.toggle).toHaveBeenCalledWith("is-disabled", true);
    expect(button.setAttribute).toHaveBeenCalledWith("aria-disabled", "true");
  });
});

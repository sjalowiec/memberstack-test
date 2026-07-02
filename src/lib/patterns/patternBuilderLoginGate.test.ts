import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Default deps come from these two modules; mock them so we can assert the gate reuses them
// without pulling in the real Memberstack / DOM stack.
const isSleevelessPatternMemberLoggedIn = vi.fn<[], Promise<boolean>>();
const openMemberstackLoginModal = vi.fn<[string?], void>();

vi.mock("./sleevelessPatternLoginGate", () => ({
  isSleevelessPatternMemberLoggedIn: () => isSleevelessPatternMemberLoggedIn(),
}));
vi.mock("../memberstackLogin", () => ({
  openMemberstackLoginModal: (returnPath?: string) => openMemberstackLoginModal(returnPath),
}));

import {
  ensurePatternBuilderLogin,
  installPatternBuilderLoginGate,
} from "./patternBuilderLoginGate";

beforeEach(() => {
  isSleevelessPatternMemberLoggedIn.mockReset();
  openMemberstackLoginModal.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ensurePatternBuilderLogin (Hat + Blanket create/generate gate)", () => {
  describe("logged-out visitors cannot generate a pattern", () => {
    it("returns false and opens the login prompt (Hat builder path)", async () => {
      const openLoginModal = vi.fn();
      const allowed = await ensurePatternBuilderLogin({
        isLoggedIn: async () => false,
        openLoginModal,
      });

      expect(allowed).toBe(false);
      expect(openLoginModal).toHaveBeenCalledTimes(1);
    });

    it("returns false and opens the login prompt (Blanket builder path)", async () => {
      const openLoginModal = vi.fn();
      const allowed = await ensurePatternBuilderLogin({
        isLoggedIn: async () => false,
        openLoginModal,
      });

      expect(allowed).toBe(false);
      expect(openLoginModal).toHaveBeenCalledTimes(1);
    });

    it("treats an errored login check as logged-out (never silently proceeds)", async () => {
      const openLoginModal = vi.fn();
      const allowed = await ensurePatternBuilderLogin({
        isLoggedIn: async () => {
          throw new Error("memberstack unavailable");
        },
        openLoginModal,
      });

      expect(allowed).toBe(false);
      expect(openLoginModal).toHaveBeenCalledTimes(1);
    });
  });

  describe("logged-in visitors proceed unchanged", () => {
    it("returns true and does not open the login prompt", async () => {
      const openLoginModal = vi.fn();
      const allowed = await ensurePatternBuilderLogin({
        isLoggedIn: async () => true,
        openLoginModal,
      });

      expect(allowed).toBe(true);
      expect(openLoginModal).not.toHaveBeenCalled();
    });
  });

  describe("default dependencies reuse the existing sleeveless/drop-shoulder auth helpers", () => {
    it("uses isSleevelessPatternMemberLoggedIn + opens Memberstack modal when logged out", async () => {
      isSleevelessPatternMemberLoggedIn.mockResolvedValue(false);

      const allowed = await ensurePatternBuilderLogin();

      expect(allowed).toBe(false);
      expect(isSleevelessPatternMemberLoggedIn).toHaveBeenCalledTimes(1);
      expect(openMemberstackLoginModal).toHaveBeenCalledTimes(1);
    });

    it("allows generation without a modal when the shared helper reports logged-in", async () => {
      isSleevelessPatternMemberLoggedIn.mockResolvedValue(true);

      const allowed = await ensurePatternBuilderLogin();

      expect(allowed).toBe(true);
      expect(isSleevelessPatternMemberLoggedIn).toHaveBeenCalledTimes(1);
      expect(openMemberstackLoginModal).not.toHaveBeenCalled();
    });
  });
});

describe("installPatternBuilderLoginGate (hat inline-script bridge)", () => {
  it("installs window.kbmEnsurePatternBuilderLogin that gates via the shared helper", async () => {
    vi.stubGlobal("window", {} as Window & typeof globalThis);
    isSleevelessPatternMemberLoggedIn.mockResolvedValue(false);

    installPatternBuilderLoginGate();

    expect(typeof window.kbmEnsurePatternBuilderLogin).toBe("function");
    await expect(window.kbmEnsurePatternBuilderLogin!()).resolves.toBe(false);
    expect(openMemberstackLoginModal).toHaveBeenCalledTimes(1);
  });

  it("no-ops safely when there is no window (SSR)", () => {
    vi.stubGlobal("window", undefined);
    expect(() => installPatternBuilderLoginGate()).not.toThrow();
  });
});

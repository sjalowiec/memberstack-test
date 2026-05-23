import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("../devBypass", () => ({ devBypass: false }));

import { isSleevelessPatternMemberLoggedIn } from "./sleevelessPatternLoginGate";

describe("isSleevelessPatternMemberLoggedIn", () => {
  const prevMs = globalThis.window?.$memberstackDom;

  beforeEach(() => {
    vi.stubGlobal("window", {
      ...globalThis.window,
      $memberstackDom: {
        getCurrentMember: vi.fn().mockResolvedValue({ data: { id: "ms_test" } }),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (prevMs !== undefined) {
      (globalThis.window as Window & { $memberstackDom?: unknown }).$memberstackDom = prevMs;
    }
  });

  it("is true when Memberstack returns a member id", async () => {
    await expect(isSleevelessPatternMemberLoggedIn()).resolves.toBe(true);
  });

  it("is false when Memberstack returns no member", async () => {
    vi.mocked(window.$memberstackDom!.getCurrentMember!).mockResolvedValue({ data: null });
    await expect(isSleevelessPatternMemberLoggedIn()).resolves.toBe(false);
  });
});

import { describe, expect, it, vi } from "vitest";
import { resolveHatPatternLeadContinue } from "./hatPatternLeadUi";

describe("resolveHatPatternLeadContinue", () => {
  it("continues immediately when the browser is already recognized", async () => {
    const readMember = vi.fn(async () => null);
    await expect(
      resolveHatPatternLeadContinue({
        alreadyCaptured: true,
        readMember,
      }),
    ).resolves.toBe("continue");
    expect(readMember).not.toHaveBeenCalled();
  });

  it("shows capture for an unrecognized logged-out visitor", async () => {
    await expect(
      resolveHatPatternLeadContinue({
        alreadyCaptured: false,
        memberLoggedIn: false,
        readMember: async () => null,
      }),
    ).resolves.toBe("show-capture");
  });

  it("continues for a logged-in visitor without showing the form", async () => {
    await expect(
      resolveHatPatternLeadContinue({
        alreadyCaptured: false,
        memberLoggedIn: true,
        readMember: async () => ({ email: "", loggedIn: true }),
      }),
    ).resolves.toBe("continue");
  });

  it("silently submits a known email then continues", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ ok: true, message: "ok" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetchImpl);

    const next = await resolveHatPatternLeadContinue({
      alreadyCaptured: false,
      readMember: async () => ({
        email: "ada@example.com",
        firstName: "Ada",
        loggedIn: true,
      }),
    });

    expect(next).toBe("continue");
    expect(fetchImpl).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

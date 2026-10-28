import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { LEAD_RECOGNITION_TTL_MS } from "../leads/leadRecognitionHint";
import {
  decideGettingStartedGuideAccess,
  guideSignupUnlock,
  resolveGettingStartedGuideAccess,
  signedInMemberFromAccessSnapshot,
} from "./guideLead";
import {
  GETTING_STARTED_GUIDE_TTL_MS,
  isGettingStartedGuideRecognized,
  markGettingStartedGuideRecognized,
} from "./guideLeadHint";
import { GETTING_STARTED_GUIDE_STORAGE_KEY } from "./guideLeadShared";

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => data.delete(key),
    setItem: (key, value) => data.set(key, String(value)),
  };
}

describe("Getting Started Guide access", () => {
  it("keeps the guide behind the form until recognition or a signed-in member", () => {
    expect(
      decideGettingStartedGuideAccess({ recognized: false, memberLoggedIn: false }),
    ).toBe("show-form");
    expect(
      decideGettingStartedGuideAccess({ recognized: true, memberLoggedIn: false }),
    ).toBe("show-guide");
    expect(
      decideGettingStartedGuideAccess({ recognized: false, memberLoggedIn: true }),
    ).toBe("show-guide");
  });

  it("treats any signed-in Memberstack state as a bypass and guests as the form", () => {
    expect(signedInMemberFromAccessSnapshot({ viewerAccessState: "memberAccess" })).toBe(true);
    expect(signedInMemberFromAccessSnapshot({ viewerAccessState: "loggedInNoAccess" })).toBe(
      true,
    );
    expect(signedInMemberFromAccessSnapshot({ viewerAccessState: "loggedOut" })).toBe(false);
    expect(signedInMemberFromAccessSnapshot(null)).toBeNull();
  });

  it("does not call ActiveCampaign when a signed-in member bypasses the form", async () => {
    const fetchImpl = vi.fn();
    vi.stubGlobal("fetch", fetchImpl);
    const readMember = vi.fn(async () => ({ loggedIn: true }));

    await expect(
      resolveGettingStartedGuideAccess({ recognized: false, readMember }),
    ).resolves.toBe("show-guide");

    expect(fetchImpl).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("does not unlock when signup fails", () => {
    expect(guideSignupUnlock({ ok: false, error: "try again" })).toEqual({
      unlock: false,
      error: "try again",
    });
    expect(guideSignupUnlock({ ok: true })).toEqual({ unlock: true });
  });

  it("remembers a successful signup for one year and not the email", () => {
    const storage = memoryStorage();
    const now = Date.parse("2026-10-28T12:00:00Z");
    expect(GETTING_STARTED_GUIDE_TTL_MS).toBe(LEAD_RECOGNITION_TTL_MS);
    expect(markGettingStartedGuideRecognized(now, storage)).toBe(true);
    expect(storage.getItem(GETTING_STARTED_GUIDE_STORAGE_KEY)).toBe(String(now));
    expect(storage.getItem(GETTING_STARTED_GUIDE_STORAGE_KEY)).not.toMatch(/@/);
    expect(isGettingStartedGuideRecognized(now + GETTING_STARTED_GUIDE_TTL_MS - 1, storage)).toBe(
      true,
    );
    expect(isGettingStartedGuideRecognized(now + GETTING_STARTED_GUIDE_TTL_MS + 1, storage)).toBe(
      false,
    );
  });

  it("does not render the guide sections outside the inert template", () => {
    const source = readFileSync(
      new URL("../../pages/getting-started-guide.astro", import.meta.url),
      "utf8",
    );
    const visible = source.replace(/<template\b[\s\S]*?<\/template>/g, "");
    expect(source).toContain("1. Identify your machine");
    expect(source).toContain("2. Do you have your machine’s manual?");
    expect(source).toContain("3. Check your sponge bar");
    expect(source).toContain("4. Choose a suitable yarn");
    expect(source).toContain("5. Get comfortable knitting again");
    expect(source).toContain("6. Get personal help");
    expect(visible).not.toContain("1. Identify your machine");
    expect(visible).not.toContain("2. Do you have your machine’s manual?");
    expect(visible).not.toContain("3. Check your sponge bar");
    expect(visible).not.toContain("6. Get personal help");
    expect(source).toContain(
      '<a href="/reference/machine-brands" target="_blank" rel="noopener noreferrer">',
    );
    expect(source).toContain(
      '<a href="https://mkmanuals.com" target="_blank" rel="noopener noreferrer">',
    );
    expect(visible).toContain("Enter your first name and email to open the Getting Started Guide");
    expect(visible).toContain("helpful follow-up emails from Knit It Now");
  });
});

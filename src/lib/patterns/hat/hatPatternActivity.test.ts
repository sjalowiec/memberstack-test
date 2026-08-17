import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stubLocalStorage, stubSessionStorage } from "../test/stubLocalStorage";

vi.mock("../patternActivityLog", () => ({
  logPatternActivity: vi.fn(),
}));

import { logPatternActivity } from "../patternActivityLog";
import {
  HAT_GENERATION_ACTIVITY_SESSION_KEY,
  logHatPatternGenerated,
  markHatGenerationActivityPending,
  peekHatGenerationActivityPending,
  rememberHatActivityEmail,
  takeHatGenerationActivityPending,
} from "./hatPatternActivity";

const logMock = vi.mocked(logPatternActivity);

describe("hatPatternActivity", () => {
  beforeEach(() => {
    stubLocalStorage();
    stubSessionStorage();
    localStorage.clear();
    sessionStorage.clear();
    logMock.mockReset();
    logMock.mockResolvedValue(true);
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("consumes the builder token so a generation is logged only once", () => {
    expect(takeHatGenerationActivityPending()).toBe(false);
    markHatGenerationActivityPending();
    expect(peekHatGenerationActivityPending()).toBe(true);
    expect(takeHatGenerationActivityPending()).toBe(true);
    expect(sessionStorage.getItem(HAT_GENERATION_ACTIVITY_SESSION_KEY)).toBeNull();
    expect(takeHatGenerationActivityPending()).toBe(false);
  });

  it("logs a member Hat generation with member membership", async () => {
    markHatGenerationActivityPending();
    const sent = await logHatPatternGenerated({
      viewerAccessState: "memberAccess",
      guestEmail: "member@example.com",
      patternTitle: "My Hat",
    });
    expect(sent).toBe(true);
    expect(logMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "pattern_generated",
        patternSystem: "hat",
        membership: "member",
        patternTitle: "My Hat",
      }),
    );
  });

  it("logs a free logged-out Hat generation after email capture", async () => {
    markHatGenerationActivityPending();
    await logHatPatternGenerated({
      viewerAccessState: "loggedOut",
      guestEmail: "free@example.com",
    });
    expect(logMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "pattern_generated",
        patternSystem: "hat",
        membership: "free",
        guestEmail: "free@example.com",
        userEmail: "free@example.com",
      }),
    );
  });

  it("classifies a signed-in user without pattern access as free", async () => {
    markHatGenerationActivityPending();
    await logHatPatternGenerated({
      viewerAccessState: "loggedInNoAccess",
      guestEmail: "nosub@example.com",
    });
    expect(logMock).toHaveBeenCalledWith(
      expect.objectContaining({
        membership: "free",
        patternSystem: "hat",
        guestEmail: undefined,
        userEmail: "nosub@example.com",
      }),
    );
  });

  it("does not log again without a fresh builder token", async () => {
    const sent = await logHatPatternGenerated({
      viewerAccessState: "memberAccess",
    });
    expect(sent).toBe(false);
    expect(logMock).not.toHaveBeenCalled();
  });

  it("remembers a captured guest email for a later continue", async () => {
    rememberHatActivityEmail("kept@example.com");
    markHatGenerationActivityPending();
    await logHatPatternGenerated({
      viewerAccessState: "loggedOut",
    });
    expect(logMock).toHaveBeenCalledWith(
      expect.objectContaining({
        guestEmail: "kept@example.com",
        userEmail: "kept@example.com",
        membership: "free",
      }),
    );
  });
});

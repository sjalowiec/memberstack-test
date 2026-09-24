import { beforeEach, describe, expect, it, vi } from "vitest";
import { stubSessionStorage } from "./test/stubLocalStorage";
import {
  logGeneratedPatternOnce,
  markPatternGenerationPending,
  takePatternGenerationPending,
} from "./patternGenerationActivity";

const logMock = vi.fn(async () => true);

vi.mock("./patternActivityLog", () => ({
  logPatternActivity: (...args: unknown[]) => logMock(...args),
}));

describe("pattern generation token", () => {
  beforeEach(() => {
    stubSessionStorage();
    sessionStorage.clear();
    logMock.mockClear();
  });

  it("records one generation and ignores a reload", async () => {
    markPatternGenerationPending();
    expect(
      await logGeneratedPatternOnce({ patternSystem: "sideways-cardigan", sourcePage: "/patterns/sideways-cardigan/summary/" }),
    ).toBe(true);
    expect(await logGeneratedPatternOnce({ patternSystem: "sideways-cardigan" })).toBe(false);
    expect(logMock).toHaveBeenCalledTimes(1);
    expect(logMock).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "pattern_generated", patternSystem: "sideways-cardigan" }),
    );
  });

  it("does not treat an open as a generation when no builder token exists", async () => {
    expect(takePatternGenerationPending()).toBe(false);
    expect(await logGeneratedPatternOnce({ patternSystem: "socks" })).toBe(false);
    expect(logMock).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./patternActivityLog", () => ({
  logPatternActivity: vi.fn(() => Promise.resolve(true)),
}));

vi.mock("./patternStorage", () => ({
  getCurrentPattern: () => ({
    id: "draft-1",
    style: { patternMode: "express" },
  }),
}));

vi.mock("./sleevelessPatternProjectMeta", () => ({
  getPatternProjectMeta: () => ({ title: "Drop Shoulder Pullover" }),
}));

vi.mock("./customPatternProjectActiveId", () => ({
  readActiveCustomPatternProjectId: () => "proj-drop",
}));

vi.mock("./patternSystemId", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./patternSystemId")>();
  return {
    ...actual,
    resolvePatternSystemFromWorkingSession: () => "drop-shoulder",
    resolvePatternSystemFromPage: () => "drop-shoulder",
  };
});

import { logPatternActivity } from "./patternActivityLog";
import {
  logCurrentPatternActivity,
  logSleevelessPatternActivity,
  resolveActivityPatternSystem,
} from "./sleevelessPatternActivity";

const logMock = vi.mocked(logPatternActivity);

describe("current pattern activity helper", () => {
  beforeEach(() => {
    logMock.mockClear();
  });

  it("resolves Drop Shoulder instead of hardcoding sleeveless", () => {
    expect(resolveActivityPatternSystem()).toBe("drop-shoulder");
    expect(resolveActivityPatternSystem("sleeveless")).toBe("sleeveless");
  });

  it("logs Drop Shoulder activity under patternSystem drop-shoulder", () => {
    logCurrentPatternActivity("pattern_generated");
    expect(logMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "pattern_generated",
        patternSystem: "drop-shoulder",
        patternId: "proj-drop",
        patternTitle: "Drop Shoulder Pullover",
        mode: "express",
      }),
    );
  });

  it("keeps the sleeveless alias on the same generic helper", () => {
    logSleevelessPatternActivity("pattern_printed");
    expect(logMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "pattern_printed",
        patternSystem: "drop-shoulder",
      }),
    );
  });
});

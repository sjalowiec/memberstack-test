import { beforeEach, describe, expect, it, vi } from "vitest";
import { stubLocalStorage, stubSessionStorage } from "./test/stubLocalStorage";
import {
  PATTERN_WORKSPACE_BUILDER_HANDOFF_QUERY,
  PATTERN_WORKSPACE_BUILDER_HANDOFF_SESSION_KEY,
  markPatternWorkspaceBuilderHandoff,
  peekPatternWorkspaceBuilderHandoff,
  runPatternWorkspaceBuilderGenerationHandoff,
  stripPatternWorkspaceBuilderHandoffFromUrl,
} from "./patternWorkspaceBuilderGenerationHandoff";

const loadChartsMock = vi.fn();
const prepareMock = vi.fn();
const flushMock = vi.fn();
const logActivityMock = vi.fn();

vi.mock("./sleevelessExpressSizeChartClient", () => ({
  loadExpressSweaterCharts: (...args: unknown[]) => loadChartsMock(...args),
}));

vi.mock("./prepareCustomBuildPatternGeneration", () => ({
  prepareCustomBuildPatternGeneration: (...args: unknown[]) => prepareMock(...args),
}));

vi.mock("./flushExpressWizardToCanonicalPattern", () => ({
  flushExpressWizardToCanonicalPattern: (...args: unknown[]) => flushMock(...args),
}));

vi.mock("./sleevelessPatternActivity", () => ({
  logSleevelessPatternActivity: (...args: unknown[]) => logActivityMock(...args),
}));

describe("patternWorkspaceBuilderGenerationHandoff", () => {
  beforeEach(() => {
    stubLocalStorage();
    stubSessionStorage();
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
    loadChartsMock.mockResolvedValue(undefined);
  });

  it("peek reads sessionStorage flag", () => {
    markPatternWorkspaceBuilderHandoff();
    expect(peekPatternWorkspaceBuilderHandoff()).toBe(true);
  });

  it("peek reads generated=1 query param", () => {
    expect(
      peekPatternWorkspaceBuilderHandoff(
        "https://example.test/patterns/sleeveless/pattern/?generated=1",
      ),
    ).toBe(true);
    expect(
      peekPatternWorkspaceBuilderHandoff("https://example.test/patterns/sleeveless/pattern/"),
    ).toBe(false);
  });

  it("run handoff flushes, prepares, logs, and consumes flags", async () => {
    markPatternWorkspaceBuilderHandoff();
    const replaceState = vi.fn();
    vi.stubGlobal("window", {
      location: { href: "https://example.test/patterns/sleeveless/pattern/" },
      history: { replaceState, state: null },
    });

    const ran = await runPatternWorkspaceBuilderGenerationHandoff();
    expect(ran).toBe(true);
    expect(loadChartsMock).toHaveBeenCalled();
    expect(prepareMock).toHaveBeenCalled();
    expect(flushMock).toHaveBeenCalled();
    expect(logActivityMock).toHaveBeenCalledWith("pattern_generated");
    expect(sessionStorage.getItem(PATTERN_WORKSPACE_BUILDER_HANDOFF_SESSION_KEY)).toBeNull();
  });

  it("run handoff from query param strips generated from the URL", async () => {
    const replaceState = vi.fn();
    vi.stubGlobal("window", {
      location: {
        href: `https://example.test/patterns/drop-shoulder/pattern/?${PATTERN_WORKSPACE_BUILDER_HANDOFF_QUERY}=1&tab=pattern`,
      },
      history: { replaceState, state: null },
    });

    const ran = await runPatternWorkspaceBuilderGenerationHandoff();
    expect(ran).toBe(true);
    stripPatternWorkspaceBuilderHandoffFromUrl();
    expect(replaceState).toHaveBeenCalled();
  });

  it("no-ops when no handoff flag is present", async () => {
    const ran = await runPatternWorkspaceBuilderGenerationHandoff({
      href: "https://example.test/patterns/sleeveless/pattern/",
    });
    expect(ran).toBe(false);
    expect(loadChartsMock).not.toHaveBeenCalled();
    expect(flushMock).not.toHaveBeenCalled();
    expect(logActivityMock).not.toHaveBeenCalled();
  });

  it("returns false when size charts fail to load", async () => {
    markPatternWorkspaceBuilderHandoff();
    loadChartsMock.mockRejectedValue(new Error("offline"));
    const ran = await runPatternWorkspaceBuilderGenerationHandoff();
    expect(ran).toBe(false);
    expect(flushMock).not.toHaveBeenCalled();
    expect(logActivityMock).not.toHaveBeenCalled();
  });
});

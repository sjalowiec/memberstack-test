/**
 * Regression: hip must survive the real save path (design-page Save New Project, no measure DOM).
 * syncCustomBuildToPatternStorage reconciles straight-torso hip down to bust and must not run during save payload build.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildSavePayloadFromWorkingDraft, createCustomPatternProject } from "./customPatternProjectClient";
import { smartSaveCustomPatternProject } from "./customPatternSavedProjectsPanel";
import {
  flushCustomBuildMeasurementOverridesToCanonical,
  loadMeasurementOverrides,
  persistMeasurementOverrides,
  readCanonicalMeasurementOverrides,
} from "./sleevelessCustomMeasurementStorage";
import { syncCustomBuildToPatternStorage } from "./syncCustomBuildToPatternStorage";
import { reconcileStraightTorsoOverridesAfterChartSync } from "./sleevelessCustomBuildBodyMeasurements";
import { hydrateSavedCustomPatternProjectSession } from "./hydrateSavedCustomPatternProject";
import {
  getCurrentPattern,
  saveCurrentPattern,
  SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY,
} from "./patternStorage";
import { stubLocalStorage } from "./test/stubLocalStorage";

vi.mock("./customPatternProjectClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./customPatternProjectClient")>();
  return {
    ...actual,
    createCustomPatternProject: vi.fn(),
  };
});

const baseOverrides = {
  finishedNeckOpeningWidth: "6",
  neckDepth: "3",
  shoulderWidth: "14",
  armholeDepth: "8",
  chestBust: "40",
  hip: "40",
  finishedLength: "24",
  hemDepth: "2",
};

function seedStraightCustomBuildDraft(): void {
  localStorage.setItem(
    SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY,
    JSON.stringify({
      values: {
        who: "women",
        selectedSize: "M",
        fit: "standard",
        neckline: "round",
        front: "closed",
        style: "straight-pullover",
      },
      cbMeasurementOverrides: { ...baseOverrides },
    }),
  );
  localStorage.setItem("kbm_sleeveless_custom_build_body_shape", "straight");
  localStorage.setItem("kbm_sleeveless_custom_build_garment_type", "pullover");
  saveCurrentPattern({
    style: { patternMode: "custom-build", garmentStyle: "pullover", bodyShape: "straight" },
    fit: {
      selectedSize: "M",
      easeChoice: "standard",
      sizingChart: "misses",
      selectedMeasurements: { finished_bust_chest: 40, finished_hip: 40 },
      cbMeasurementOverrides: { ...baseOverrides },
    },
    yarnGauge: { gaugeStitchRaw: "20", gaugeRowRaw: "26" },
    patternProject: { title: "Hip handoff vest", notes: "", titleCustomized: true },
  });
}

/** Saved-projects panel on design page — no `[data-cb-measure-root]`. */
function createDesignPageSavePanelRoot(): ParentNode {
  return {
    querySelector(sel: string) {
      if (sel === "[data-cb-measure-root]") return null;
      if (sel === "[data-cb-project-name]") {
        return { value: "Hip handoff vest", trim: () => "Hip handoff vest" };
      }
      return null;
    },
    querySelectorAll() {
      return [];
    },
  } as unknown as ParentNode;
}

function cbFromPayload(payload: ReturnType<typeof buildSavePayloadFromWorkingDraft>): Record<string, string> {
  const fit = payload.pattern.fit as Record<string, unknown>;
  return (fit.cbMeasurementOverrides ?? {}) as Record<string, string>;
}

describe("custom build save payload hip handoff", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
    vi.clearAllMocks();
    seedStraightCustomBuildDraft();
  });

  it("straight-torso reconcile alone resets hip above bust+tolerance (failure mode)", () => {
    const reconciled = reconcileStraightTorsoOverridesAfterChartSync(40, {
      ...baseOverrides,
      hip: "43",
    });
    expect(reconciled.hip).toBe("40");
    persistMeasurementOverrides(reconciled);
    expect(readCanonicalMeasurementOverrides().hip).toBe("40");
  });

  it("design-page save path keeps hip 43 after user persist (no sync during payload build)", () => {
    persistMeasurementOverrides({ ...baseOverrides, hip: "43" });
    expect(readCanonicalMeasurementOverrides().hip).toBe("43");

    const panelRoot = createDesignPageSavePanelRoot();
    const payload = buildSavePayloadFromWorkingDraft("Hip handoff vest", {
      family: "sleeveless",
      flushRoot: panelRoot,
    });

    expect(cbFromPayload(payload).hip).toBe("43");
    expect(cbFromPayload(payload).chestBust).toBe("40");
    expect(readCanonicalMeasurementOverrides().hip).toBe("43");
  });

  it("foundation design-page sync then save keeps hip 43 (real failure mode)", () => {
    persistMeasurementOverrides({ ...baseOverrides, hip: "43" });
    syncCustomBuildToPatternStorage({ awaitCharts: false });
    expect(readCanonicalMeasurementOverrides().hip).toBe("43");

    const panelRoot = createDesignPageSavePanelRoot();
    const payload = buildSavePayloadFromWorkingDraft("After design sync", { flushRoot: panelRoot });
    expect(cbFromPayload(payload).hip).toBe("43");
  });

  it("smartSave create sends hip 43 in the request body", async () => {
    persistMeasurementOverrides({ ...baseOverrides, hip: "43" });
    const panelRoot = createDesignPageSavePanelRoot();

    let capturedBody: Record<string, unknown> | undefined;
    vi.mocked(createCustomPatternProject).mockImplementation(async (payload) => {
      capturedBody = payload as unknown as Record<string, unknown>;
      const fit = (payload.pattern.fit as Record<string, unknown>).cbMeasurementOverrides as Record<
        string,
        string
      >;
      return {
        ok: true,
        project: {
          id: "proj-hip",
          name: payload.name,
          family: "sleeveless",
          source: "custom-build",
          notes: "",
          pattern: payload.pattern,
          customOverrides: {},
          createdAt: "t1",
          updatedAt: "t2",
          version: 1,
        },
      };
    });

    const res = await smartSaveCustomPatternProject({
      mode: "create",
      resolveName: () => "Hip handoff vest",
      root: panelRoot,
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(capturedBody).toBeDefined();
    const sentFit = (capturedBody!.pattern as Record<string, unknown>).fit as Record<string, unknown>;
    expect((sentFit.cbMeasurementOverrides as Record<string, string>).hip).toBe("43");

    hydrateSavedCustomPatternProjectSession(res.project);
    expect(loadMeasurementOverrides().hip).toBe("43");
    expect(getCurrentPattern().fit?.cbMeasurementOverrides?.hip).toBe("43");
  });

  it("flush after reconcile restores DOM hip before save payload build", () => {
    const measureRoot = {
      querySelector(sel: string) {
        if (sel === "[data-cb-measure-root]") return measureRoot;
        const m = /data-cb-measure-input="([^"]+)"/.exec(sel);
        if (!m) return null;
        if (m[1] === "hip") return { value: "43", trim: () => "43" };
        if (m[1] === "chestBust") return { value: "40", trim: () => "40" };
        return null;
      },
      querySelectorAll() {
        return [];
      },
    } as unknown as ParentNode;

    persistMeasurementOverrides(
      reconcileStraightTorsoOverridesAfterChartSync(40, { ...baseOverrides, hip: "43" }),
    );
    expect(readCanonicalMeasurementOverrides().hip).toBe("40");

    flushCustomBuildMeasurementOverridesToCanonical({ root: measureRoot });
    expect(readCanonicalMeasurementOverrides().hip).toBe("43");

    const payload = buildSavePayloadFromWorkingDraft("Hip handoff vest", { flushRoot: measureRoot });
    expect(cbFromPayload(payload).hip).toBe("43");
  });
});

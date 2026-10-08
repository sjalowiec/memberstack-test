/**
 * Summary/Edit Save Changes must create a My Patterns record when none is linked,
 * and keep the custom title on create.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { stubLocalStorage } from "./test/stubLocalStorage";
import {
  clearActiveCustomPatternProjectId,
  readActiveCustomPatternProjectId,
  writeActiveCustomPatternProjectId,
} from "./customPatternProjectActiveId";
import { persistSidewaysCardiganSummaryProject } from "./sidewaysCardiganSummarySave";
import { withSidewaysCardiganConstructionAuthored } from "./sidewaysCardiganConstructionIdentity";
import { saveCurrentPattern } from "./patternStorage";
import { testAccess } from "./patternAccessTestFixtures";
import type { CustomPatternProject, SaveCustomPatternProjectRequest } from "./customPatternProjectTypes";
import type { SleevelessPatternRecord } from "./patternStorage";

vi.mock("./customPatternProjectClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./customPatternProjectClient")>();
  return {
    ...actual,
    createCustomPatternProject: vi.fn(),
    updateCustomPatternProject: vi.fn(),
    listCustomPatternProjects: vi.fn(async () => ({ ok: true, projects: [] })),
  };
});

vi.mock("./sleevelessPatternSystemAccessClient", () => ({
  resolveSleevelessUserAccess: vi.fn(),
  markFreePatternClaimedForSystem: vi.fn().mockResolvedValue(true),
  markFreeSleevelessPatternClaimed: vi.fn().mockResolvedValue(true),
}));

vi.mock("./patternSystemId", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./patternSystemId")>();
  return {
    ...actual,
    resolvePatternSystemFromPage: vi.fn(() => "sideways-cardigan"),
    resolvePatternSystemForEntitlement: vi.fn(() => "sideways-cardigan"),
  };
});

import {
  createCustomPatternProject,
  updateCustomPatternProject,
} from "./customPatternProjectClient";
import { resolveSleevelessUserAccess } from "./sleevelessPatternSystemAccessClient";

function titleRoot(title: string): ParentNode {
  return {
    querySelector(sel: string) {
      if (sel === "#sl-edit-title") return { value: title } as HTMLInputElement;
      return null;
    },
    querySelectorAll: () => [],
  } as unknown as ParentNode;
}

function savedProject(
  id: string,
  name: string,
  pattern: SleevelessPatternRecord,
  customOverrides: Record<string, unknown> = {},
): CustomPatternProject {
  return {
    id,
    name,
    family: "sleeveless",
    source: "express",
    notes: "",
    pattern,
    customOverrides,
    createdAt: "t1",
    updatedAt: "t2",
    version: 1,
  };
}

describe("Sideways Summary/Edit Save Changes persistence", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
    clearActiveCustomPatternProjectId();
    vi.clearAllMocks();
    vi.mocked(resolveSleevelessUserAccess).mockResolvedValue(
      testAccess({ loggedIn: true, hasSystemAccess: true, freeClaimed: false }),
    );
  });

  it("creates a My Patterns record for a newly generated Sideways Pullover and keeps the custom title", async () => {
    const draft = saveCurrentPattern({
      style: withSidewaysCardiganConstructionAuthored(
        { patternMode: "express" },
        "cuff-up",
        "pullover",
      ),
      patternProject: { title: "Sue's V-neck pullover", notes: "", titleCustomized: true },
    });
    vi.mocked(createCustomPatternProject).mockImplementation(async (payload) => ({
      ok: true,
      project: savedProject("proj-sw-new", payload.name, payload.pattern, payload.customOverrides ?? {}),
    }));

    const res = await persistSidewaysCardiganSummaryProject(titleRoot("Sue's V-neck pullover"));

    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error(res.error);
    expect(createCustomPatternProject).toHaveBeenCalledTimes(1);
    expect(updateCustomPatternProject).not.toHaveBeenCalled();
    const payload = vi.mocked(createCustomPatternProject).mock.calls[0]?.[0] as
      | SaveCustomPatternProjectRequest
      | undefined;
    expect(payload?.name).toBe("Sue's V-neck pullover");
    expect(payload?.pattern).toEqual(expect.objectContaining({ id: draft.id }));
    expect(payload?.pattern.style?.construction).toBe("sideways-cardigan");
    expect(payload?.pattern.style?.garmentStyle).toBe("pullover");
    expect(readActiveCustomPatternProjectId()).toBe("proj-sw-new");
    expect(res.href).toContain("/patterns/sideways-cardigan/pattern/");
    expect(res.href).toContain("project=proj-sw-new");
  });

  it("creates a My Patterns record for a newly generated Sideways Cardigan titled Sue's Sideways V-Neck", async () => {
    const draft = saveCurrentPattern({
      style: withSidewaysCardiganConstructionAuthored(
        { patternMode: "express" },
        "cuff-up",
        "cardigan",
      ),
      patternProject: { title: "Sue's Sideways V-Neck", notes: "", titleCustomized: true },
    });
    vi.mocked(createCustomPatternProject).mockImplementation(async (payload) => ({
      ok: true,
      project: savedProject("proj-sw-cardigan", payload.name, payload.pattern, payload.customOverrides ?? {}),
    }));

    const res = await persistSidewaysCardiganSummaryProject(titleRoot("Sue's Sideways V-Neck"));

    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error(res.error);
    expect(createCustomPatternProject).toHaveBeenCalledTimes(1);
    expect(updateCustomPatternProject).not.toHaveBeenCalled();
    const payload = vi.mocked(createCustomPatternProject).mock.calls[0]?.[0] as
      | SaveCustomPatternProjectRequest
      | undefined;
    expect(payload?.name).toBe("Sue's Sideways V-Neck");
    expect(payload?.pattern).toEqual(expect.objectContaining({ id: draft.id }));
    expect(payload?.pattern.style?.garmentStyle).toBe("cardigan");
    expect(readActiveCustomPatternProjectId()).toBe("proj-sw-cardigan");
    expect(res.href).toContain("/patterns/sideways-cardigan/pattern/");
    expect(res.href).toContain("project=proj-sw-cardigan");
  });

  it("updates the linked Sideways project instead of creating a second record", async () => {
    saveCurrentPattern({
      style: withSidewaysCardiganConstructionAuthored(
        { patternMode: "express" },
        "cuff-up",
        "cardigan",
      ),
      patternProject: { title: "Sue's V-neck cardigan", notes: "", titleCustomized: true },
    });
    writeActiveCustomPatternProjectId("proj-sw-existing", "Sue's V-neck cardigan");
    vi.mocked(updateCustomPatternProject).mockImplementation(async (payload) => ({
      ok: true,
      project: savedProject(payload.id, payload.name, payload.pattern, payload.customOverrides ?? {}),
    }));

    const res = await persistSidewaysCardiganSummaryProject(titleRoot("Sue's V-neck cardigan"));

    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error(res.error);
    expect(updateCustomPatternProject).toHaveBeenCalledTimes(1);
    expect(createCustomPatternProject).not.toHaveBeenCalled();
    expect(res.href).toContain("project=proj-sw-existing");
  });
});

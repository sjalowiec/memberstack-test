/**
 * Save Changes (Edit Pattern apply) must reach smartSave + payload build for both constructions.
 * Guards the shared applyChanges tail: runSaveCustomPatternFromWorkspace → smartSave → payload.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { stubLocalStorage } from "./test/stubLocalStorage";
import {
  clearActiveCustomPatternProjectId,
  writeActiveCustomPatternProjectId,
} from "./customPatternProjectActiveId";
import { runSaveCustomPatternFromWorkspace } from "./customPatternEditingBannerActions";
import {
  CONSTRUCTION_AUTHORED_KEY,
  CONSTRUCTION_FAMILY_OVERRIDE_KEY,
  DROP_SHOULDER_CONSTRUCTION,
} from "./patternConstructionIdentity";
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
    resolvePatternSystemFromPage: vi.fn(() => "sleeveless"),
    resolvePatternSystemForEntitlement: vi.fn(() => "sleeveless"),
  };
});

import {
  createCustomPatternProject,
  updateCustomPatternProject,
} from "./customPatternProjectClient";
import { resolveSleevelessUserAccess } from "./sleevelessPatternSystemAccessClient";
import { resolvePatternSystemForEntitlement } from "./patternSystemId";

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

describe("Edit Pattern Save Changes path (applyChanges → smartSave → payload)", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
    clearActiveCustomPatternProjectId();
    vi.clearAllMocks();
    vi.mocked(resolveSleevelessUserAccess).mockResolvedValue(
      testAccess({ loggedIn: true, hasSystemAccess: true, freeClaimed: false }),
    );
  });

  it("Sleeveless Save Changes reaches smartSave and builds a create payload", async () => {
    vi.mocked(resolvePatternSystemForEntitlement).mockReturnValue("sleeveless");
    const draft = saveCurrentPattern({
      style: {
        patternMode: "express",
        garmentStyle: "pullover",
        neckline: "round",
        bodyShape: "straight",
      },
      patternProject: { title: "Women's Vest", notes: "", titleCustomized: true },
    });
    vi.mocked(createCustomPatternProject).mockImplementation(async (payload) => ({
      ok: true,
      project: savedProject("proj-sl-new", payload.name, payload.pattern, payload.customOverrides ?? {}),
    }));

    const res = await runSaveCustomPatternFromWorkspace(titleRoot("Women's Vest"), {
      skipPreSavePrepare: true,
    });

    expect(res.ok).toBe(true);
    expect(createCustomPatternProject).toHaveBeenCalledTimes(1);
    expect(updateCustomPatternProject).not.toHaveBeenCalled();
    const payload = vi.mocked(createCustomPatternProject).mock.calls[0]?.[0] as
      | SaveCustomPatternProjectRequest
      | undefined;
    expect(payload?.name).toBe("Women's Vest");
    expect(payload?.pattern).toEqual(expect.objectContaining({ id: draft.id }));
    expect(payload?.pattern.style?.construction).not.toBe(DROP_SHOULDER_CONSTRUCTION);
    expect(payload?.customOverrides?.[CONSTRUCTION_FAMILY_OVERRIDE_KEY]).toBeUndefined();
  });

  it("Drop Shoulder Save Changes reaches smartSave and builds an update payload", async () => {
    vi.mocked(resolvePatternSystemForEntitlement).mockReturnValue("drop-shoulder");
    const draft = saveCurrentPattern({
      style: {
        patternMode: "express",
        garmentStyle: "pullover",
        neckline: "round",
        bodyShape: "straight",
        construction: DROP_SHOULDER_CONSTRUCTION,
        [CONSTRUCTION_AUTHORED_KEY]: DROP_SHOULDER_CONSTRUCTION,
        sleeveLength: "long",
      },
      patternProject: { title: "Drop Shoulder Pullover", notes: "", titleCustomized: true },
    });
    writeActiveCustomPatternProjectId("proj-ds", "Drop Shoulder Pullover");
    vi.mocked(updateCustomPatternProject).mockImplementation(async (payload) => ({
      ok: true,
      project: savedProject(payload.id, payload.name, payload.pattern, payload.customOverrides ?? {}),
    }));

    const res = await runSaveCustomPatternFromWorkspace(titleRoot("Drop Shoulder Pullover"), {
      skipPreSavePrepare: true,
      activeProjectId: "proj-ds",
    });

    expect(res.ok).toBe(true);
    expect(updateCustomPatternProject).toHaveBeenCalledTimes(1);
    expect(createCustomPatternProject).not.toHaveBeenCalled();
    const payload = vi.mocked(updateCustomPatternProject).mock.calls[0]?.[0];
    expect(payload?.id).toBe("proj-ds");
    expect(payload?.name).toBe("Drop Shoulder Pullover");
    expect(payload?.pattern).toEqual(expect.objectContaining({ id: draft.id }));
    expect(payload?.pattern.style?.construction).toBe(DROP_SHOULDER_CONSTRUCTION);
    expect(payload?.pattern.style?.[CONSTRUCTION_AUTHORED_KEY]).toBe(DROP_SHOULDER_CONSTRUCTION);
    expect(payload?.customOverrides?.[CONSTRUCTION_FAMILY_OVERRIDE_KEY]).toBe(
      DROP_SHOULDER_CONSTRUCTION,
    );
  });
});

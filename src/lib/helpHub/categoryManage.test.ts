import { describe, expect, it } from "vitest";
import { helpHubJsonSeedCategories } from "./categories";
import {
  createHelpHubCategory,
  deleteHelpHubCategory,
  helpHubCategoryKeyFromLabel,
  mergeSeededHelpHubCategories,
  renameHelpHubCategory,
  reorderHelpHubCategories,
  retireHelpHubCategory,
} from "./categoryManage";
import {
  HELP_HUB_LK150_KEY,
  HELP_HUB_RETIRED_LOOK_RIGHT_KEY,
  HELP_HUB_SOMETHING_NOT_WORKING_KEY,
  HelpHubCategoryError,
} from "./categoryTypes";

const seed = helpHubJsonSeedCategories();

describe("Help Hub category key generation", () => {
  it("creates a stable kebab-case key from a label", () => {
    expect(helpHubCategoryKeyFromLabel("Gauge & Swatching")).toBe("gauge-swatching");
    expect(helpHubCategoryKeyFromLabel("LK150")).toBe("lk150");
    expect(helpHubCategoryKeyFromLabel("Something’s Not Working")).toBe("something-s-not-working");
  });
});

describe("Help Hub managed categories", () => {
  it("creates a category with a new id and generated key", () => {
    const { categories, created } = createHelpHubCategory(seed, { label: "Ribber Basics" });
    expect(created.key).toBe("ribber-basics");
    expect(created.id).toBeGreaterThan(9);
    expect(created.retiredAt).toBeNull();
    expect(categories.find((row) => row.id === 1)?.key).toBe("machine-not-working");
    expect(categories.find((row) => row.id === created.id)?.label).toBe("Ribber Basics");
  });

  it("renames the display label without changing the stored key or id", () => {
    const next = renameHelpHubCategory(seed, 8, "Swatches & Gauge");
    const gauge = next.find((row) => row.id === 8);
    expect(gauge?.key).toBe("gauge-swatching");
    expect(gauge?.id).toBe(8);
    expect(gauge?.label).toBe("Swatches & Gauge");
  });

  it("reorders categories without changing ids or keys", () => {
    const activeIds = seed.filter((row) => !row.retiredAt).map((row) => row.id);
    const retired = seed.filter((row) => row.retiredAt);
    const swapped = [activeIds[activeIds.length - 1]!, ...activeIds.slice(0, -1), ...retired.map((row) => row.id)];
    const next = reorderHelpHubCategories(seed, swapped);
    expect(next.map((row) => row.id).sort((a, b) => a - b)).toEqual(
      seed.map((row) => row.id).sort((a, b) => a - b),
    );
    expect(next.find((row) => row.key === HELP_HUB_LK150_KEY)?.id).toBe(9);
    expect(next[0]?.id).toBe(activeIds[activeIds.length - 1]);
    expect(next[0]?.sortOrder).toBe(10);
  });

  it("blocks deletion when entries are assigned", () => {
    const tips = [{ category: "gauge-swatching" }, { category: "machines" }];
    const gauge = seed.find((row) => row.key === "gauge-swatching")!;
    expect(() => deleteHelpHubCategory(seed, tips, gauge.id)).toThrow(HelpHubCategoryError);
    try {
      deleteHelpHubCategory(seed, tips, gauge.id);
    } catch (error) {
      expect((error as HelpHubCategoryError).code).toBe("IN_USE");
    }
  });

  it("deletes an unused category", () => {
    const unused = seed.find((row) => row.key === "shaping-fit-problems")!;
    const next = deleteHelpHubCategory(seed, [{ category: "machines" }], unused.id);
    expect(next.some((row) => row.key === "shaping-fit-problems")).toBe(false);
  });

  it("reassigns entries while retiring a category and does not orphan them", () => {
    const lookRight = seed.find((row) => row.key === HELP_HUB_RETIRED_LOOK_RIGHT_KEY) ?? {
      id: 2,
      key: HELP_HUB_RETIRED_LOOK_RIGHT_KEY,
      label: "My Knitting Doesn’t Look Right",
      sortOrder: 20,
      retiredAt: null,
    };
    const categories = seed.map((row) =>
      row.key === HELP_HUB_RETIRED_LOOK_RIGHT_KEY ? { ...row, retiredAt: null } : row,
    );
    const tips = [
      { id: 1001, slug: "messy-fabric", status: "published", category: lookRight.key, question: "Why?" },
      { id: 1002, slug: "cut-and-sew-shaping", status: "published", category: "edges-finishing-assembly" },
    ];
    expect(() =>
      retireHelpHubCategory(categories, tips, { id: lookRight.id, replacementKey: HELP_HUB_SOMETHING_NOT_WORKING_KEY }),
    ).toThrowError(/Confirm reassignment/);

    const result = retireHelpHubCategory(categories, tips, {
      id: lookRight.id,
      replacementKey: HELP_HUB_SOMETHING_NOT_WORKING_KEY,
      confirm: true,
    });
    expect(result.reassigned).toBe(1);
    expect(result.tips[0]?.category).toBe(HELP_HUB_SOMETHING_NOT_WORKING_KEY);
    expect(result.tips[0]?.id).toBe(1001);
    expect(result.tips[0]?.slug).toBe("messy-fabric");
    expect(result.tips[0]?.status).toBe("published");
    expect(result.tips.some((tip) => tip.category === HELP_HUB_RETIRED_LOOK_RIGHT_KEY)).toBe(false);
    expect(result.retired.retiredAt).toBeTruthy();
    expect(result.retired.key).toBe(HELP_HUB_RETIRED_LOOK_RIGHT_KEY);
  });

  it("keeps JSON seed keys and IDs when merging into an existing catalog", () => {
    const existing = seed.filter((row) => row.key !== HELP_HUB_LK150_KEY).map((row) => ({
      ...row,
      retiredAt: row.key === HELP_HUB_RETIRED_LOOK_RIGHT_KEY ? null : row.retiredAt,
    }));
    const merged = mergeSeededHelpHubCategories(existing, seed);
    expect(merged.find((row) => row.key === "machine-not-working")?.id).toBe(1);
    expect(merged.find((row) => row.key === "machines")?.id).toBe(7);
    expect(merged.find((row) => row.key === "gauge-swatching")?.id).toBe(8);
    expect(merged.find((row) => row.key === HELP_HUB_LK150_KEY)?.label).toBe("LK150");
    expect(merged.find((row) => row.key === HELP_HUB_RETIRED_LOOK_RIGHT_KEY)?.retiredAt).toBeTruthy();
  });
});

import { describe, expect, it } from "vitest";
import {
  BASIC_SOCK_PATTERN_NAME,
  clearSockDraftStorage,
  coerceSockDraft,
  createEmptySockDraft,
  readSockDraft,
  SOCK_DRAFT_STORAGE_KEY,
  SOCK_DRAFT_VERSION,
  SOCK_PATTERN_FAMILY_NAME,
  SOCK_PATTERN_SYSTEM_DISPLAY_NAME,
  syncSockDraft,
  writeSockDraft,
} from "./sockDraft";

function memoryStorage(initial: Record<string, string> = {}) {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
    raw: map,
  };
}

describe("sockDraft contract", () => {
  it("creates a Hat-style independent socks draft, not a sweater record", () => {
    const draft = createEmptySockDraft();
    expect(draft.version).toBe(SOCK_DRAFT_VERSION);
    expect(draft.patternType).toBe("socks");
    expect(draft.patternSystem).toBe("socks");
    expect(SOCK_PATTERN_SYSTEM_DISPLAY_NAME).toBe("Socks");
    expect(BASIC_SOCK_PATTERN_NAME).toBe("Basic Socks");
    expect(draft.patternProject?.title).toBe("Socks");
    expect(draft.unit).toBe("inches");
    expect(draft.sizeSel).toBe("");
    expect(draft.constructionDirection).toBe("");
    expect(draft.footCircumference).toBe("");
    expect(draft.footLength).toBe("");
    expect(draft.legCircumference).toBe("");
    expect(draft.legLength).toBe("");
    expect(draft.gaugeSlots).toEqual({
      inches: { stitch: "", row: "" },
      cm: { stitch: "", row: "" },
    });
    expect(draft.availableNeedles).toBe("");
    expect(draft).not.toHaveProperty("patternMode");
    expect(draft).not.toHaveProperty("who");
    expect(draft).not.toHaveProperty("heelDepth");
    expect(draft).not.toHaveProperty("toeDepth");
    expect(draft).not.toHaveProperty("ankleLength");
    expect(draft).not.toHaveProperty("ankleStraightLength");
    expect(draft).not.toHaveProperty("ankleStraightRows");
    expect(draft).not.toHaveProperty("fancy");
    expect(draft).not.toHaveProperty("swan");
  });

  it("rejects blobs from other pattern systems", () => {
    expect(coerceSockDraft({ patternType: "hat", patternSystem: "hat" })).toBeNull();
    expect(coerceSockDraft({ patternType: "sock", patternSystem: "hat" })).toBeNull();
    expect(coerceSockDraft(null)).toBeNull();
    expect(coerceSockDraft("nope")).toBeNull();
  });

  it("coerces unknown construction direction and missing slots", () => {
    const draft = coerceSockDraft({
      patternType: "sock",
      patternSystem: "socks",
      unit: "cm",
      sizeSel: "woman_med",
      constructionDirection: "magic-loop",
      footCircumference: "8.5",
      gaugeSlots: { inches: { stitch: 28 } },
    });
    expect(draft).not.toBeNull();
    expect(draft!.unit).toBe("cm");
    expect(draft!.constructionDirection).toBe("");
    expect(draft!.footCircumference).toBe("8.5");
    expect(draft!.gaugeSlots.inches.stitch).toBe("28");
    expect(draft!.gaugeSlots.inches.row).toBe("");
    expect(draft!.gaugeSlots.cm).toEqual({ stitch: "", row: "" });
  });

  it("round-trips through kbm_socks_draft", () => {
    const storage = memoryStorage();
    const written = syncSockDraft(
      {
        unit: "inches",
        sizeSel: "woman_med",
        constructionDirection: "toe-up",
        footCircumference: "8.5",
        footLength: "9",
        legCircumference: "8.5",
        legLength: "4.5",
        gaugeSlots: {
          inches: { stitch: "28", row: "40" },
          cm: { stitch: "", row: "" },
        },
        availableNeedles: "150",
      },
      storage,
    );
    expect(written.patternType).toBe("socks");
    expect(written.patternSystem).toBe("socks");
    expect(storage.getItem(SOCK_DRAFT_STORAGE_KEY)).toContain("woman_med");

    const read = readSockDraft(storage);
    expect(read?.constructionDirection).toBe("toe-up");
    expect(read?.gaugeSlots.inches).toEqual({ stitch: "28", row: "40" });
    expect(read?.availableNeedles).toBe("150");
    expect(read?.patternProject?.title).toBe(SOCK_PATTERN_FAMILY_NAME);

    clearSockDraftStorage(storage);
    expect(readSockDraft(storage)).toBeNull();
  });

  it("writeSockDraft always stamps patternType socks and patternSystem socks", () => {
    const storage = memoryStorage();
    writeSockDraft(
      createEmptySockDraft({
        sizeSel: "child",
        constructionDirection: "cuff-to-toe",
      }),
      storage,
    );
    const parsed = JSON.parse(storage.getItem(SOCK_DRAFT_STORAGE_KEY)!);
    expect(parsed.patternType).toBe("socks");
    expect(parsed.patternSystem).toBe("socks");
    expect(parsed.version).toBe(1);
    expect(parsed.availableNeedles).toBe("");
    expect(parsed.patternProject?.title).toBe("Socks");
  });

  it("round-trips a customized pattern name through kbm_socks_draft", () => {
    const storage = memoryStorage();
    writeSockDraft(
      createEmptySockDraft({
        sizeSel: "woman_med",
        constructionDirection: "cuff-to-toe",
        patternProject: { title: "Aubrie's Hiking Socks", notes: "Merino", titleCustomized: true },
      }),
      storage,
    );
    const read = readSockDraft(storage);
    expect(read?.patternProject).toEqual({
      title: "Aubrie's Hiking Socks",
      notes: "Merino",
      titleCustomized: true,
    });
  });
});

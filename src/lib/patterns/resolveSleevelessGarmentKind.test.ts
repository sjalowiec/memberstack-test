import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveSleevelessGarmentKind } from "./resolveSleevelessGarmentKind";

describe("resolveSleevelessGarmentKind", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("wizard cardigan wins over stale pullover sources", () => {
    expect(
      resolveSleevelessGarmentKind({
        wizardGarmentType: "cardigan",
        canonicalStyle: { garmentStyle: "pullover", frontStyle: "closed" },
        patternBuilderStyle: { garmentStyle: "pullover", frontStyle: "closed" },
      }),
    ).toMatchObject({
      garmentStyle: "cardigan",
      frontStyle: "open",
      isCardigan: true,
      source: "wizard:cardigan",
    });
  });

  it("wizard pullover wins over canonical and patternBuilder cardigan", () => {
    expect(
      resolveSleevelessGarmentKind({
        wizardGarmentType: "pullover",
        canonicalStyle: { garmentStyle: "cardigan", frontStyle: "open" },
        patternBuilderStyle: { garmentStyle: "cardigan", frontStyle: "open" },
      }),
    ).toMatchObject({
      garmentStyle: "pullover",
      frontStyle: "closed",
      isCardigan: false,
      source: "wizard:pullover",
    });
  });

  it("express front open returns cardigan when wizard unset", () => {
    expect(
      resolveSleevelessGarmentKind({
        expressValues: { front: "open" },
      }),
    ).toMatchObject({
      garmentStyle: "cardigan",
      source: "express:cardigan",
    });
  });

  it("express style straight-cardigan returns cardigan when wizard unset", () => {
    expect(
      resolveSleevelessGarmentKind({
        expressValues: { style: "straight-cardigan" },
      }),
    ).toMatchObject({
      garmentStyle: "cardigan",
      source: "express:cardigan",
    });
  });

  it("patternBuilder cardigan returns cardigan when wizard and express are neutral", () => {
    expect(
      resolveSleevelessGarmentKind({
        patternBuilderStyle: { garmentStyle: "cardigan", frontStyle: "open" },
        canonicalStyle: { garmentStyle: "pullover", frontStyle: "closed" },
      }),
    ).toMatchObject({
      garmentStyle: "cardigan",
      source: "patternBuilder:cardigan",
    });
  });

  it("canonical cardigan with stale patternBuilder pullover returns cardigan", () => {
    expect(
      resolveSleevelessGarmentKind({
        canonicalStyle: { garmentStyle: "cardigan", frontStyle: "open" },
        patternBuilderStyle: { garmentStyle: "pullover", frontStyle: "closed" },
      }),
    ).toMatchObject({
      garmentStyle: "cardigan",
      source: "canonical:cardigan",
    });
  });

  it("returns pullover when no cardigan indicators are present", () => {
    expect(
      resolveSleevelessGarmentKind({
        canonicalStyle: { garmentStyle: "pullover", frontStyle: "closed" },
        patternBuilderStyle: { garmentStyle: "pullover", frontStyle: "closed" },
        expressValues: { front: "closed", style: "straight-pullover" },
      }),
    ).toMatchObject({
      garmentStyle: "pullover",
      frontStyle: "closed",
      isCardigan: false,
      source: "default:pullover",
    });
  });

  it("logs warning for stale localStorage pullover vs express cardigan but wizard pullover still wins", () => {
    const resolved = resolveSleevelessGarmentKind({
      wizardGarmentType: "pullover",
      expressValues: { front: "open", style: "straight-cardigan" },
      canonicalStyle: { garmentStyle: "cardigan", frontStyle: "open" },
    });
    expect(resolved).toMatchObject({
      garmentStyle: "pullover",
      source: "wizard:pullover",
    });
    expect(warnSpy).toHaveBeenCalled();
    expect(String(warnSpy.mock.calls[0]?.[0])).toContain("stale-state conflict");
  });
});

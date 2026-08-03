import { describe, expect, it } from "vitest";
import { applyFitEaseUnitLabels, FIT_EASE_LABEL_ATTR } from "./fitEaseUnitLabels";

/**
 * Node-safe DOM stub (the suite runs without jsdom): the applier only needs querySelectorAll +
 * getAttribute + a writable textContent, so a tiny fake element/root is enough to prove the Fit
 * card ease chips flip between inch and centimeter copy as the builder unit changes.
 */
type FakeChip = { readonly choice: string | null; textContent: string | null };

function chip(choice: string | null, initial = ""): FakeChip {
  return {
    choice,
    textContent: initial,
    getAttribute(name: string): string | null {
      return name === FIT_EASE_LABEL_ATTR ? this.choice : null;
    },
  } as unknown as FakeChip & { getAttribute(name: string): string | null };
}

function fakeRoot(chips: FakeChip[]) {
  return {
    querySelectorAll(selector: string): ArrayLike<FakeChip> {
      expect(selector).toBe(`[${FIT_EASE_LABEL_ATTR}]`);
      return chips;
    },
  };
}

describe("applyFitEaseUnitLabels", () => {
  it("renders inch ease copy when inches are active", () => {
    const chips = [chip("close"), chip("standard"), chip("relaxed")];
    const updated = applyFitEaseUnitLabels(fakeRoot(chips), "in");
    expect(updated).toBe(3);
    expect(chips.map((c) => c.textContent)).toEqual([
      "Approx. +1\u2033 ease",
      "Approx. +3\u2033 ease",
      "Approx. +5\u2033 ease",
    ]);
  });

  it("renders centimeter ease copy when centimeters are active", () => {
    const chips = [chip("close"), chip("standard"), chip("relaxed")];
    applyFitEaseUnitLabels(fakeRoot(chips), "cm");
    expect(chips.map((c) => c.textContent)).toEqual([
      "Approx. +2.5 cm ease",
      "Approx. +7.5 cm ease",
      "Approx. +12.5 cm ease",
    ]);
  });

  it("updates the same chips when the builder unit changes (in -> cm -> in)", () => {
    const chips = [chip("close", "Approx. +1\u2033 ease")];
    applyFitEaseUnitLabels(fakeRoot(chips), "cm");
    expect(chips[0].textContent).toBe("Approx. +2.5 cm ease");
    applyFitEaseUnitLabels(fakeRoot(chips), "in");
    expect(chips[0].textContent).toBe("Approx. +1\u2033 ease");
  });

  it("ignores chips with an unknown fit choice", () => {
    const chips = [chip("close"), chip("bogus")];
    const updated = applyFitEaseUnitLabels(fakeRoot(chips), "cm");
    expect(updated).toBe(1);
    expect(chips[0].textContent).toBe("Approx. +2.5 cm ease");
    expect(chips[1].textContent).toBe("");
  });
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  validateSleevelessPatternInputs,
  type SleevelessCustomBuildMeasurements,
} from "./sleevelessPatternValidation";
import { splitPatternValidationMessages } from "./sleevelessPatternValidationUi";

/** Representative misses-size custom-build measurements (all rules pass). */
function validMeasurements(
  overrides: SleevelessCustomBuildMeasurements = {},
): SleevelessCustomBuildMeasurements {
  return {
    audience: "misses",
    finishedBustOrChest: 41.5,
    finishedLength: 23.5,
    armholeDepth: 8,
    hemDepth: 2,
    shoulderWidth: 13.25,
    finishedNeckOpeningWidth: 8,
    neckDepth: 5,
    ...overrides,
  };
}

function messageIds(input: SleevelessCustomBuildMeasurements): string[] {
  return validateSleevelessPatternInputs(input).map((m) => m.id);
}

function messagesById(input: SleevelessCustomBuildMeasurements, id: string) {
  return validateSleevelessPatternInputs(input).filter((m) => m.id === id);
}

describe("validateSleevelessPatternInputs", () => {
  it("returns no messages for valid measurements", () => {
    expect(validateSleevelessPatternInputs(validMeasurements())).toEqual([]);
  });

  it("never throws on empty or partial input", () => {
    expect(() => validateSleevelessPatternInputs({})).not.toThrow();
    expect(() => validateSleevelessPatternInputs({ armholeDepth: "bad" })).not.toThrow();
  });

  it("holds the round-neck vs armhole-depth constraint in measurement validation, not the renderer", () => {
    const ids = messageIds(validMeasurements({ neckline: "round", neckDepth: 9, armholeDepth: 8 }));
    expect(ids).toContain("neck-depth-exceeds-armhole-depth");
    const svgRenderer = readFileSync(resolve("src/lib/patterns/sleevelessFrontStsRowsDiagramSvg.ts"), "utf8");
    expect(svgRenderer).not.toMatch(/neck-depth-exceeds-armhole-depth/);
    expect(svgRenderer).not.toMatch(/neckStartY > armholeStartY/);
  });

  it("flags neck depth deeper than armhole depth for round neck", () => {
    const input = validMeasurements({ neckline: "round", neckDepth: 9, armholeDepth: 8 });
    const ids = messageIds(input);
    expect(ids).toContain("neck-depth-exceeds-armhole-depth");
    const [msg] = messagesById(input, "neck-depth-exceeds-armhole-depth");
    expect(msg.severity).toBe("error");
    expect(msg.field).toBe("neckDepth");
  });

  it("accepts a V-neck deeper than the armhole (7.25\" armhole, 10\" neck)", () => {
    const input = validMeasurements({
      neckline: "v-neck",
      armholeDepth: 7.25,
      neckDepth: 10,
    });
    const messages = validateSleevelessPatternInputs(input);
    expect(messages.map((m) => m.id)).not.toContain("neck-depth-exceeds-armhole-depth");
    const { errors } = splitPatternValidationMessages(messages);
    expect(errors).toEqual([]);
  });

  it("accepts the same deep V-neck when neckline is stored as v", () => {
    const ids = messageIds(
      validMeasurements({ neckline: "v", armholeDepth: 7.25, neckDepth: 10 }),
    );
    expect(ids).not.toContain("neck-depth-exceeds-armhole-depth");
  });

  it("still flags 7.25\" armhole with 10\" neck for round neck", () => {
    const messages = validateSleevelessPatternInputs(
      validMeasurements({ neckline: "round", armholeDepth: 7.25, neckDepth: 10 }),
    );
    expect(messages.map((m) => m.id)).toContain("neck-depth-exceeds-armhole-depth");
    expect(splitPatternValidationMessages(messages).errors.length).toBeGreaterThan(0);
  });

  it("still flags neck depth deeper than armhole depth when neckline is omitted", () => {
    expect(messageIds(validMeasurements({ neckDepth: 9, armholeDepth: 8 }))).toContain(
      "neck-depth-exceeds-armhole-depth",
    );
  });

  it("flags finished length too short for armhole and hem", () => {
    const ids = messageIds(
      validMeasurements({ finishedLength: 10, armholeDepth: 8, hemDepth: 2 }),
    );
    expect(ids).toContain("finished-length-too-short");
  });

  it("flags hem depth too large for finished length", () => {
    const ids = messageIds(
      validMeasurements({ finishedLength: 20, armholeDepth: 8, hemDepth: 13 }),
    );
    expect(ids).toContain("hem-depth-too-deep");
  });

  it("does not flag shoulder width within flat finished bust width", () => {
    const ids = messageIds(
      validMeasurements({ finishedBustOrChest: 22, shoulderWidth: 12 }),
    );
    expect(ids).not.toContain("shoulder-width-exceeds-bust");
  });

  it("flags shoulder width wider than flat finished bust width", () => {
    const ids = messageIds(
      validMeasurements({ finishedBustOrChest: 22, shoulderWidth: 23 }),
    );
    expect(ids).toContain("shoulder-width-exceeds-bust");
  });

  it("uses chestBust override as flat finished bust width", () => {
    const ids = messageIds(
      validMeasurements({ finishedBustOrChest: 50, chestBust: 22, shoulderWidth: 12 }),
    );
    expect(ids).not.toContain("shoulder-width-exceeds-bust");
    expect(
      messageIds(
        validMeasurements({ finishedBustOrChest: 50, chestBust: 22, shoulderWidth: 23 }),
      ),
    ).toContain("shoulder-width-exceeds-bust");
  });

  it("flags shoulder width not greater than neck opening", () => {
    const ids = messageIds(
      validMeasurements({ shoulderWidth: 8, finishedNeckOpeningWidth: 8 }),
    );
    expect(ids).toContain("shoulder-width-less-than-neck-opening");
  });

  it("flags neck opening wider than shoulder width", () => {
    const ids = messageIds(
      validMeasurements({ shoulderWidth: 10, finishedNeckOpeningWidth: 11 }),
    );
    expect(ids).toContain("neck-opening-exceeds-shoulder-width");
  });

  it("flags armhole depth outside audience range", () => {
    expect(messageIds(validMeasurements({ audience: "baby", armholeDepth: 1 }))).toContain(
      "armhole-depth-out-of-range",
    );
    expect(messageIds(validMeasurements({ audience: "baby", armholeDepth: 7 }))).toContain(
      "armhole-depth-out-of-range",
    );
    expect(messageIds(validMeasurements({ audience: "kids", armholeDepth: 3 }))).toContain(
      "armhole-depth-out-of-range",
    );
    expect(messageIds(validMeasurements({ audience: "misses", armholeDepth: 5 }))).toContain(
      "armhole-depth-out-of-range",
    );
    expect(messageIds(validMeasurements({ audience: "men", armholeDepth: 6 }))).toContain(
      "armhole-depth-out-of-range",
    );
    expect(messageIds(validMeasurements({ audience: "men", armholeDepth: 17 }))).toContain(
      "armhole-depth-out-of-range",
    );
  });

  it("allows in-range armhole depth for each audience", () => {
    expect(messageIds(validMeasurements({ audience: "baby", armholeDepth: 4 }))).not.toContain(
      "armhole-depth-out-of-range",
    );
    expect(messageIds(validMeasurements({ audience: "kids", armholeDepth: 6 }))).not.toContain(
      "armhole-depth-out-of-range",
    );
    expect(messageIds(validMeasurements({ audience: "misses", armholeDepth: 10 }))).not.toContain(
      "armhole-depth-out-of-range",
    );
    expect(messageIds(validMeasurements({ audience: "men", armholeDepth: 12 }))).not.toContain(
      "armhole-depth-out-of-range",
    );
  });

  it("skips armhole range check when audience is missing or unknown", () => {
    expect(messageIds(validMeasurements({ audience: undefined, armholeDepth: 1 }))).not.toContain(
      "armhole-depth-out-of-range",
    );
    expect(messageIds(validMeasurements({ audience: "", armholeDepth: 99 }))).not.toContain(
      "armhole-depth-out-of-range",
    );
  });

  it("warns when hem depth is zero", () => {
    const msgs = messagesById(validMeasurements({ hemDepth: 0 }), "hem-depth-zero");
    expect(msgs).toHaveLength(1);
    expect(msgs[0]?.severity).toBe("warning");
    expect(msgs[0]?.message).toBe("Hem depth is 0, so the pattern will not include a hem band.");
  });

  it("warns for unusually narrow shoulder width", () => {
    const ids = messageIds(validMeasurements({ finishedBustOrChest: 40, shoulderWidth: 2 }));
    expect(ids).toContain("shoulder-width-unusually-narrow");
  });

  it("warns for unusually wide shoulder width", () => {
    const ids = messageIds(validMeasurements({ finishedBustOrChest: 20, shoulderWidth: 15 }));
    expect(ids).toContain("shoulder-width-unusually-wide");
  });

  it("warns for unusually wide neck opening", () => {
    const ids = messageIds(
      validMeasurements({ shoulderWidth: 10, finishedNeckOpeningWidth: 9 }),
    );
    expect(ids).toContain("neck-opening-unusually-wide");
  });

  it("warns for unusually deep neck depth without exceeding armhole", () => {
    const ids = messageIds(validMeasurements({ neckDepth: 7, armholeDepth: 8 }));
    expect(ids).toContain("neck-depth-unusually-deep");
    expect(ids).not.toContain("neck-depth-exceeds-armhole-depth");
  });

  it("returns multiple errors at once", () => {
    const input = validMeasurements({
      neckDepth: 10,
      armholeDepth: 8,
      finishedLength: 9,
      hemDepth: 2,
      shoulderWidth: 23,
      finishedBustOrChest: 22,
      finishedNeckOpeningWidth: 24,
    });
    const ids = messageIds(input);
    expect(ids).toEqual(
      expect.arrayContaining([
        "neck-depth-exceeds-armhole-depth",
        "finished-length-too-short",
        "hem-depth-too-deep",
        "shoulder-width-exceeds-bust",
        "neck-opening-exceeds-shoulder-width",
      ]),
    );
    expect(ids.length).toBeGreaterThanOrEqual(5);
  });

  it("skips rules when required values are missing", () => {
    expect(messageIds({ neckDepth: 10 })).not.toContain("neck-depth-exceeds-armhole-depth");
    expect(messageIds({ finishedLength: 5 })).not.toContain("finished-length-too-short");
    expect(messageIds({ shoulderWidth: 20 })).not.toContain("shoulder-width-exceeds-bust");
  });
});

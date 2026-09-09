import { describe, expect, it } from "vitest";
import {
  hasAuthoritativeSidewaysCardiganConstruction,
  SIDEWAYS_CARDIGAN_CONSTRUCTION,
  resolveSidewaysCardiganGarmentStyle,
  withSidewaysCardiganConstructionAuthored,
  withSidewaysCardiganConstructionFamily,
} from "./sidewaysCardiganConstructionIdentity";
import {
  DROP_SHOULDER_CONSTRUCTION,
  hasAuthoritativeDropShoulderConstruction,
  withDropShoulderConstructionAuthored,
} from "./patternConstructionIdentity";

describe("sideways cardigan construction identity", () => {
  it("requires an authored or family stamp, not a bare construction string", () => {
    expect(
      hasAuthoritativeSidewaysCardiganConstruction({
        construction: SIDEWAYS_CARDIGAN_CONSTRUCTION,
      }),
    ).toBe(false);
    expect(
      hasAuthoritativeSidewaysCardiganConstruction(
        withSidewaysCardiganConstructionAuthored({}),
      ),
    ).toBe(true);
    expect(
      hasAuthoritativeSidewaysCardiganConstruction(
        { construction: SIDEWAYS_CARDIGAN_CONSTRUCTION },
        withSidewaysCardiganConstructionFamily({}),
      ),
    ).toBe(true);
  });

  it("does not classify drop-shoulder drafts as sideways, or vice versa", () => {
    const sideways = withSidewaysCardiganConstructionAuthored({});
    const dropShoulder = withDropShoulderConstructionAuthored({}, "long");
    expect(hasAuthoritativeSidewaysCardiganConstruction(sideways)).toBe(true);
    expect(hasAuthoritativeDropShoulderConstruction(sideways)).toBe(false);
    expect(hasAuthoritativeDropShoulderConstruction(dropShoulder)).toBe(true);
    expect(hasAuthoritativeSidewaysCardiganConstruction(dropShoulder)).toBe(false);
    expect(sideways.construction).toBe(SIDEWAYS_CARDIGAN_CONSTRUCTION);
    expect(dropShoulder.construction).toBe(DROP_SHOULDER_CONSTRUCTION);
    expect(sideways.garmentStyle).toBe("cardigan");
    expect(sideways.neckline).toBe("v");
    expect(sideways.frontStyle).toBe("open");
  });

  it("defaults existing drafts without a garment-style choice to cardigan", () => {
    expect(resolveSidewaysCardiganGarmentStyle({})).toBe("cardigan");
    expect(resolveSidewaysCardiganGarmentStyle({ construction: SIDEWAYS_CARDIGAN_CONSTRUCTION })).toBe(
      "cardigan",
    );
    expect(withSidewaysCardiganConstructionAuthored({}).garmentStyle).toBe("cardigan");
    expect(withSidewaysCardiganConstructionAuthored({}).frontStyle).toBe("open");
  });

  it("stores pullover with the shared closed frontStyle", () => {
    const pullover = withSidewaysCardiganConstructionAuthored({}, "cuff-up", "pullover");
    expect(pullover.construction).toBe(SIDEWAYS_CARDIGAN_CONSTRUCTION);
    expect(pullover.garmentStyle).toBe("pullover");
    expect(pullover.frontStyle).toBe("closed");
    expect(resolveSidewaysCardiganGarmentStyle(pullover)).toBe("pullover");
    expect(resolveSidewaysCardiganGarmentStyle({ frontStyle: "closed" })).toBe("pullover");
  });
});

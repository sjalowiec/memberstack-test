import { describe, expect, it } from "vitest";
import { resolveSleevelessAudienceHeroImageSrc } from "./sleevelessAudienceHeroImage";

describe("resolveSleevelessAudienceHeroImageSrc", () => {
  const pulloverWoman = "/images/patterns/sleeveless/sleeveless_woman.png";
  const cardiWoman = "/images/patterns/sleeveless/sleeveless_cardi_woman.png";

  it("uses pullover assets for closed pullover style", () => {
    const pd = { style: { garmentStyle: "pullover", frontStyle: "closed" } };
    expect(resolveSleevelessAudienceHeroImageSrc(pd, "misses")).toBe(pulloverWoman);
    expect(resolveSleevelessAudienceHeroImageSrc(pd, "men")).toBe("/images/patterns/sleeveless/sleeveless_man.png");
    expect(resolveSleevelessAudienceHeroImageSrc(pd, "kids")).toBe("/images/patterns/sleeveless/sleeveless_kids.png");
    expect(resolveSleevelessAudienceHeroImageSrc(pd, "baby")).toBe("/images/patterns/sleeveless/sleeveless_baby.png");
  });

  it("uses cardigan assets when garmentStyle is cardigan", () => {
    const pd = { style: { garmentStyle: "cardigan", frontStyle: "open" } };
    expect(resolveSleevelessAudienceHeroImageSrc(pd, "misses")).toBe(cardiWoman);
    expect(resolveSleevelessAudienceHeroImageSrc(pd, "plus")).toBe(cardiWoman);
    expect(resolveSleevelessAudienceHeroImageSrc(pd, "men")).toBe("/images/patterns/sleeveless/sleeveless_cardi_man.png");
    expect(resolveSleevelessAudienceHeroImageSrc(pd, "kids")).toBe("/images/patterns/sleeveless/sleeveless_cardi_kids.png");
    expect(resolveSleevelessAudienceHeroImageSrc(pd, "baby")).toBe("/images/patterns/sleeveless/sleeveless_cardi_baby.png");
  });

  it("uses cardigan assets when frontStyle is open even if garmentStyle omitted", () => {
    const pd = { style: { frontStyle: "open" } };
    expect(resolveSleevelessAudienceHeroImageSrc(pd, "misses")).toBe(cardiWoman);
  });
});

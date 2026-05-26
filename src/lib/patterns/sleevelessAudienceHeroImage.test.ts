import { describe, expect, it } from "vitest";
import { resolveSleevelessAudienceHeroImageSrc } from "./sleevelessAudienceHeroImage";
import { SLEEVELESS_PEOPLE_HERO_BASE } from "./sleevelessPeopleHeroAssets";

const people = (name: string) => `${SLEEVELESS_PEOPLE_HERO_BASE}/${name}`;

describe("resolveSleevelessAudienceHeroImageSrc", () => {
  it("uses pullover WebP by audience and neckline", () => {
    const pd = { style: { garmentStyle: "pullover", frontStyle: "closed", neckline: "round" } };
    expect(resolveSleevelessAudienceHeroImageSrc(pd, "misses")).toBe(
      people("sleeveless-woman-pullover-round-neck.webp"),
    );
    expect(resolveSleevelessAudienceHeroImageSrc(pd, "men")).toBe(
      people("sleeveless-man-pullover-round-neck.webp"),
    );
    expect(resolveSleevelessAudienceHeroImageSrc(pd, "kids")).toBe(
      people("sleeveless-kids-pullover-round-neck.webp"),
    );
    expect(resolveSleevelessAudienceHeroImageSrc(pd, "baby")).toBe(
      people("sleeveless-baby-pullover-round-neck.webp"),
    );
  });

  it("uses V-neck pullover WebP when neckline is v-neck", () => {
    const pd = { style: { garmentStyle: "pullover", neckline: "v-neck" } };
    expect(resolveSleevelessAudienceHeroImageSrc(pd, "misses")).toBe(
      people("sleeveless-woman-pullover-v-neck.webp"),
    );
    expect(resolveSleevelessAudienceHeroImageSrc(pd, "men")).toBe(
      people("sleeveless-man-pullover-v-neck.webp"),
    );
  });

  it("normalizes round-neck and vneck neckline tokens", () => {
    expect(
      resolveSleevelessAudienceHeroImageSrc({ style: { garmentStyle: "pullover", neckline: "round-neck" } }, "men"),
    ).toBe(people("sleeveless-man-pullover-round-neck.webp"));
    expect(
      resolveSleevelessAudienceHeroImageSrc({ style: { garmentStyle: "pullover", neckline: "vneck" } }, "kids"),
    ).toBe(people("sleeveless-kids-pullover-v-neck.webp"));
  });

  it("uses cardigan WebP when garmentStyle is cardigan", () => {
    const pd = { style: { garmentStyle: "cardigan", frontStyle: "open", neckline: "round" } };
    expect(resolveSleevelessAudienceHeroImageSrc(pd, "misses")).toBe(
      people("sleeveless-woman-cardigan-roundneck.webp"),
    );
    expect(resolveSleevelessAudienceHeroImageSrc(pd, "men")).toBe(
      people("sleeveless-man-cardigan-roundneck.webp"),
    );
    expect(resolveSleevelessAudienceHeroImageSrc(pd, "baby")).toBe(
      people("sleeveless-baby-cardigan-roundneck.webp"),
    );
  });

  it("uses cardigan V-neck WebP", () => {
    const pd = { style: { garmentStyle: "cardigan", neckline: "v-neck" } };
    expect(resolveSleevelessAudienceHeroImageSrc(pd, "plus")).toBe(
      people("sleeveless-woman-cardigan-v-neck.webp"),
    );
  });

  it("uses cardigan assets when frontStyle is open even if garmentStyle omitted", () => {
    const pd = { style: { frontStyle: "open", neckline: "round" } };
    expect(resolveSleevelessAudienceHeroImageSrc(pd, "misses")).toBe(
      people("sleeveless-woman-cardigan-roundneck.webp"),
    );
  });

  it("falls back to baby pullover V-neck WebP before legacy PNG for baby V pullover", () => {
    const pd = { style: { garmentStyle: "pullover", neckline: "v-neck" } };
    expect(resolveSleevelessAudienceHeroImageSrc(pd, "baby")).toBe(
      people("sleeveless-baby-pullover-v-neck.webp"),
    );
  });
});

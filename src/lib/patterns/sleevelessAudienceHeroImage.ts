import { resolvePatternFamilyPeopleHeroImageSrc, normalizePatternPeopleHeroAudience } from "./patternPeopleHeroImage";
import { isSleevelessCardiganGarmentStyle, isSleevelessVNeckChoice } from "./sleevelessFrontDiagramSrc";
import {
  SLEEVELESS_PEOPLE_HERO_BASE,
  SLEEVELESS_PEOPLE_HERO_KNOWN_ASSETS,
  sleevelessLegacyAudienceHeroSrc,
} from "./sleevelessPeopleHeroAssets";

/**
 * Hero / picker preview image for sleeveless flows (pattern tab, Express who cards, etc.).
 * Selects illustrated WebP from `/images/patterns/sleeveless/people/` by audience, garment style,
 * and neckline; falls back to legacy PNG when that combination is not shipped.
 *
 * `audienceRaw` is typically a chart key (`misses`, `plus`, `men`, `kids`, `baby`) or Express “who” (`women`, …).
 */
export function resolveSleevelessAudienceHeroImageSrc(patternData: unknown, audienceRaw: string): string {
  const cardigan = isSleevelessCardiganGarmentStyle(patternData);
  const audience = normalizePatternPeopleHeroAudience(audienceRaw);
  const neckline = isSleevelessVNeckChoice(patternData) ? "v-neck" : "round";

  return resolvePatternFamilyPeopleHeroImageSrc({
    familyId: "sleeveless",
    peopleBasePath: SLEEVELESS_PEOPLE_HERO_BASE,
    knownAssets: SLEEVELESS_PEOPLE_HERO_KNOWN_ASSETS,
    audience,
    garment: cardigan ? "cardigan" : "pullover",
    neckline,
    legacyFallback: sleevelessLegacyAudienceHeroSrc,
  });
}

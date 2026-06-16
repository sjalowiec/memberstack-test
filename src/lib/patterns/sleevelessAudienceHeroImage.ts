import {
  resolvePatternFamilyPeopleHeroImageSrc,
  normalizePatternPeopleHeroAudience,
  type PatternPeopleHeroAudience,
} from "./patternPeopleHeroImage";
import { isSleevelessCardiganGarmentStyle, isSleevelessVNeckChoice } from "./sleevelessFrontDiagramSrc";
import {
  SLEEVELESS_PEOPLE_HERO_BASE,
  SLEEVELESS_PEOPLE_HERO_KNOWN_ASSETS,
  sleevelessLegacyAudienceHeroSrc,
} from "./sleevelessPeopleHeroAssets";

const DROP_SHOULDER_HERO_BASE = "/images/patterns/drop-shoulder/";

/**
 * Drop-shoulder people hero filenames are inconsistent (mixed `-`/`_`, trailing dashes, a stray
 * capital), so we map audience × garment × neckline explicitly to the shipped basenames rather
 * than deriving them. All 16 combinations exist under `/images/patterns/drop-shoulder/`.
 */
const DROP_SHOULDER_HERO_FILES: Record<
  PatternPeopleHeroAudience,
  Record<"pullover" | "cardigan", { round: string; "v-neck": string }>
> = {
  woman: {
    pullover: { round: "drop-woman-pullover-round.webp", "v-neck": "drop-woman-pullover_v.webp" },
    cardigan: { round: "drop-woman-cardi_round.webp", "v-neck": "drop-woman-cardi_v.webp" },
  },
  man: {
    pullover: { round: "drop-man-pullover-round.webp", "v-neck": "drop-man-pullover-v.webp" },
    cardigan: { round: "drop-man-cardigan-round-.webp", "v-neck": "drop-man-cardigan-v-.webp" },
  },
  kids: {
    pullover: { round: "drop-kids-pullover-round.webp", "v-neck": "drop-kids-pullover-v.webp" },
    cardigan: { round: "drop-kids-cardi-round.webp", "v-neck": "drop-kids-cardi-v.webp" },
  },
  baby: {
    pullover: { round: "drop-baby-pullover-round.webp", "v-neck": "drop-baby-pullover-v.webp" },
    cardigan: { round: "drop-baby-cardigan-round.webp", "v-neck": "drop-baby-cardigan-V.webp" },
  },
};

function isDropShoulderPatternData(patternData: unknown): boolean {
  if (!patternData || typeof patternData !== "object") return false;
  const style = (patternData as { style?: unknown }).style;
  if (!style || typeof style !== "object") return false;
  return (style as { construction?: unknown }).construction === "drop-shoulder";
}

function resolveDropShoulderHeroImageSrc(patternData: unknown, audienceRaw: string): string {
  const audience = normalizePatternPeopleHeroAudience(audienceRaw);
  const garment = isSleevelessCardiganGarmentStyle(patternData) ? "cardigan" : "pullover";
  const neckline = isSleevelessVNeckChoice(patternData) ? "v-neck" : "round";
  return `${DROP_SHOULDER_HERO_BASE}${DROP_SHOULDER_HERO_FILES[audience][garment][neckline]}`;
}

/**
 * Hero / picker preview image for sleeveless flows (pattern tab, Express who cards, etc.).
 * Selects illustrated WebP from `/images/patterns/sleeveless/people/` by audience, garment style,
 * and neckline; falls back to legacy PNG when that combination is not shipped.
 *
 * `audienceRaw` is typically a chart key (`misses`, `plus`, `men`, `kids`, `baby`) or Express “who” (`women`, …).
 */
export function resolveSleevelessAudienceHeroImageSrc(patternData: unknown, audienceRaw: string): string {
  if (isDropShoulderPatternData(patternData)) {
    return resolveDropShoulderHeroImageSrc(patternData, audienceRaw);
  }
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

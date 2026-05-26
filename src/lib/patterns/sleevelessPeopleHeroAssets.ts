import type { PatternPeopleHeroAudience, PatternPeopleHeroGarment } from "./patternPeopleHeroImage";

export const SLEEVELESS_PEOPLE_HERO_BASE = "/images/patterns/sleeveless/people";

/** Shipped sleeveless people hero WebP basenames (canonical hyphenated names). */
export const SLEEVELESS_PEOPLE_HERO_KNOWN_ASSETS: ReadonlySet<string> = new Set([
  "sleeveless-baby-cardigan-roundneck.webp",
  "sleeveless-baby-cardigan-v-neck.webp",
  "sleeveless-baby-pullover-round-neck.webp",
  "sleeveless-baby-pullover-v-neck.webp",
  "sleeveless-kids-cardigan-roundneck.webp",
  "sleeveless-kids-cardigan-v-neck.webp",
  "sleeveless-kids-pullover-round-neck.webp",
  "sleeveless-kids-pullover-v-neck.webp",
  "sleeveless-man-cardigan-roundneck.webp",
  "sleeveless-man-cardigan-v-neck.webp",
  "sleeveless-man-pullover-round-neck.webp",
  "sleeveless-man-pullover-v-neck.webp",
  "sleeveless-woman-cardigan-roundneck.webp",
  "sleeveless-woman-cardigan-v-neck.webp",
  "sleeveless-woman-pullover-round-neck.webp",
  "sleeveless-woman-pullover-v-neck.webp",
]);

const LEGACY_BASE = "/images/patterns/sleeveless";

/** Legacy PNG heroes (audience + garment only) when no WebP matches. */
export function sleevelessLegacyAudienceHeroSrc(
  audience: PatternPeopleHeroAudience,
  garment: PatternPeopleHeroGarment,
): string {
  if (garment === "cardigan") return `${LEGACY_BASE}/sleeveless_cardi_${audience}.png`;
  return `${LEGACY_BASE}/sleeveless_${audience}.png`;
}

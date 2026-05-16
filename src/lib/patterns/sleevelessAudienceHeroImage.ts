import { isSleevelessCardiganGarmentStyle } from "./sleevelessFrontDiagramSrc";

const BASE = "/images/patterns/sleeveless";

/**
 * Hero / picker preview image for sleeveless flows (pattern tab, Express who cards, etc.).
 * When {@link isSleevelessCardiganGarmentStyle} is true, uses `sleeveless_cardi_*.png`; otherwise existing pullover assets.
 *
 * `audienceRaw` is typically a chart key (`misses`, `plus`, `men`, `kids`, `baby`) or Express “who” (`women`, …) —
 * same normalization rules as the previous inline switch in `sleevelessPatternPageShared.ts`.
 */
export function resolveSleevelessAudienceHeroImageSrc(patternData: unknown, audienceRaw: string): string {
  const cardigan = isSleevelessCardiganGarmentStyle(patternData);
  const a = String(audienceRaw ?? "").trim().toLowerCase();

  const pullover = (slug: "woman" | "man" | "kids" | "baby") => `${BASE}/sleeveless_${slug}.png`;
  const cardi = (slug: "woman" | "man" | "kids" | "baby") => `${BASE}/sleeveless_cardi_${slug}.png`;

  if (a === "baby") return cardigan ? cardi("baby") : pullover("baby");
  if (a === "man" || a === "men" || a === "male") return cardigan ? cardi("man") : pullover("man");
  if (a === "kids" || a === "kid" || a === "children") return cardigan ? cardi("kids") : pullover("kids");
  // misses, plus, women, woman, or unknown → women’s artwork
  return cardigan ? cardi("woman") : pullover("woman");
}

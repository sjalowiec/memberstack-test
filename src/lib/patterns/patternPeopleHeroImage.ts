/**
 * Illustrated “people” hero images under `public/images/patterns/{family}/people/`.
 * Pattern families (sleeveless today; raglan, drop-shoulder, etc. later) share the same
 * audience × garment × neckline filename rules and fallback chain.
 */

export type PatternPeopleHeroAudience = "woman" | "man" | "kids" | "baby";
export type PatternPeopleHeroGarment = "pullover" | "cardigan";
export type PatternPeopleHeroNeckline = "round" | "v-neck";

export type PatternFamilyPeopleHeroConfig = {
  /** Filename prefix, e.g. `sleeveless` → `sleeveless-woman-pullover-round-neck.webp`. */
  familyId: string;
  /** Public URL base including `/people`, e.g. `/images/patterns/sleeveless/people`. */
  peopleBasePath: string;
  /** Shipped WebP basenames (used to skip missing combos before legacy PNG fallback). */
  knownAssets: ReadonlySet<string>;
  audience: PatternPeopleHeroAudience;
  garment: PatternPeopleHeroGarment;
  neckline: PatternPeopleHeroNeckline;
  legacyFallback: (audience: PatternPeopleHeroAudience, garment: PatternPeopleHeroGarment) => string;
};

/** Normalize chart / Express “who” keys to people-hero audience slugs. */
export function normalizePatternPeopleHeroAudience(audienceRaw: string): PatternPeopleHeroAudience {
  const a = String(audienceRaw ?? "").trim().toLowerCase();
  if (a === "baby") return "baby";
  if (a === "man" || a === "men" || a === "male") return "man";
  if (a === "kids" || a === "kid" || a === "children") return "kids";
  return "woman";
}

/** Normalize neckline tokens (`round`, `roundneck`, `round-neck`, `v`, `vneck`, `v-neck`, …). */
export function normalizePatternPeopleHeroNeckline(raw: unknown): PatternPeopleHeroNeckline {
  const normalized = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  if (!normalized) return "round";
  if (isPatternPeopleHeroRoundNeckToken(normalized)) return "round";
  if (isPatternPeopleHeroVNeckToken(normalized)) return "v-neck";
  return "round";
}

function isPatternPeopleHeroRoundNeckToken(normalized: string): boolean {
  if (
    normalized === "round" ||
    normalized === "crew" ||
    normalized === "scoop" ||
    normalized === "boat" ||
    normalized === "square"
  ) {
    return true;
  }
  if (normalized === "roundneck" || normalized === "round-neck" || normalized === "round neck") {
    return true;
  }
  const compact = normalized.replace(/[\s_-]+/g, "");
  if (compact === "roundneck") return true;
  if (/\b(round|crew|scoop|boat|square)\b/.test(normalized)) return true;
  return false;
}

function isPatternPeopleHeroVNeckToken(normalized: string): boolean {
  if (normalized === "v") return true;
  if (normalized === "v-neck" || normalized === "vneck" || normalized === "v_neck" || normalized === "v neck") {
    return true;
  }
  const compact = normalized.replace(/[\s_-]+/g, "");
  if (compact === "vneck") return true;
  if (/\bv[\s_-]?neck\b/.test(normalized)) return true;
  return false;
}

/**
 * Build the canonical WebP basename for a people hero asset.
 * Matches shipped sleeveless filenames: cardigan round → `roundneck`; pullover round → `round-neck`; V → `v-neck`.
 */
export function buildPatternPeopleHeroFilename(
  familyId: string,
  audience: PatternPeopleHeroAudience,
  garment: PatternPeopleHeroGarment,
  neckline: PatternPeopleHeroNeckline,
): string {
  const neckSuffix =
    neckline === "v-neck" ? "v-neck" : garment === "cardigan" ? "roundneck" : "round-neck";
  return `${familyId}-${audience}-${garment}-${neckSuffix}.webp`;
}

function peopleHeroSrc(basePath: string, filename: string): string {
  const base = basePath.replace(/\/$/, "");
  return `${base}/${filename}`;
}

function resolveFromKnownAssets(
  peopleBasePath: string,
  knownAssets: ReadonlySet<string>,
  filename: string,
): string | null {
  if (!knownAssets.has(filename)) return null;
  return peopleHeroSrc(peopleBasePath, filename);
}

/**
 * Resolve a people hero `src`, trying exact match then graceful degradation, then legacy PNG.
 */
export function resolvePatternFamilyPeopleHeroImageSrc(config: PatternFamilyPeopleHeroConfig): string {
  const { familyId, audience, garment, neckline, knownAssets, peopleBasePath, legacyFallback } = config;

  const altNeckline: PatternPeopleHeroNeckline = neckline === "v-neck" ? "round" : "v-neck";
  const candidates: Array<{ audience: PatternPeopleHeroAudience; neckline: PatternPeopleHeroNeckline }> = [
    { audience, neckline },
    { audience: "woman", neckline },
    { audience: "woman", neckline: altNeckline },
    { audience, neckline: altNeckline },
  ];

  for (const c of candidates) {
    const filename = buildPatternPeopleHeroFilename(familyId, c.audience, garment, c.neckline);
    const src = resolveFromKnownAssets(peopleBasePath, knownAssets, filename);
    if (src) return src;
  }

  return legacyFallback(audience, garment);
}

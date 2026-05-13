import { sectionPattern } from "./sleevelessPatternBuilderMerge";

/** Back neckline / shoulder shaping underlay — round/shallow back neck only (never V-neck). */
export const SLEEVELESS_SHOULDER_NOTATION_ICON_BACK = "/images/patterns/shoulder-round-icon.svg";
/** Front round neckline / standard shoulder-neck notation underlay. */
export const SLEEVELESS_SHOULDER_NOTATION_ICON_FRONT_ROUND = "/images/patterns/shoulder-front-icon.svg";
/** Front V-neck notation underlay (`public/images/patterns/shoulder-front-icon-v.svg`). */
export const SLEEVELESS_SHOULDER_NOTATION_ICON_FRONT_V = "/images/patterns/shoulder-front-icon-v.svg";

function necklineRawString(patternData: unknown): string {
  const pd =
    patternData && typeof patternData === "object" && !Array.isArray(patternData)
      ? (patternData as Record<string, unknown>)
      : {};
  const st = sectionPattern(pd.style);
  const design = sectionPattern(pd.design);
  const raw =
    (typeof st.neckline === "string" && st.neckline.trim()
      ? st.neckline
      : typeof pd.neckline === "string" && pd.neckline.trim()
        ? pd.neckline
        : typeof design.neckline === "string" && design.neckline.trim()
          ? design.neckline
          : "") || "";
  return String(raw).toLowerCase();
}

function normalizeNecklineToken(raw: string): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * Round / crew-style neck opening — must win over naive substring checks so descriptive text
 * (e.g. “round neckline”, “sleeveless”) never flips the shoulder diagram to V-neck assets.
 */
function isExplicitRoundNeckFamily(normalized: string): boolean {
  if (!normalized) return false;
  if (normalized === "round" || normalized === "crew" || normalized === "scoop" || normalized === "boat") {
    return true;
  }
  if (/\b(round|crew|scoop|boat|square)\b/.test(normalized)) return true;
  return false;
}

/** Builder values: `v-neck`, legacy flat `v`, etc. — explicit tokens only (not a bare `.includes("v")`). */
function isExplicitVNeckFamily(normalized: string): boolean {
  if (!normalized) return false;
  if (normalized === "v") return true;
  if (normalized === "v-neck" || normalized === "vneck" || normalized === "v_neck" || normalized === "v neck") {
    return true;
  }
  if (/\bv[\s_-]?neck\b/.test(normalized)) return true;
  return false;
}

/** True when saved style/neckline indicates a V-neck (same rule as front schematic SVG). */
export function isSleevelessVNeckChoice(patternData: unknown): boolean {
  const normalized = normalizeNecklineToken(necklineRawString(patternData));
  if (!normalized) return false;
  if (isExplicitRoundNeckFamily(normalized)) return false;
  return isExplicitVNeckFamily(normalized);
}

/**
 * Front garment schematic asset — V-neck vs round silhouette only; placeholders are the same on both SVGs.
 */
export function getSleevelessFrontDiagramSrc(patternData: unknown): string {
  if (isSleevelessVNeckChoice(patternData)) {
    return "/images/patterns/sleeveless/diagram-front-V.svg";
  }
  return "/images/patterns/sleeveless/diagram-front.svg";
}

/**
 * Underlay art for neckline/shoulder notation overlay.
 * Back always uses {@link SLEEVELESS_SHOULDER_NOTATION_ICON_BACK}; front uses V or round front assets only.
 */
export function getSleevelessShoulderNotationIconSrc(piece: "back" | "front", patternData: unknown): string {
  if (piece === "back") {
    return SLEEVELESS_SHOULDER_NOTATION_ICON_BACK;
  }
  return isSleevelessVNeckChoice(patternData)
    ? SLEEVELESS_SHOULDER_NOTATION_ICON_FRONT_V
    : SLEEVELESS_SHOULDER_NOTATION_ICON_FRONT_ROUND;
}

/**
 * Front shoulder/notation icon — concise V-neck-aware alias for builders that don't carry a
 * `piece` discriminator (front is the only side that swaps for V-neck). Keeps image selection
 * centralized so future sweater builders can reuse the same neckline → asset rule.
 */
export function getSleevelessFrontShoulderIconSrc(patternData: unknown): string {
  return getSleevelessShoulderNotationIconSrc("front", patternData);
}

import {
  type SleevelessFrontDiagramType,
  type SleevelessFrontPieceType,
  type SleevelessGarmentStyle,
} from "./cardiganFrontBlock";
import { sectionPattern } from "./sleevelessPatternBuilderMerge";

/** Round-neck cardigan front schematic (`cardiganHalfFrontRound` — `public/images/patterns/cardigan-round.svg`). */
export const SLEEVELESS_CARDIGAN_HALF_FRONT_ROUND_DIAGRAM_SRC =
  "/images/patterns/cardigan-round.svg";

/** V-neck cardigan front schematic (`cardiganHalfFrontV` — `public/images/patterns/cardigan-v.svg`). */
export const SLEEVELESS_CARDIGAN_V_FRONT_DIAGRAM_SRC = "/images/patterns/cardigan-v.svg";

/** Round neckline / shoulder shaping underlay (back and front round neck — never V-neck). */
export const SLEEVELESS_SHOULDER_NOTATION_ICON_BACK = "/images/patterns/shoulder-round-icon.svg";
/** Front round neckline — same asset as back; garment style (pullover vs cardigan) does not change this. */
export const SLEEVELESS_SHOULDER_NOTATION_ICON_FRONT_ROUND = SLEEVELESS_SHOULDER_NOTATION_ICON_BACK;
/** Front V-neck notation underlay (`public/images/patterns/shoulder-front-icon-V.svg`). */
export const SLEEVELESS_SHOULDER_NOTATION_ICON_FRONT_V = "/images/patterns/shoulder-front-icon-V.svg";

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
 * True when merged pattern style requests a cardigan (open front / explicit garmentStyle).
 */
export function isSleevelessCardiganGarmentStyle(patternData: unknown): boolean {
  const pd =
    patternData && typeof patternData === "object" && !Array.isArray(patternData)
      ? (patternData as Record<string, unknown>)
      : {};
  const st = sectionPattern(pd.style);
  const gs = String(st.garmentStyle ?? "").trim().toLowerCase();
  if (gs === "cardigan") return true;
  const fs = String(st.frontStyle ?? "").trim().toLowerCase();
  if (fs === "open") return true;
  return false;
}

/** DEV + cardigan preview from Express / stored style (for UI banner). */
export function isSleevelessDevCardiganExpressPreview(patternData: unknown): boolean {
  return import.meta.env.DEV && isSleevelessCardiganGarmentStyle(patternData);
}

export type SleevelessFrontDiagramResolution = {
  garmentStyle: SleevelessGarmentStyle;
  diagramType: SleevelessFrontDiagramType;
  frontPieceType: SleevelessFrontPieceType;
  src: string;
};

export type ResolveSleevelessFrontDiagramOptions = {
  /**
   * When `true`, force the cardigan half-front asset (tests).
   * When `false`, skip the session/localStorage dev toggle only; persisted `garmentStyle` / `frontStyle`
   * still select the half-front schematic from pattern data.
   */
  devForceCardiganHalfLeft?: boolean;
};

/**
 * Whether DEV-only half-front cardigan diagram preview is enabled.
 * Set `sessionStorage` or `localStorage` key `kbmDevCardiganHalfFrontLeft` to `"1"` while running `vite dev`.
 */
export function isSleevelessDevCardiganHalfFrontLeftEnabled(): boolean {
  if (!import.meta.env.DEV) return false;
  try {
    const g = globalThis as typeof globalThis & {
      sessionStorage?: Storage;
      localStorage?: Storage;
    };
    return (
      g.sessionStorage?.getItem("kbmDevCardiganHalfFrontLeft") === "1" ||
      g.localStorage?.getItem("kbmDevCardiganHalfFrontLeft") === "1"
    );
  } catch {
    return false;
  }
}

/**
 * Front-opening schematic URL plus discriminators for future routing (`diagramType`, `garmentStyle`, `frontPieceType`).
 */
export function resolveSleevelessFrontDiagram(
  patternData: unknown,
  options?: ResolveSleevelessFrontDiagramOptions,
): SleevelessFrontDiagramResolution {
  let useCardiganHalf = false;
  if (options?.devForceCardiganHalfLeft === true) {
    useCardiganHalf = true;
  } else if (isSleevelessCardiganGarmentStyle(patternData)) {
    useCardiganHalf = true;
  } else if (
    options?.devForceCardiganHalfLeft !== false &&
    import.meta.env.DEV &&
    isSleevelessDevCardiganHalfFrontLeftEnabled()
  ) {
    useCardiganHalf = true;
  }

  if (useCardiganHalf) {
    if (isSleevelessVNeckChoice(patternData)) {
      return {
        garmentStyle: "cardigan",
        diagramType: "cardiganHalfFrontV",
        frontPieceType: "leftFront",
        src: SLEEVELESS_CARDIGAN_V_FRONT_DIAGRAM_SRC,
      };
    }
    return {
      garmentStyle: "cardigan",
      diagramType: "cardiganHalfFrontRound",
      frontPieceType: "leftFront",
      src: SLEEVELESS_CARDIGAN_HALF_FRONT_ROUND_DIAGRAM_SRC,
    };
  }

  if (isSleevelessVNeckChoice(patternData)) {
    return {
      garmentStyle: "pullover",
      diagramType: "pulloverFullFrontV",
      frontPieceType: "fullFront",
      src: "/images/patterns/sleeveless/diagram-front-V.svg",
    };
  }

  return {
    garmentStyle: "pullover",
    diagramType: "pulloverFullFrontRound",
    frontPieceType: "fullFront",
    src: "/images/patterns/sleeveless/diagram-front.svg",
  };
}

/**
 * Front garment schematic asset — V-neck vs round silhouette; delegates to {@link resolveSleevelessFrontDiagram}.
 */
export function getSleevelessFrontDiagramSrc(patternData: unknown): string {
  return resolveSleevelessFrontDiagram(patternData, { devForceCardiganHalfLeft: false }).src;
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

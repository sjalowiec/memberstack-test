/**
 * Catalog badge counts for Pattern Builder cards (`/patterns`).
 *
 * Counts distinct design combinations each Pattern Builder can create.
 * Individual sizes, gauge, ease, custom measurements, and alternate knitting
 * methods (cuff-up vs top-down) are excluded.
 *
 * Prefer existing option arrays at build time. When a choice lives only in
 * markup, use named catalog constants and keep the multiplication documented.
 */

import { DROP_SHOULDER_SLEEVE_LENGTH_CHOICES } from "./patternConstructionIdentity";
import { HAT_BUILDER_ALLOWED_CROWNS } from "./hat/hatBuilderValidation";
import { HAT_BRIM_TYPES, HAT_NAMED_FIT_STYLES } from "./hat/hatMath";

/** Sweater who-picker categories (Women / Men / Kids / Baby). */
export const SWEATER_CATALOG_AUDIENCES = ["women", "men", "kids", "baby"] as const;

/** Express / workspace front styles (Pullover + Cardigan). */
export const SWEATER_CATALOG_FRONT_STYLES = ["pullover", "cardigan"] as const;

/** Express / workspace necklines (Round + V-neck). */
export const SWEATER_CATALOG_NECKLINES = ["round", "v-neck"] as const;

/**
 * Sleeveless body shapes currently selectable on Custom Build.
 * Shaped Waist is disabled / coming next and is not counted.
 */
export const SLEEVELESS_CATALOG_BODY_SHAPES = ["straight", "aline"] as const;

/**
 * Sleeveless: 4 audiences × 2 fronts × 2 necklines × 2 body shapes = 32.
 *
 * Represents the Sleeveless Pattern Builder as a whole:
 *   Women, Men, Kids, Baby
 *   × Pullover or Cardigan
 *   × Round or V-neck
 *   × Straight or A-line (Custom Build; Shaped Waist is disabled).
 * All of these combinations are valid.
 *
 * Not counted: individual sizes, Close/Standard/Relaxed ease, gauge,
 * finished measurements, Plus chart (not a who option).
 */
export const SLEEVELESS_PATTERN_POSSIBILITIES =
  SWEATER_CATALOG_AUDIENCES.length *
  SWEATER_CATALOG_FRONT_STYLES.length *
  SWEATER_CATALOG_NECKLINES.length *
  SLEEVELESS_CATALOG_BODY_SHAPES.length;

/** Catalog pill rest copy. Displays as `32 STYLES IN 1 BUILDER`. */
export const SLEEVELESS_CATALOG_PILL_REST = "Styles in 1 Builder";

/**
 * Hat: 3 brim styles × 3 crown styles × 3 length styles = 27.
 *
 * Current builder options:
 *   Rolled Brim, Single Layer, Folded Hem (`HAT_BRIM_TYPES`)
 *   × Gathered, Four-Gore, Swirl Top (`HAT_BUILDER_ALLOWED_CROWNS`)
 *   × Beanie, Standard, Slouchy (`HAT_NAMED_FIT_STYLES`).
 * Every brim combines with every crown and every length style.
 *
 * Not counted: Baby/Kids/Women/Men or individual sizes (same hat designs),
 * custom circumference/length, brim height, gauge.
 * Legacy `wedge-4` maps to Four-Gore; hung-hem is not a current picker option.
 */
export const HAT_PATTERN_POSSIBILITIES =
  HAT_BRIM_TYPES.length * HAT_BUILDER_ALLOWED_CROWNS.length * HAT_NAMED_FIT_STYLES.length;

/** Displays as `27 HATS IN 1 BUILDER`. */
export const HAT_CATALOG_PILL_REST = "Hats in 1 Builder";

/**
 * Drop Shoulder: 4 audiences × 2 fronts × 2 necklines × 4 sleeve lengths = 64.
 *
 *   Women, Men, Kids, Baby
 *   × Pullover or Cardigan
 *   × Round or V-neck
 *   × Long, 3/4, Elbow, Short (`DROP_SHOULDER_SLEEVE_LENGTH_CHOICES`).
 * No invalid combinations among these choices.
 *
 * Not counted: cuff-up vs top-down (same design, different instructions),
 * individual sizes, ease, gauge, numeric measurements, measurement-inferred
 * A-line (no Drop Shoulder body-shape picker).
 */
export const DROP_SHOULDER_PATTERN_POSSIBILITIES =
  SWEATER_CATALOG_AUDIENCES.length *
  SWEATER_CATALOG_FRONT_STYLES.length *
  SWEATER_CATALOG_NECKLINES.length *
  DROP_SHOULDER_SLEEVE_LENGTH_CHOICES.length;

/** Displays as `64 PATTERNS FOR ANYONE`. */
export const DROP_SHOULDER_CATALOG_PILL_REST = "Patterns for Anyone";

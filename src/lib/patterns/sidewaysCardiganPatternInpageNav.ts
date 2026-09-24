/**
 * Sideways V-Neck finished-pattern section jumps.
 * Uses the shared sticky in-page nav. Labels are the visible section headings.
 * A link is omitted when its section is not in the generated pattern (pullover
 * sequence, missing sleeve, or any heading this pattern does not render).
 */

import type { PatternInpageNavItem } from "./patternInpageNav";

/** Major jumps, in knitting order. Same grain as Back / Armhole / Neckline / Sleeve. */
export const SIDEWAYS_CARDIGAN_INPAGE_NAV_ITEMS: readonly PatternInpageNavItem[] = [
  { label: "BODY", ids: ["sg-body"] },
  { label: "FIRST V-NECK", ids: ["sg-body-first-v-neck"] },
  { label: "FIRST ARMHOLE", ids: ["sg-body-first-armhole"] },
  { label: "BACK NECK", ids: ["sg-body-back-neck"] },
  { label: "SECOND ARMHOLE", ids: ["sg-body-second-armhole"] },
  { label: "SECOND V-NECK", ids: ["sg-body-second-v-neck"] },
  { label: "SLEEVE", ids: ["sg-sleeve"] },
];

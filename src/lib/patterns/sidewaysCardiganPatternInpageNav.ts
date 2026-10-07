/**
 * Sideways V-Neck finished-pattern section jumps.
 * Both garment styles use the shared sticky in-page nav. A link is omitted when
 * its section is not in the generated pattern (missing sleeve, or any heading
 * this pattern does not render).
 */

import type { PatternInpageNavItem } from "./patternInpageNav";
import type { SidewaysCardiganGarmentStyle } from "./sidewaysCardiganConstructionIdentity";

/** Cardigan major jumps, in knitting order. */
export const SIDEWAYS_CARDIGAN_INPAGE_NAV_ITEMS: readonly PatternInpageNavItem[] = [
  { label: "BODY", ids: ["sg-body"] },
  { label: "FIRST V-NECK", ids: ["sg-body-first-v-neck"] },
  { label: "FIRST ARMHOLE", ids: ["sg-body-first-armhole"] },
  { label: "BACK NECK", ids: ["sg-body-back-neck"] },
  { label: "SECOND ARMHOLE", ids: ["sg-body-second-armhole"] },
  { label: "SECOND V-NECK", ids: ["sg-body-second-v-neck"] },
  { label: "SLEEVE", ids: ["sg-sleeve"] },
  { label: "FRONT AND NECK BAND", ids: ["sg-front-neck-band"] },
  { label: "FINISHING", ids: ["sg-finishing"] },
];

/**
 * Pullover instruction sections, in knitting order.
 * Shoulders, the single armhole, and the back neck follow the pullover sequence.
 * The cardigan front band and the second armhole are not part of this pattern.
 */
export const SIDEWAYS_PULLOVER_INPAGE_NAV_ITEMS: readonly PatternInpageNavItem[] = [
  { label: "FIRST FRONT SHOULDER", ids: ["sg-body-first-front-shoulder"] },
  { label: "FIRST V-NECK", ids: ["sg-body-first-v-neck"] },
  { label: "SECOND V-NECK", ids: ["sg-body-second-v-neck"] },
  { label: "SECOND FRONT SHOULDER", ids: ["sg-body-second-front-shoulder"] },
  { label: "ARMHOLE", ids: ["sg-body-knitted-armhole-slit"] },
  { label: "FIRST BACK SHOULDER", ids: ["sg-body-first-back-shoulder"] },
  { label: "BACK NECK", ids: ["sg-body-bind-off-back-neck"] },
  { label: "SECOND BACK SHOULDER", ids: ["sg-body-second-back-shoulder"] },
  { label: "SLEEVE", ids: ["sg-sleeve"] },
  { label: "FINISHING", ids: ["sg-finishing"] },
];

export function sidewaysPatternInpageNavItems(
  garmentStyle: SidewaysCardiganGarmentStyle | null | undefined,
): readonly PatternInpageNavItem[] {
  return garmentStyle === "pullover"
    ? SIDEWAYS_PULLOVER_INPAGE_NAV_ITEMS
    : SIDEWAYS_CARDIGAN_INPAGE_NAV_ITEMS;
}

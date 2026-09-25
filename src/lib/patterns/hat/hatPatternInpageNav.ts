/**
 * Hat finished-pattern section jumps.
 * Labels are the stable section names. A link is omitted when that section
 * is not in the generated pattern (for example, a hat with no body rows).
 */

import type { PatternInpageNavItem } from "../patternInpageNav";

export const HAT_PATTERN_INPAGE_NAV_ITEMS: readonly PatternInpageNavItem[] = [
  { label: "Cast-On", ids: ["cast-on"] },
  { label: "Brim", ids: ["brim"] },
  { label: "Body", ids: ["body"] },
  { label: "Crown", ids: ["crown-timing", "crown", "crown-intro"] },
  { label: "Finishing", ids: ["finishing"] },
];

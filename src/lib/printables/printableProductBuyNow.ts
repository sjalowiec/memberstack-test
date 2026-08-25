import type { ViewerAccessState } from "../memberAccess";

/**
 * Same rule as `/downloads/[slug]` (Cut 'n Sew / Gauge Rulers):
 * active members with memberFree get the included download; everyone else keeps Buy Now.
 */
export function hidePrintableBuyNow(
  memberFree: boolean,
  state: ViewerAccessState | null,
): boolean {
  return memberFree && state === "memberAccess";
}

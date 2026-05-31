/**
 * Edit-access gate for the saved-pattern Copy action.
 *
 * Copy is only usable when the knitter has edit access to the saved pattern:
 * an active member, or the paid owner of that pattern. Free / non-owner /
 * free-preview users still SEE the Copy control — it is shown disabled, never hidden.
 *
 * TODO: replace the temporary {@link canCustomizePattern} bridge with a real Memberstack
 * entitlement check plus a per-pattern ownership lookup.
 */
import { canCustomizePattern } from "./sleevelessPatternAccessGate";

/** Tooltip / helper text shown on the disabled Copy control for free / non-owner users. */
export const SAVED_PATTERN_COPY_LOCKED_HELP_TEXT =
  "Copy is available when you purchase this pattern or become a member.";

export type SavedPatternCopyAccess = {
  /** Active paid membership — may copy any saved pattern they can open. */
  isActiveMember: boolean;
  /** Paid owner of this specific pattern. */
  isPaidOwner: boolean;
};

/**
 * Resolve the current knitter's copy access.
 *
 * Temporary bridge: {@link canCustomizePattern} already encodes "this pattern is editable
 * (member or owned)". Until real entitlement wiring lands, both signals derive from it.
 */
export function resolveSavedPatternCopyAccess(pageUrl?: URL): SavedPatternCopyAccess {
  const hasEditAccess = canCustomizePattern(pageUrl);
  return { isActiveMember: hasEditAccess, isPaidOwner: hasEditAccess };
}

/** Pure rule: copy is allowed for active members and paid owners only. */
export function canCopySavedCustomPatternProject(
  access: SavedPatternCopyAccess = resolveSavedPatternCopyAccess(),
): boolean {
  return access.isActiveMember || access.isPaidOwner;
}

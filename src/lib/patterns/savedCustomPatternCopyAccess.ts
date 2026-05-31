/**
 * Edit-access gate for the saved Custom Pattern "Copy" action.
 *
 * Copy duplicates a saved project, which is only meaningful for knitters who can
 * edit the pattern: active members or paid owners of that pattern. Free / non-owner
 * (free preview) knitters still SEE the Copy control, but it is disabled with a
 * helper tooltip explaining how to unlock it.
 *
 * Reuses {@link canCustomizePattern} so the access source of truth stays in one place
 * (dev defaults editable unless `?customize=0` / `?advanced=0` / localStorage override).
 */
import { canCustomizePattern } from "./sleevelessPatternAccessGate";

/** Tooltip / helper copy shown when Copy is disabled for free / non-owner knitters. */
export const SAVED_CUSTOM_PATTERN_COPY_DISABLED_TEXT =
  "Copy is available when you purchase this pattern or become a member.";

/** True when the current knitter can copy a saved pattern (active member or paid owner). */
export function canCopySavedCustomPattern(pageUrl?: URL): boolean {
  return canCustomizePattern(pageUrl);
}

function isElementLike(el: unknown): el is HTMLElement {
  return (
    !!el &&
    typeof el === "object" &&
    "setAttribute" in el &&
    "classList" in el &&
    "removeAttribute" in el
  );
}

/**
 * Reflects copy edit-access onto a Copy button (and optional helper element).
 *
 * The button is never hidden: when access is missing it is disabled, grayed
 * (`is-disabled`), given an `aria-disabled`/`title` tooltip, and the helper text
 * is revealed. When access is present the disabled styling/tooltip is cleared.
 */
export function syncSavedCustomPatternCopyAccess(
  copyButton: HTMLButtonElement | null | undefined,
  helperEl?: HTMLElement | null,
  pageUrl?: URL,
): boolean {
  const hasAccess = canCopySavedCustomPattern(pageUrl);

  if (isElementLike(copyButton)) {
    const btn = copyButton as HTMLButtonElement;
    btn.disabled = !hasAccess;
    btn.classList.toggle("is-disabled", !hasAccess);
    if (hasAccess) {
      btn.removeAttribute("aria-disabled");
      btn.removeAttribute("title");
    } else {
      btn.setAttribute("aria-disabled", "true");
      btn.setAttribute("title", SAVED_CUSTOM_PATTERN_COPY_DISABLED_TEXT);
    }
  }

  if (isElementLike(helperEl)) {
    const el = helperEl as HTMLElement;
    el.textContent = hasAccess ? "" : SAVED_CUSTOM_PATTERN_COPY_DISABLED_TEXT;
    el.hidden = hasAccess;
  }

  return hasAccess;
}

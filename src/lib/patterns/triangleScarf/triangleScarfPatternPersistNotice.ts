/**
 * Temporary-pattern notice for the free Weekend Triangle Scarf page.
 * Copy matches the Hat. Members with saved-project privileges do not see it.
 */
import type { ViewerAccessState } from "../../memberAccess";
import {
  HAT_PATTERN_MEMBERSHIP_CTA_CLASS,
  HAT_PATTERN_MEMBERSHIP_CTA_HREF,
  HAT_PATTERN_MEMBERSHIP_CTA_LABEL,
  HAT_PATTERN_PERSIST_MEMBERSHIP_PITCH,
  HAT_PATTERN_PERSIST_NOTICE_TITLE,
  HAT_PATTERN_PERSIST_WARNING_EMPHASIS,
  HAT_PATTERN_PERSIST_WARNING_LEAD,
  resolveHatPatternPersistNotice,
  shouldShowHatTemporaryPatternNotice,
} from "../hat/hatPatternPersistNotice";

export {
  HAT_PATTERN_MEMBERSHIP_CTA_CLASS as TRIANGLE_SCARF_MEMBERSHIP_CTA_CLASS,
  HAT_PATTERN_MEMBERSHIP_CTA_HREF as TRIANGLE_SCARF_MEMBERSHIP_CTA_HREF,
  HAT_PATTERN_MEMBERSHIP_CTA_LABEL as TRIANGLE_SCARF_MEMBERSHIP_CTA_LABEL,
  HAT_PATTERN_PERSIST_MEMBERSHIP_PITCH as TRIANGLE_SCARF_PERSIST_MEMBERSHIP_PITCH,
  HAT_PATTERN_PERSIST_NOTICE_TITLE as TRIANGLE_SCARF_PERSIST_NOTICE_TITLE,
  HAT_PATTERN_PERSIST_WARNING_EMPHASIS as TRIANGLE_SCARF_PERSIST_WARNING_EMPHASIS,
  HAT_PATTERN_PERSIST_WARNING_LEAD as TRIANGLE_SCARF_PERSIST_WARNING_LEAD,
};

export function shouldShowTriangleScarfTemporaryPatternNotice(
  state: ViewerAccessState,
  isEditingSavedProject = false,
): boolean {
  return shouldShowHatTemporaryPatternNotice(state, isEditingSavedProject);
}

export function applyTriangleScarfPatternPersistNotice(
  root: ParentNode | null,
  state: ViewerAccessState,
  options: { isEditingSavedProject?: boolean } = {},
): void {
  if (!root || typeof root.querySelector !== "function") return;
  const presentation = resolveHatPatternPersistNotice(state);
  const showNotice = shouldShowTriangleScarfTemporaryPatternNotice(
    state,
    options.isEditingSavedProject === true,
  );
  const notice = root.querySelector("[data-triangle-scarf-pattern-persist-notice]");
  if (notice && "hidden" in notice) {
    (notice as HTMLElement).hidden = !showNotice;
  }
  const membership = root.querySelector("[data-triangle-scarf-pattern-persist-membership]");
  if (membership && "hidden" in membership) {
    (membership as HTMLElement).hidden = !presentation.showMembershipCta;
  }
}

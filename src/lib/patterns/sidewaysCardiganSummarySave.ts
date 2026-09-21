/**
 * Persist Sideways Summary/Edit to My Patterns, matching Sleeveless/Drop Save Changes.
 * Creates a saved project when none is linked; updates when one is.
 */

import { runSaveCustomPatternFromWorkspace } from "./customPatternEditingBannerActions";
import { readActiveCustomPatternProjectId } from "./customPatternProjectActiveId";
import { sidewaysCardiganSummaryPrimarySuccessHref } from "./sidewaysCardiganPatternNavigation";

export async function persistSidewaysCardiganSummaryProject(
  root?: ParentNode,
): Promise<{ ok: true; href: string } | { ok: false; error: string }> {
  const saveRes = await runSaveCustomPatternFromWorkspace(root, {
    skipPreSavePrepare: true,
  });
  if (!saveRes.ok) return { ok: false, error: saveRes.error };
  return {
    ok: true,
    href: sidewaysCardiganSummaryPrimarySuccessHref(readActiveCustomPatternProjectId()),
  };
}

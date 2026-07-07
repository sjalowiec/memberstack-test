/**
 * Persist the working custom-build draft before navigation (update saved project or create new).
 */
import { runUpdateActiveSavedCustomPattern } from "./customPatternEditingBannerActions";
import { readActiveCustomPatternProjectId } from "./customPatternProjectActiveId";
import { smartSaveCustomPatternProject } from "./customPatternSavedProjectsPanel";
import { prepareCustomBuildPatternGeneration } from "./prepareCustomBuildPatternGeneration";
import { resolvePatternProjectSaveNameFromState } from "./sleevelessPatternProjectMeta";

export async function saveActiveCustomPatternBeforeNavigate(
  root?: ParentNode,
): Promise<{ ok: true } | { ok: false }> {
  prepareCustomBuildPatternGeneration({
    root,
    rehydrateSavedProject: false,
  });

  const activeId = readActiveCustomPatternProjectId();
  if (activeId) {
    const res = await runUpdateActiveSavedCustomPattern(root);
    return res.ok ? { ok: true } : { ok: false };
  }

  const title = resolvePatternProjectSaveNameFromState();
  if (!title) {
    return { ok: false };
  }

  const res = await smartSaveCustomPatternProject({
    mode: "create",
    resolveName: () => title,
    root,
  });
  return res.ok ? { ok: true } : { ok: false };
}

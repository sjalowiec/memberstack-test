import { prepareCustomBuildPatternGeneration } from "./prepareCustomBuildPatternGeneration";
import { hasUnsavedSavedCustomPatternChanges } from "./customPatternSavedProjectDirtyState";
import { runUpdateActiveSavedCustomPattern } from "./customPatternEditingBannerActions";
import { resolveCustomBuildSaveMeasureFlushRoot } from "./sleevelessCustomMeasurementStorage";
import { promptSavedPatternViewUnsavedChoice } from "./startNewCustomPatternWorkflow";

export type SavedPatternUnsavedViewChoice = "save-and-view" | "view-without-saving" | "cancel";

export type SavedPatternUnsavedViewWorkflowDeps = {
  hasUnsaved: () => boolean;
  promptUnsaved: () => Promise<SavedPatternUnsavedViewChoice>;
  saveActiveProject: () => Promise<{ ok: true } | { ok: false }>;
  navigate: () => void;
  /** Diagram host for flushing pending measurement inputs before save / navigate. */
  flushRoot?: ParentNode | null;
};

export async function runSavedPatternUnsavedViewWorkflow(
  deps: SavedPatternUnsavedViewWorkflowDeps,
): Promise<"navigated" | "cancelled"> {
  if (!deps.hasUnsaved()) {
    prepareCustomBuildPatternGeneration({ root: deps.flushRoot });
    deps.navigate();
    return "navigated";
  }

  const choice = await deps.promptUnsaved();
  if (choice === "cancel") return "cancelled";

  if (choice === "view-without-saving") {
    prepareCustomBuildPatternGeneration({ root: deps.flushRoot });
    deps.navigate();
    return "navigated";
  }

  if (choice === "save-and-view") {
    prepareCustomBuildPatternGeneration({ root: deps.flushRoot });
    const res = await deps.saveActiveProject();
    if (!res.ok) return "cancelled";
  }

  prepareCustomBuildPatternGeneration({ root: deps.flushRoot });
  deps.navigate();
  return "navigated";
}

export function createSavedPatternUnsavedViewWorkflowDeps(options: {
  href: string;
  root?: ParentNode;
}): SavedPatternUnsavedViewWorkflowDeps {
  const href = String(options.href ?? "").trim();
  const root = options.root ?? (typeof document !== "undefined" ? document : undefined);
  if (!root) {
    throw new Error("document unavailable");
  }
  const flushRoot = resolveCustomBuildSaveMeasureFlushRoot(root);

  return {
    hasUnsaved: hasUnsavedSavedCustomPatternChanges,
    promptUnsaved: () => promptSavedPatternViewUnsavedChoice(root),
    flushRoot,
    saveActiveProject: async () => {
      prepareCustomBuildPatternGeneration({ root: flushRoot, rehydrateSavedProject: false });
      const res = await runUpdateActiveSavedCustomPattern(flushRoot ?? root);
      return res.ok ? { ok: true } : { ok: false };
    },
    navigate: () => {
      if (typeof window === "undefined") return;
      window.location.assign(href);
    },
  };
}

export async function navigateToPatternWithUnsavedEditsGuard(options: {
  href: string;
  root?: ParentNode;
}): Promise<"navigated" | "cancelled"> {
  return runSavedPatternUnsavedViewWorkflow(
    createSavedPatternUnsavedViewWorkflowDeps(options),
  );
}


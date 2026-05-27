import { hasUnsavedSavedCustomPatternChanges } from "./customPatternSavedProjectDirtyState";
import { runUpdateActiveSavedCustomPattern } from "./customPatternEditingBannerActions";
import { promptSavedPatternViewUnsavedChoice } from "./startNewCustomPatternWorkflow";

export type SavedPatternUnsavedViewChoice = "save-and-view" | "view-without-saving" | "cancel";

export type SavedPatternUnsavedViewWorkflowDeps = {
  hasUnsaved: () => boolean;
  promptUnsaved: () => Promise<SavedPatternUnsavedViewChoice>;
  saveActiveProject: () => Promise<{ ok: true } | { ok: false }>;
  navigate: () => void;
};

export async function runSavedPatternUnsavedViewWorkflow(
  deps: SavedPatternUnsavedViewWorkflowDeps,
): Promise<"navigated" | "cancelled"> {
  if (!deps.hasUnsaved()) {
    deps.navigate();
    return "navigated";
  }

  const choice = await deps.promptUnsaved();
  if (choice === "cancel") return "cancelled";

  if (choice === "save-and-view") {
    const res = await deps.saveActiveProject();
    if (!res.ok) return "cancelled";
  }

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

  return {
    hasUnsaved: hasUnsavedSavedCustomPatternChanges,
    promptUnsaved: () => promptSavedPatternViewUnsavedChoice(root),
    saveActiveProject: async () => {
      const res = await runUpdateActiveSavedCustomPattern(root);
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


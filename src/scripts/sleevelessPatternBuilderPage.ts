import { applySleevelessPatternOnlineProjectHeader } from "./sleevelessPatternOnlineProjectHeader.ts";
import { initSleevelessPatternBuilderPage } from "./sleevelessPatternPageShared.ts";
import { ensureClaimedSavedPatternHydratedForView } from "../lib/patterns/loadClaimedSavedPatternForView.ts";
import { ensureUrlRequestedSavedPatternHydrated } from "../lib/patterns/ensureUrlRequestedSavedPattern.ts";
import { isDedicatedSleevelessPatternWorkspacePage } from "../lib/patterns/prepareCustomBuildPatternGeneration.ts";
import { runPatternWorkspaceBuilderGenerationHandoff } from "../lib/patterns/patternWorkspaceBuilderGenerationHandoff.ts";
import { maybeAutoSaveFirstFreePattern } from "../lib/patterns/patternAutoSaveFirstFree.ts";

declare global {
  interface Window {
    __kbmSleevelessPatternBuilderBooted?: boolean;
  }
}

async function boot(): Promise<void> {
  // Vite HMR re-executes this module; avoid duplicate tab listeners + pattern refreshes.
  if (typeof window !== "undefined" && window.__kbmSleevelessPatternBuilderBooted) {
    return;
  }
  if (typeof window !== "undefined") {
    window.__kbmSleevelessPatternBuilderBooted = true;
  }

  // When the URL carries an explicit `project` id (My Patterns View), that id is authoritative:
  // load exactly that saved project BEFORE any self-heal / reconciliation runs, so localStorage
  // (working draft, activeProjectId, Express mirror, drift-promotion) can never substitute a
  // different, previously-open pattern. On success the self-heal below is skipped; on failure the id
  // is stripped so the normal fallbacks still run.
  if (isDedicatedSleevelessPatternWorkspacePage()) {
    let urlProjectAuthoritative = false;
    try {
      const outcome = await ensureUrlRequestedSavedPatternHydrated();
      urlProjectAuthoritative = outcome === "loaded";
    } catch (error) {
      console.error("[kbm] Authoritative saved-pattern URL load failed; continuing.", error);
    }

    // Self-heal the read-only saved-pattern view: when no saved project is linked locally (e.g. the
    // active edit link was cleared at the new-pattern gate), reload a free knitter's claimed pattern
    // by id BEFORE the header/render run so the view never hangs on "Loading pattern…". No-op for
    // members and when a project is already linked. Skipped when an authoritative URL id won.
    if (!urlProjectAuthoritative) {
      try {
        await ensureClaimedSavedPatternHydratedForView();
      } catch (error) {
        console.error("[kbm] Claimed saved-pattern view fallback failed; continuing.", error);
      }
    }
    try {
      const handoffRan = await runPatternWorkspaceBuilderGenerationHandoff();
      if (handoffRan) {
        try {
          await maybeAutoSaveFirstFreePattern();
        } catch (error) {
          console.error("[kbm] Auto-save first free pattern failed; continuing.", error);
        }
      }
    } catch (error) {
      console.error("[kbm] Builder generation handoff failed; continuing.", error);
    }
  }
  applySleevelessPatternOnlineProjectHeader();
  void initSleevelessPatternBuilderPage();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => void boot());
} else {
  void boot();
}

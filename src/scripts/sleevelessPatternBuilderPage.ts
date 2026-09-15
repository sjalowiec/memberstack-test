import { applySleevelessPatternOnlineProjectHeader } from "./sleevelessPatternOnlineProjectHeader.ts";
import { initSleevelessPatternBuilderPage } from "./sleevelessPatternPageShared.ts";
import { ensureClaimedSavedPatternHydratedForView } from "../lib/patterns/loadClaimedSavedPatternForView.ts";
import {
  applySavedPatternUnavailableMessage,
  ensureUrlRequestedSavedPatternHydrated,
} from "../lib/patterns/ensureUrlRequestedSavedPattern.ts";
import { isDedicatedSleevelessPatternWorkspacePage } from "../lib/patterns/prepareCustomBuildPatternGeneration.ts";
import { hasAuthoritativeUrlSavedPatternId } from "../lib/patterns/savedPatternViewUrl.ts";
import {
  PATTERN_WORKSPACE_BUILDER_HANDOFF_COMPLETE_EVENT,
  runPatternWorkspaceBuilderGenerationHandoff,
} from "../lib/patterns/patternWorkspaceBuilderGenerationHandoff.ts";
import { maybeAutoSaveFirstFreePattern } from "../lib/patterns/patternAutoSaveFirstFree.ts";
import {
  initBustDartPatternCustomization,
} from "./bustDartPatternModalClient.ts";

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
  // load exactly that saved project BEFORE any self-heal / reconciliation runs. A failed load is
  // terminal — do not fall back to a different localStorage draft.
  if (isDedicatedSleevelessPatternWorkspacePage()) {
    let urlProjectAuthoritative = false;
    try {
      const outcome = await ensureUrlRequestedSavedPatternHydrated();
      urlProjectAuthoritative = outcome === "loaded";
      if (outcome === "load-failed") {
        applySavedPatternUnavailableMessage();
        return;
      }
    } catch (error) {
      console.error("[kbm] Authoritative saved-pattern URL load failed.", error);
      if (hasAuthoritativeUrlSavedPatternId()) {
        applySavedPatternUnavailableMessage();
        return;
      }
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
    } finally {
      if (typeof document !== "undefined") {
        document.dispatchEvent(new CustomEvent(PATTERN_WORKSPACE_BUILDER_HANDOFF_COMPLETE_EVENT));
      }
    }
  }
  applySleevelessPatternOnlineProjectHeader();
  void initSleevelessPatternBuilderPage();
  initBustDartPatternCustomization();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => void boot());
} else {
  void boot();
}

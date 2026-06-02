import { applySleevelessPatternOnlineProjectHeader } from "./sleevelessPatternOnlineProjectHeader.ts";
import { initSleevelessPatternBuilderPage } from "./sleevelessPatternPageShared.ts";
import { ensureClaimedSavedPatternHydratedForView } from "../lib/patterns/loadClaimedSavedPatternForView.ts";
import { isDedicatedSleevelessPatternWorkspacePage } from "../lib/patterns/prepareCustomBuildPatternGeneration.ts";

async function boot(): Promise<void> {
  // Self-heal the read-only saved-pattern view: when no saved project is linked locally (e.g. the
  // active edit link was cleared at the new-pattern gate), reload a free knitter's claimed pattern by
  // id BEFORE the header/render run so the view never hangs on "Loading pattern…". No-op for members
  // and when a project is already linked.
  if (isDedicatedSleevelessPatternWorkspacePage()) {
    try {
      await ensureClaimedSavedPatternHydratedForView();
    } catch (error) {
      console.error("[kbm] Claimed saved-pattern view fallback failed; continuing.", error);
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

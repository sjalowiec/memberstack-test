/**
 * “New Pattern” control beside pattern workspace tabs (sleeveless saved-project workflow).
 */
import { startNewCustomPatternFromWorkspace } from "./startNewCustomPatternWorkflow";
import { canCreateSleevelessPattern } from "./sleevelessPatternSystemAccess";
import { resolveSleevelessUserAccess } from "./sleevelessPatternSystemAccessClient";

export function initPatternWorkspaceNewPattern(doc: Document = document): void {
  const trigger = doc.querySelector("[data-pattern-workspace-new-pattern-trigger]");
  if (!(trigger instanceof HTMLButtonElement)) return;

  // Hide "New Pattern" for users who can't create another one (free user who already claimed
  // their one pattern, or a downgraded member). Saving is gated server-side too, but hiding the
  // entry point keeps the locked state clear instead of letting them build then fail at save.
  void resolveSleevelessUserAccess().then((access) => {
    if (canCreateSleevelessPattern(access)) return;
    trigger.hidden = true;
    trigger.setAttribute("aria-hidden", "true");
    trigger.setAttribute("tabindex", "-1");
  });

  let busy = false;
  trigger.addEventListener("click", () => {
    if (busy) return;
    busy = true;
    void startNewCustomPatternFromWorkspace(doc).finally(() => {
      busy = false;
    });
  });
}

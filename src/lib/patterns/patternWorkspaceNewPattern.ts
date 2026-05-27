/**
 * “New Pattern” control beside pattern workspace tabs (sleeveless saved-project workflow).
 */
import { startNewCustomPatternFromWorkspace } from "./startNewCustomPatternWorkflow";

export function initPatternWorkspaceNewPattern(doc: Document = document): void {
  const trigger = doc.querySelector("[data-pattern-workspace-new-pattern-trigger]");
  if (!(trigger instanceof HTMLButtonElement)) return;

  let busy = false;
  trigger.addEventListener("click", () => {
    if (busy) return;
    busy = true;
    void startNewCustomPatternFromWorkspace(doc).finally(() => {
      busy = false;
    });
  });
}

/**
 * Debounced sync of My Pattern reading workflow state to the active saved project.
 */
import { readActiveCustomPatternProjectId } from "./customPatternProjectActiveId";
import { patchCustomPatternProjectReadingWorkflow } from "./customPatternProjectClient";
import type { CustomPatternFamily } from "./customPatternProjectTypes";
import { collectSleevelessReadingWorkflow } from "./patternReadingWorkflow";

const DEBOUNCE_MS = 650;

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let inFlight = false;
let pendingPatternId: string | null = null;
let pendingFamily: CustomPatternFamily = "sleeveless";

export function scheduleReadingWorkflowSync(
  patternId: string,
  family: CustomPatternFamily = "sleeveless",
): void {
  if (!patternId.trim()) return;
  if (!readActiveCustomPatternProjectId()) return;

  pendingPatternId = patternId.trim();
  pendingFamily = family;
  if (debounceTimer !== null) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void flushReadingWorkflowSync();
  }, DEBOUNCE_MS);
}

export async function flushReadingWorkflowSync(): Promise<void> {
  const projectId = readActiveCustomPatternProjectId();
  const patternId = pendingPatternId;
  if (!projectId || !patternId) return;

  if (inFlight) {
    scheduleReadingWorkflowSync(patternId, pendingFamily);
    return;
  }

  inFlight = true;
  try {
    const readingWorkflow = collectSleevelessReadingWorkflow(patternId);
    await patchCustomPatternProjectReadingWorkflow(projectId, readingWorkflow, pendingFamily);
  } catch {
    /* network — localStorage remains source of truth until next change */
  } finally {
    inFlight = false;
  }
}

/** Cancel pending debounced sync (tests). */
export function resetReadingWorkflowSyncForTests(): void {
  if (debounceTimer !== null) clearTimeout(debounceTimer);
  debounceTimer = null;
  inFlight = false;
  pendingPatternId = null;
}

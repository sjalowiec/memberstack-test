/**
 * My Pattern reading/workflow UI state (tips, chart checklists, section collapse).
 * Stored in localStorage for all sessions; mirrored to saved projects when active.
 */
import {
  chartProgressStorageKey,
  listChartProgressStorageEntries,
  readChartProgressBlob,
  writeChartProgressBlob,
} from "./chartProgressStorage";
import { dismissedTipsStorageKey } from "./patternTipDismiss";

export const SLEEVELESS_PATTERN_TIPS_STORAGE_KEY = "sleeveless-show-tips";

const SECTION_COLLAPSE_PREFIX = "sleevelessPattern_section_";

export type PatternReadingWorkflowChartState = {
  checkedRowIds: string[];
  hideCompleted: boolean;
};

export type PatternReadingWorkflowState = {
  tips?: {
    showAll: boolean;
    dismissedTipIds: string[];
  };
  charts?: Record<string, PatternReadingWorkflowChartState>;
  sections?: Record<string, boolean>;
};

export function emptyReadingWorkflowState(): PatternReadingWorkflowState {
  return {};
}

function readTipsShowAll(storageKey: string): boolean {
  if (typeof localStorage === "undefined") return true;
  try {
    return localStorage.getItem(storageKey) !== "false";
  } catch {
    return true;
  }
}

function readDismissedTipIds(storageKey: string): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(dismissedTipsStorageKey(storageKey));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string" && id.length > 0);
  } catch {
    return [];
  }
}

function collectSectionCollapse(): Record<string, boolean> {
  const sections: Record<string, boolean> = {};
  if (typeof localStorage === "undefined") return sections;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(SECTION_COLLAPSE_PREFIX)) continue;
      const sectionId = key.slice(SECTION_COLLAPSE_PREFIX.length);
      if (!sectionId) continue;
      sections[sectionId] = localStorage.getItem(key) === "true";
    }
  } catch {
    /* ignore */
  }
  return sections;
}

/** Snapshot sleeveless My Pattern workflow state from localStorage. */
export function collectSleevelessReadingWorkflow(patternId: string): PatternReadingWorkflowState {
  const tipsStorageKey = SLEEVELESS_PATTERN_TIPS_STORAGE_KEY;
  const charts: Record<string, PatternReadingWorkflowChartState> = {};
  for (const { chartId, key } of listChartProgressStorageEntries(patternId)) {
    const blob = readChartProgressBlob(key);
    charts[chartId] = {
      checkedRowIds: [...blob.checkedRowIds].sort(),
      hideCompleted: blob.hideCompleted,
    };
  }

  const sections = collectSectionCollapse();
  const state: PatternReadingWorkflowState = {
    tips: {
      showAll: readTipsShowAll(tipsStorageKey),
      dismissedTipIds: readDismissedTipIds(tipsStorageKey).sort(),
    },
    charts,
  };
  if (Object.keys(sections).length > 0) {
    state.sections = sections;
  }
  return state;
}

/** Restore workflow state into localStorage (does not touch pattern draft). */
export function applySleevelessReadingWorkflow(
  workflow: PatternReadingWorkflowState | undefined,
  patternId: string,
): void {
  if (typeof localStorage === "undefined" || !workflow) return;
  const tipsKey = SLEEVELESS_PATTERN_TIPS_STORAGE_KEY;

  if (workflow.tips) {
    try {
      localStorage.setItem(tipsKey, workflow.tips.showAll ? "true" : "false");
      localStorage.setItem(
        dismissedTipsStorageKey(tipsKey),
        JSON.stringify([...(workflow.tips.dismissedTipIds ?? [])].sort()),
      );
    } catch {
      /* quota */
    }
  }

  if (workflow.charts) {
    for (const [chartId, chartState] of Object.entries(workflow.charts)) {
      const key = chartProgressStorageKey(patternId, chartId);
      writeChartProgressBlob(key, {
        checkedRowIds: chartState.checkedRowIds ?? [],
        hideCompleted: !!chartState.hideCompleted,
      });
    }
  }

  if (workflow.sections) {
    try {
      for (const [sectionId, collapsed] of Object.entries(workflow.sections)) {
        localStorage.setItem(`${SECTION_COLLAPSE_PREFIX}${sectionId}`, collapsed ? "true" : "false");
      }
    } catch {
      /* ignore */
    }
  }
}

/** Merge workflow into DOM for tips visibility (scope must exist). */
export function applyTipsShowAllToScope(scope: HTMLElement, showAll: boolean): void {
  scope.setAttribute("data-show-tips", showAll ? "true" : "false");
}

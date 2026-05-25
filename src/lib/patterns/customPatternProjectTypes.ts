import type { SleevelessPatternRecord } from "./patternStorage";
import type { PatternReadingWorkflowState } from "./patternReadingWorkflow";

/** Pattern family key — extend when adding cardigans, hats, etc. */
export type CustomPatternFamily = "sleeveless";

export type { PatternReadingWorkflowState };

/** Where the project was started; does not change Express routes. */
export type CustomPatternProjectSource = "express" | "custom-build";

/**
 * Saved Custom Pattern project (Netlify Blobs).
 * `pattern` is the full `kbm_current_pattern` payload, including `measurements`.
 */
export interface CustomPatternProject {
  id: string;
  name: string;
  /** Optional project notes (mirrors `pattern.patternProject.notes`). */
  notes?: string;
  family: CustomPatternFamily;
  source: CustomPatternProjectSource;
  createdAt: string;
  updatedAt: string;
  version: number;
  pattern: SleevelessPatternRecord;
  /** Reserved for future per-field overrides; phase 1 uses empty object. */
  customOverrides: Record<string, unknown>;
  /** My Pattern reading UI: tips, chart checklists, section collapse (not structural pattern data). */
  readingWorkflow?: PatternReadingWorkflowState;
}

export type CustomPatternProjectSummary = Pick<
  CustomPatternProject,
  "id" | "name" | "family" | "source" | "createdAt" | "updatedAt" | "version"
>;

export type SaveCustomPatternProjectRequest = {
  name: string;
  notes?: string;
  family?: CustomPatternFamily;
  source?: CustomPatternProjectSource;
  pattern: SleevelessPatternRecord;
  customOverrides?: Record<string, unknown>;
};

export type UpdateCustomPatternProjectRequest = SaveCustomPatternProjectRequest & {
  id: string;
  version?: number;
};

/** Workflow-only patch — does not change pattern body or summary `updatedAt`. */
export type PatchCustomPatternReadingWorkflowRequest = {
  id: string;
  family?: CustomPatternFamily;
  workflowOnly: true;
  readingWorkflow: PatternReadingWorkflowState;
};

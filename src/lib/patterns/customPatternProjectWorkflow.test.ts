import { describe, expect, it } from "vitest";
import { summaryFromProject } from "../../../netlify/functions/lib/custom-pattern-projects-store.js";

describe("custom pattern project workflow saves", () => {
  it("summaryFromProject ignores readingWorkflow (updatedAt unchanged on workflow-only patch)", () => {
    const before = {
      id: "proj-1",
      name: "Vest",
      family: "sleeveless",
      source: "custom-build",
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T12:00:00.000Z",
      version: 2,
      readingWorkflow: { tips: { showAll: true, dismissedTipIds: [] } },
    };
    const afterWorkflowPatch = {
      ...before,
      readingWorkflow: { tips: { showAll: false, dismissedTipIds: ["t1"] } },
      updatedAt: before.updatedAt,
      version: before.version,
    };

    expect(summaryFromProject(before)).toEqual(summaryFromProject(afterWorkflowPatch));
  });
});

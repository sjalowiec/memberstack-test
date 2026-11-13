/**
 * Print/PDF heading for the finished Weekend Triangle Scarf page.
 * Saved scarves print the Custom Pattern project name. Unsaved temporary
 * scarves print "Weekend Triangle Scarf".
 */
import { readTriangleScarfDraft, type TriangleScarfDraft } from "./triangleScarfDraft";
import { TRIANGLE_SCARF_PATTERN_NAME } from "./triangleScarfNavigation";
import {
  isEditingSavedTriangleScarfProject,
  resolveTriangleScarfSavedPatternName,
} from "./triangleScarfSavedProject";

export const TRIANGLE_SCARF_PATTERN_PRINT_TITLE = TRIANGLE_SCARF_PATTERN_NAME;

export type TriangleScarfPatternPrintFields = {
  title: string;
  notes: string;
};

function isSavedScarfSession(draft: TriangleScarfDraft | null | undefined, isSaved?: boolean): boolean {
  if (typeof isSaved === "boolean") return isSaved;
  const customized = draft?.patternProject?.titleCustomized === true;
  if (customized && draft?.patternProject?.title?.trim()) return true;
  return isEditingSavedTriangleScarfProject() && Boolean(resolveTriangleScarfSavedPatternName(draft));
}

export function resolveTriangleScarfPatternPrintFields(input: {
  draft?: TriangleScarfDraft | null;
  isSaved?: boolean;
} = {}): TriangleScarfPatternPrintFields {
  const draft = input.draft !== undefined ? input.draft : readTriangleScarfDraft();
  const savedName = resolveTriangleScarfSavedPatternName(draft);
  if (isSavedScarfSession(draft, input.isSaved) && savedName) {
    return {
      title: savedName,
      notes: draft?.patternProject?.notes?.trim() ?? "",
    };
  }
  return { title: TRIANGLE_SCARF_PATTERN_PRINT_TITLE, notes: "" };
}

export function resolveTriangleScarfPatternOnlineHeading(
  draft: TriangleScarfDraft | null | undefined = typeof localStorage !== "undefined"
    ? readTriangleScarfDraft()
    : null,
): string {
  if (isSavedScarfSession(draft)) {
    const name = resolveTriangleScarfSavedPatternName(draft);
    if (name) return name;
  }
  return TRIANGLE_SCARF_PATTERN_PRINT_TITLE;
}

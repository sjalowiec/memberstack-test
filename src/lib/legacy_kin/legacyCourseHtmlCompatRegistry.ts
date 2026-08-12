/**
 * Hard-limited Course 111 legacy HTML compat experiment registry.
 * Only the explicitly listed lessons are allowed — not a general pipeline.
 */
import learnAbout from "../../data/legacy_kin/experiments/course_111_learn-about-the-machine.raw-html.json";
import automaticPatterning from "../../data/legacy_kin/experiments/course_111_automatic-stitch-patterning.raw-html.json";

export const LEGACY_COMPAT_COURSE_SLUG =
  "mastering-the-silver-reed-sk840-a-comprehensive-course";

export type LegacyCompatFixture = {
  schemaVersion: number;
  kind: string;
  courseId: number;
  courseSlug: string;
  lessonTitle: string;
  lessonSlug: string;
  legacyItemId?: number;
  source?: string;
  note?: string;
  extractedAt?: string;
  whySelected?: string[];
  bootstrapEvidence?: { versionGuess?: string; reasons?: string[] };
  classCounts?: Record<string, number>;
  nonBootstrapMarkup?: Array<{
    kind: string;
    componentId?: string;
    blockTitle?: string;
    componentType?: string;
    reason: string;
  }>;
  combinedHtml: string;
};

const FIXTURES: Record<string, LegacyCompatFixture> = {
  "learn-about-the-machine": learnAbout as LegacyCompatFixture,
  "automatic-stitch-patterning": automaticPatterning as LegacyCompatFixture,
};

export function getLegacyCompatFixture(
  courseSlug: string,
  lessonSlug: string,
): LegacyCompatFixture | null {
  if (courseSlug !== LEGACY_COMPAT_COURSE_SLUG) return null;
  return FIXTURES[lessonSlug] ?? null;
}

export function listLegacyCompatLessonSlugs(): string[] {
  return Object.keys(FIXTURES);
}

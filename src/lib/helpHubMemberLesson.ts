import { filterPublicHelpHubTips, type HelpHubTipRecord } from "./helpHubPublic";

/** Minimal lesson fields used by Help Hub member-lesson resolution and gating. */
export type HelpHubLessonRecord = {
  id?: number | string;
  slug?: string;
  title?: string;
  summary?: string;
  access?: string;
  status?: string;
};

export type HelpHubMemberLessonCard = {
  tipSlug: string;
  lessonSlug: string;
  lessonId: number | null;
};

export function lessonNumericId(l: HelpHubLessonRecord): number | null {
  const rawId: unknown = l.id;
  if (typeof rawId === "number" && Number.isFinite(rawId)) return rawId;
  if (typeof rawId === "string" && /^\d+$/.test(rawId.trim())) {
    const n = Number(rawId.trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function lessonIdMatches(refNum: number, l: HelpHubLessonRecord): boolean {
  const nid = lessonNumericId(l);
  return nid !== null && nid === refNum;
}

export function resolveLessonFromRelatedRef(
  ref: string,
  allLessons: HelpHubLessonRecord[],
): HelpHubLessonRecord | undefined {
  const trimmed = ref.trim();
  if (!trimmed) return undefined;
  const bySlug = allLessons.find(
    (l) => typeof l.slug === "string" && l.slug.trim() === trimmed,
  );
  if (bySlug) return bySlug;
  if (/^\d+$/.test(trimmed)) {
    const idNum = Number(trimmed);
    if (Number.isFinite(idNum)) {
      return allLessons.find((l) => lessonIdMatches(idNum, l));
    }
  }
  return undefined;
}

/** Same rule as `src/pages/lessons/[slug].astro` `lessonIsPubliclyPublished`. */
export function lessonIsPubliclyPublished(l: HelpHubLessonRecord): boolean {
  const raw = l.status;
  if (raw === undefined || raw === null) return true;
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (s === "") return true;
  return s === "published";
}

function resolveLessonFromRelatedEntry(
  ref: string | number,
  allLessons: HelpHubLessonRecord[],
): HelpHubLessonRecord | undefined {
  if (typeof ref === "number" && Number.isFinite(ref)) {
    return allLessons.find((l) => lessonIdMatches(ref, l));
  }
  if (typeof ref === "string") {
    return resolveLessonFromRelatedRef(ref, allLessons);
  }
  return undefined;
}

function lessonsMatch(a: HelpHubLessonRecord, b: HelpHubLessonRecord): boolean {
  const slugA = typeof a.slug === "string" ? a.slug.trim() : "";
  const slugB = typeof b.slug === "string" ? b.slug.trim() : "";
  if (slugA && slugB && slugA === slugB) return true;
  const idA = lessonNumericId(a);
  const idB = lessonNumericId(b);
  return idA !== null && idB !== null && idA === idB;
}

/** Resolve a tip `relatedLessons[]` entry to published lesson rows. */
export function resolveHelpHubRelatedLessons(
  relatedLessons: (string | number)[] | undefined,
  lessonRecords: HelpHubLessonRecord[],
): HelpHubLessonRecord[] {
  if (!Array.isArray(relatedLessons)) return [];
  const resolved: HelpHubLessonRecord[] = [];
  for (const ref of relatedLessons) {
    const found = resolveLessonFromRelatedEntry(ref, lessonRecords);
    if (found && lessonIsPubliclyPublished(found)) {
      resolved.push(found);
    }
  }
  return resolved;
}

/** True when a lesson is linked from any public Help Hub tip's Member Lesson section. */
export function lessonIsLinkedFromPublicHelpHub(
  lesson: HelpHubLessonRecord,
  tips: HelpHubTipRecord[],
  allLessons: HelpHubLessonRecord[],
): boolean {
  for (const tip of filterPublicHelpHubTips(tips)) {
    if (!Array.isArray(tip.relatedLessons)) continue;
    for (const ref of tip.relatedLessons) {
      const linked = resolveLessonFromRelatedEntry(ref, allLessons);
      if (linked && lessonsMatch(linked, lesson)) return true;
    }
  }
  return false;
}

/**
 * True when `/lessons/[slug]` requires global member access.
 * Help Hub Member Lesson cards always gate their destination, including lessons
 * with a legacy `access: "free"` field.
 */
export function lessonRequiresMemberAccess(
  lesson: HelpHubLessonRecord,
  helpHubTips: HelpHubTipRecord[] = [],
  allLessons: HelpHubLessonRecord[] = [],
): boolean {
  if (lessonIsLinkedFromPublicHelpHub(lesson, helpHubTips, allLessons)) return true;
  const raw = typeof lesson.access === "string" ? lesson.access.trim().toLowerCase() : "";
  return raw !== "free";
}

/** Every public Help Hub tip that renders at least one Member Lesson card. */
export function listPublicHelpHubMemberLessonCards(
  tips: HelpHubTipRecord[],
  lessons: HelpHubLessonRecord[],
): HelpHubMemberLessonCard[] {
  const cards: HelpHubMemberLessonCard[] = [];
  for (const tip of filterPublicHelpHubTips(tips)) {
    const tipSlug = typeof tip.slug === "string" ? tip.slug.trim() : "";
    if (!tipSlug) continue;
    const resolved = resolveHelpHubRelatedLessons(tip.relatedLessons, lessons);
    for (const lesson of resolved) {
      const lessonSlug = typeof lesson.slug === "string" ? lesson.slug.trim() : "";
      if (!lessonSlug) continue;
      cards.push({
        tipSlug,
        lessonSlug,
        lessonId: lessonNumericId(lesson),
      });
    }
  }
  return cards;
}

import { catalogVideoIsPublic } from "../videoPublic";
import {
  describeRelatedLessonRefs,
  publishedLessonsForPicker,
  relatedLessonIdsForStorage,
  type HelpHubLessonRecord,
  type RelatedLessonPickerItem,
} from "../helpHubMemberLesson";
import { pickerStateFromRefs } from "./relatedLessonPicker";

export const LEARNING_LIBRARY_SOURCE = "library" as const;
export const MEMBER_LESSON_SOURCE = "lesson" as const;

export type MemberResourceSource = typeof LEARNING_LIBRARY_SOURCE | typeof MEMBER_LESSON_SOURCE;

export type HelpHubLibraryVideoRef = {
  type: "library";
  contentId: number;
};

export type MemberResourcePickerItem = {
  source: MemberResourceSource;
  id: number;
  title: string;
  slug: string;
};

export type SelectedMemberResource = {
  source: MemberResourceSource;
  id: number | null;
  title: string;
  slug: string;
  state: "published" | "unpublished" | "missing";
  ref?: string | number;
};

export type CatalogVideoForPicker = {
  content_id?: string | number;
  slug?: string;
  title?: string;
  status?: string;
};

export type HelpHubMemberResourceCard = {
  kind: MemberResourceSource;
  title: string;
  summary: string;
  href: string;
};

export function memberResourceSourceLabel(source: MemberResourceSource): string {
  return source === LEARNING_LIBRARY_SOURCE ? "Learning Library" : "Member Lesson";
}

function asPositiveInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return Math.trunc(value);
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    const n = Number(value.trim());
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
}

/** Store only catalog type + content id. Never copy Vimeo ids. */
export function normalizeRelatedLibraryVideos(value: unknown): HelpHubLibraryVideoRef[] {
  if (!Array.isArray(value)) return [];
  const out: HelpHubLibraryVideoRef[] = [];
  const seen = new Set<number>();
  for (const item of value) {
    let contentId: number | null = null;
    if (typeof item === "number" || typeof item === "string") {
      contentId = asPositiveInt(item);
    } else if (item && typeof item === "object" && !Array.isArray(item)) {
      const rec = item as Record<string, unknown>;
      contentId = asPositiveInt(rec.contentId ?? rec.content_id ?? rec.id);
    }
    if (contentId == null || seen.has(contentId)) continue;
    seen.add(contentId);
    out.push({ type: LEARNING_LIBRARY_SOURCE, contentId });
  }
  return out;
}

export function libraryVideoRefHasVimeoFields(ref: HelpHubLibraryVideoRef): boolean {
  return Object.keys(ref).some((key) => /vimeo/i.test(key));
}

export function libraryVideosForPicker(videos: unknown): MemberResourcePickerItem[] {
  const list = Array.isArray(videos) ? videos : [];
  const items: MemberResourcePickerItem[] = [];
  for (const video of list) {
    if (!video || typeof video !== "object" || Array.isArray(video)) continue;
    const row = video as CatalogVideoForPicker;
    if (!catalogVideoIsPublic(row)) continue;
    const id = asPositiveInt(row.content_id);
    if (id == null) continue;
    const title =
      typeof row.title === "string" && row.title.trim()
        ? row.title.trim()
        : `Lesson ${id}`;
    const slug = typeof row.slug === "string" ? row.slug.trim() : "";
    items.push({
      source: LEARNING_LIBRARY_SOURCE,
      id,
      title,
      slug,
    });
  }
  return items.sort((a, b) => a.title.localeCompare(b.title) || a.id - b.id);
}

export function memberLessonsForResourcePicker(
  lessons: HelpHubLessonRecord[],
): MemberResourcePickerItem[] {
  return publishedLessonsForPicker(lessons).map((item: RelatedLessonPickerItem) => ({
    source: MEMBER_LESSON_SOURCE,
    id: item.id,
    title: item.title,
    slug: item.slug,
  }));
}

export function combinedMemberResourcePickerItems(
  lessons: HelpHubLessonRecord[],
  videos: unknown,
): MemberResourcePickerItem[] {
  return [...libraryVideosForPicker(videos), ...memberLessonsForResourcePicker(lessons)].sort(
    (a, b) => a.title.localeCompare(b.title) || a.id - b.id,
  );
}

export function filterMemberResourcePickerItems(
  items: MemberResourcePickerItem[],
  query: string,
): MemberResourcePickerItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => {
    return (
      item.title.toLowerCase().includes(q) ||
      String(item.id).includes(q) ||
      item.slug.toLowerCase().includes(q)
    );
  });
}

export type MemberResourceSelection = {
  lessonIds: number[];
  unresolvedLessons: (string | number)[];
  libraryContentIds: number[];
};

export function selectionFromStoredResources(
  relatedLessons: (string | number)[] | undefined,
  relatedLibraryVideos: unknown,
  lessons: HelpHubLessonRecord[],
  libraryItems: MemberResourcePickerItem[],
): MemberResourceSelection {
  const lessonState = pickerStateFromRefs(relatedLessons, lessons);
  const libraryContentIds: number[] = [];
  const publishedLibraryIds = new Set(
    libraryItems.filter((item) => item.source === LEARNING_LIBRARY_SOURCE).map((item) => item.id),
  );
  for (const ref of normalizeRelatedLibraryVideos(relatedLibraryVideos)) {
    if (publishedLibraryIds.has(ref.contentId) && !libraryContentIds.includes(ref.contentId)) {
      libraryContentIds.push(ref.contentId);
    }
  }
  return {
    lessonIds: lessonState.selectedIds,
    unresolvedLessons: lessonState.unresolved,
    libraryContentIds,
  };
}

export function serializeMemberResources(selection: MemberResourceSelection): {
  relatedLessons: (string | number)[];
  relatedLibraryVideos: HelpHubLibraryVideoRef[];
} {
  return {
    relatedLessons: relatedLessonIdsForStorage(selection.lessonIds, selection.unresolvedLessons),
    relatedLibraryVideos: normalizeRelatedLibraryVideos(selection.libraryContentIds),
  };
}

export function describeSelectedMemberResources(
  selection: MemberResourceSelection,
  lessons: HelpHubLessonRecord[],
  libraryItems: MemberResourcePickerItem[],
): SelectedMemberResource[] {
  const libraryById = new Map(
    libraryItems.filter((item) => item.source === LEARNING_LIBRARY_SOURCE).map((item) => [item.id, item]),
  );
  const selected: SelectedMemberResource[] = [];
  for (const id of selection.libraryContentIds) {
    const item = libraryById.get(id);
    selected.push({
      source: LEARNING_LIBRARY_SOURCE,
      id,
      title: item?.title || `Lesson ${id}`,
      slug: item?.slug || "",
      state: item ? "published" : "missing",
    });
  }
  for (const view of describeRelatedLessonRefs(
    relatedLessonIdsForStorage(selection.lessonIds, selection.unresolvedLessons),
    lessons,
  )) {
    selected.push({
      source: MEMBER_LESSON_SOURCE,
      id: view.id,
      title: view.title,
      slug: view.slug,
      state: view.state,
      ref: view.ref,
    });
  }
  return selected;
}

export function selectedResourceConfirmation(resource: SelectedMemberResource): string {
  const idLabel = resource.id != null ? String(resource.id) : String(resource.ref ?? "");
  return `Selected member lesson: ${idLabel} — ${resource.title}`;
}

type CatalogVideoForCard = CatalogVideoForPicker & {
  description?: string;
  summary?: string;
};

export function resolveRelatedLibraryVideoCards(
  relatedLibraryVideos: unknown,
  videos: unknown,
  options: { tipSlug?: string } = {},
): HelpHubMemberResourceCard[] {
  const list = Array.isArray(videos) ? videos : [];
  const hub = typeof options.tipSlug === "string" ? options.tipSlug.trim() : "";
  const cards: HelpHubMemberResourceCard[] = [];
  for (const ref of normalizeRelatedLibraryVideos(relatedLibraryVideos)) {
    const row = list.find((video) => {
      if (!video || typeof video !== "object" || Array.isArray(video)) return false;
      return asPositiveInt((video as CatalogVideoForCard).content_id) === ref.contentId;
    }) as CatalogVideoForCard | undefined;
    if (!row || !catalogVideoIsPublic(row)) continue;
    const title =
      typeof row.title === "string" && row.title.trim() ? row.title.trim() : `Lesson ${ref.contentId}`;
    const summary =
      (typeof row.summary === "string" && row.summary.trim()) ||
      (typeof row.description === "string" && row.description.trim()) ||
      "";
    const href = hub
      ? `/videos/${ref.contentId}?from=help-hub&hub=${encodeURIComponent(hub)}`
      : `/videos/${ref.contentId}`;
    cards.push({
      kind: LEARNING_LIBRARY_SOURCE,
      title,
      summary,
      href,
    });
  }
  return cards;
}

export function memberLessonCardsFromResolved(
  lessons: HelpHubLessonRecord[],
  options: { tipSlug?: string } = {},
): HelpHubMemberResourceCard[] {
  const hub = typeof options.tipSlug === "string" ? options.tipSlug.trim() : "";
  return lessons.map((lesson) => {
    const lessonSlug = typeof lesson.slug === "string" ? lesson.slug.trim() : "";
    const title =
      typeof lesson.title === "string" && lesson.title.trim()
        ? lesson.title.trim()
        : lessonSlug || "Member Lesson";
    const summary = typeof lesson.summary === "string" ? lesson.summary.trim() : "";
    const href =
      lessonSlug.length > 0
        ? hub
          ? `/lessons/${lessonSlug}?from=help-hub&hub=${encodeURIComponent(hub)}`
          : `/lessons/${lessonSlug}`
        : hub
          ? `/lessons?from=help-hub&hub=${encodeURIComponent(hub)}`
          : "/lessons";
    return {
      kind: MEMBER_LESSON_SOURCE,
      title,
      summary,
      href,
    };
  });
}

export function pickerPayloadIsSafeForAdmin(payload: unknown): boolean {
  const text = JSON.stringify(payload);
  return !/vimeo/i.test(text);
}

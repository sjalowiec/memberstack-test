import { catalogVideoIsPublic } from "../videoPublic";
import {
  describeRelatedLessonRefs,
  lessonNumericId,
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
  resourceId?: number;
};

export type MemberResourceOrderRef = {
  source: MemberResourceSource;
  id: number;
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

export const MEMBER_RESOURCE_SEARCH_MIN_CHARS = 2;
export const MEMBER_RESOURCE_SEARCH_LIMIT = 8;

function memberResourceSearchHaystack(item: MemberResourcePickerItem): string {
  const id = String(item.id);
  const slug = item.slug.toLowerCase();
  const paths =
    item.source === LEARNING_LIBRARY_SOURCE
      ? [`/videos/${id}`, slug ? `/videos/${slug}` : ""]
      : [slug ? `/lessons/${slug}` : "", `/lessons/${id}`];
  return [item.title.toLowerCase(), id, slug, ...paths].filter(Boolean).join(" ");
}

export function filterMemberResourcePickerItems(
  items: MemberResourcePickerItem[],
  query: string,
): MemberResourcePickerItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => {
    if (memberResourceSearchHaystack(item).includes(q)) return true;
    const id = String(item.id);
    const slug = item.slug.toLowerCase();
    if (q.includes(`/videos/${id}`) || q.includes(`/lessons/${id}`)) return true;
    return slug.length > 0 && (q.includes(`/videos/${slug}`) || q.includes(`/lessons/${slug}`));
  });
}

/** Search results for the admin picker: empty until 2 characters, then a short list. */
export function memberResourcePickerResults(
  items: MemberResourcePickerItem[],
  query: string,
  options: { minChars?: number; limit?: number } = {},
): MemberResourcePickerItem[] {
  const minChars = options.minChars ?? MEMBER_RESOURCE_SEARCH_MIN_CHARS;
  const limit = options.limit ?? MEMBER_RESOURCE_SEARCH_LIMIT;
  const q = query.trim();
  if (q.length < minChars) return [];
  const matches = filterMemberResourcePickerItems(items, q);
  const needle = q.toLowerCase();
  const exactId = matches.filter((item) => String(item.id) === needle);
  const rest = matches.filter((item) => String(item.id) !== needle);
  return [...exactId, ...rest].slice(0, limit);
}

export function memberResourceOptionLabel(item: MemberResourcePickerItem): string {
  return `${item.id} — ${item.title}`;
}

export type MemberResourceSelection = {
  lessonIds: number[];
  unresolvedLessons: (string | number)[];
  libraryContentIds: number[];
  /** Display order for resolved lessons. Omitted selections fall back to library, then lessons. */
  order?: MemberResourceOrderRef[];
};

export function normalizeMemberResourceOrder(value: unknown): MemberResourceOrderRef[] {
  if (!Array.isArray(value)) return [];
  const out: MemberResourceOrderRef[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const rec = item as Record<string, unknown>;
    const source =
      rec.source === LEARNING_LIBRARY_SOURCE || rec.source === MEMBER_LESSON_SOURCE
        ? rec.source
        : null;
    const id = asPositiveInt(rec.id);
    if (!source || id == null) continue;
    const key = `${source}:${id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ source, id });
  }
  return out;
}

function selectionWithOrder(
  unresolvedLessons: (string | number)[],
  order: MemberResourceOrderRef[],
): MemberResourceSelection {
  return {
    order,
    unresolvedLessons,
    lessonIds: order.filter((ref) => ref.source === MEMBER_LESSON_SOURCE).map((ref) => ref.id),
    libraryContentIds: order
      .filter((ref) => ref.source === LEARNING_LIBRARY_SOURCE)
      .map((ref) => ref.id),
  };
}

/** Resolved lessons in the order authors will see and save. */
export function selectionDisplayOrder(selection: MemberResourceSelection): MemberResourceOrderRef[] {
  const explicit = normalizeMemberResourceOrder(selection.order);
  if (explicit.length) return explicit;
  return normalizeMemberResourceOrder([
    ...selection.libraryContentIds.map((id) => ({ source: LEARNING_LIBRARY_SOURCE, id })),
    ...selection.lessonIds.map((id) => ({ source: MEMBER_LESSON_SOURCE, id })),
  ]);
}

export function selectionFromStoredResources(
  relatedLessons: (string | number)[] | undefined,
  relatedLibraryVideos: unknown,
  lessons: HelpHubLessonRecord[],
  libraryItems: MemberResourcePickerItem[],
  memberResourceOrder?: unknown,
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
  const lessonSet = new Set(lessonState.selectedIds);
  const librarySet = new Set(libraryContentIds);
  const order: MemberResourceOrderRef[] = [];
  const seen = new Set<string>();
  for (const ref of normalizeMemberResourceOrder(memberResourceOrder)) {
    const available = ref.source === LEARNING_LIBRARY_SOURCE ? librarySet : lessonSet;
    const key = `${ref.source}:${ref.id}`;
    if (!available.has(ref.id) || seen.has(key)) continue;
    seen.add(key);
    order.push(ref);
  }
  for (const id of libraryContentIds) {
    const key = `${LEARNING_LIBRARY_SOURCE}:${id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    order.push({ source: LEARNING_LIBRARY_SOURCE, id });
  }
  for (const id of lessonState.selectedIds) {
    const key = `${MEMBER_LESSON_SOURCE}:${id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    order.push({ source: MEMBER_LESSON_SOURCE, id });
  }
  return selectionWithOrder(lessonState.unresolved, order);
}

export function serializeMemberResources(selection: MemberResourceSelection): {
  relatedLessons: (string | number)[];
  relatedLibraryVideos: HelpHubLibraryVideoRef[];
  memberResourceOrder: MemberResourceOrderRef[];
} {
  const order = selectionDisplayOrder(selection);
  return {
    relatedLessons: relatedLessonIdsForStorage(
      order.filter((ref) => ref.source === MEMBER_LESSON_SOURCE).map((ref) => ref.id),
      selection.unresolvedLessons,
    ),
    relatedLibraryVideos: normalizeRelatedLibraryVideos(
      order.filter((ref) => ref.source === LEARNING_LIBRARY_SOURCE).map((ref) => ref.id),
    ),
    memberResourceOrder: order,
  };
}

export function addMemberResource(
  selection: MemberResourceSelection,
  item: MemberResourcePickerItem,
): MemberResourceSelection {
  const order = selectionDisplayOrder(selection);
  if (order.some((ref) => ref.source === item.source && ref.id === item.id)) return selection;
  return selectionWithOrder(selection.unresolvedLessons, [
    ...order,
    { source: item.source, id: item.id },
  ]);
}

export function removeMemberResourceAt(
  selection: MemberResourceSelection,
  index: number,
): MemberResourceSelection {
  const order = [...selectionDisplayOrder(selection)];
  if (index >= 0 && index < order.length) {
    order.splice(index, 1);
    return selectionWithOrder(selection.unresolvedLessons, order);
  }
  const unresolvedIndex = index - order.length;
  if (unresolvedIndex < 0 || unresolvedIndex >= selection.unresolvedLessons.length) return selection;
  return selectionWithOrder(
    selection.unresolvedLessons.filter((_, itemIndex) => itemIndex !== unresolvedIndex),
    order,
  );
}

export function moveMemberResource(
  selection: MemberResourceSelection,
  index: number,
  delta: -1 | 1,
): MemberResourceSelection {
  const order = [...selectionDisplayOrder(selection)];
  const target = index + delta;
  if (index < 0 || target < 0 || index >= order.length || target >= order.length) return selection;
  const [item] = order.splice(index, 1);
  if (!item) return selection;
  order.splice(target, 0, item);
  return selectionWithOrder(selection.unresolvedLessons, order);
}

export function describeSelectedMemberResources(
  selection: MemberResourceSelection,
  lessons: HelpHubLessonRecord[],
  libraryItems: MemberResourcePickerItem[],
): SelectedMemberResource[] {
  const libraryById = new Map(
    libraryItems.filter((item) => item.source === LEARNING_LIBRARY_SOURCE).map((item) => [item.id, item]),
  );
  const lessonViews = describeRelatedLessonRefs(
    relatedLessonIdsForStorage(selection.lessonIds, selection.unresolvedLessons),
    lessons,
  );
  const selected: SelectedMemberResource[] = [];
  for (const ref of selectionDisplayOrder(selection)) {
    if (ref.source === LEARNING_LIBRARY_SOURCE) {
      const item = libraryById.get(ref.id);
      selected.push({
        source: LEARNING_LIBRARY_SOURCE,
        id: ref.id,
        title: item?.title || `Lesson ${ref.id}`,
        slug: item?.slug || "",
        state: item ? "published" : "missing",
      });
      continue;
    }
    const view =
      lessonViews.find((item) => item.id === ref.id && item.state === "published") ??
      lessonViews.find((item) => item.id === ref.id);
    selected.push({
      source: MEMBER_LESSON_SOURCE,
      id: view?.id ?? ref.id,
      title: view?.title || `Lesson ${ref.id}`,
      slug: view?.slug || "",
      state: view?.state ?? "missing",
      ref: view?.ref ?? ref.id,
    });
  }
  for (const view of lessonViews) {
    const alreadyListed = selected.some(
      (item) =>
        item.source === MEMBER_LESSON_SOURCE &&
        ((view.id != null && item.id === view.id) || String(item.ref ?? "") === String(view.ref)),
    );
    if (alreadyListed) continue;
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

export function selectedLessonNumberLabel(resource: SelectedMemberResource): string {
  const raw = resource.id != null ? String(resource.id) : String(resource.ref ?? "").trim();
  return raw ? `Lesson ${raw}` : "";
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
      resourceId: ref.contentId,
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
      resourceId: lessonNumericId(lesson) ?? undefined,
    };
  });
}

/** Preview and published pages follow the saved order, then any lesson not listed in it. */
export function orderedMemberResourceCards(
  libraryCards: HelpHubMemberResourceCard[],
  lessonCards: HelpHubMemberResourceCard[],
  order: unknown,
): HelpHubMemberResourceCard[] {
  const refs = normalizeMemberResourceOrder(order);
  const pool = [...libraryCards, ...lessonCards];
  if (!refs.length) return pool;
  const used = new Set<HelpHubMemberResourceCard>();
  const ordered: HelpHubMemberResourceCard[] = [];
  for (const ref of refs) {
    const match = pool.find(
      (card) => !used.has(card) && card.kind === ref.source && card.resourceId === ref.id,
    );
    if (!match) continue;
    used.add(match);
    ordered.push(match);
  }
  for (const card of pool) {
    if (!used.has(card)) ordered.push(card);
  }
  return ordered;
}

export function pickerPayloadIsSafeForAdmin(payload: unknown): boolean {
  const text = JSON.stringify(payload);
  return !/vimeo/i.test(text);
}

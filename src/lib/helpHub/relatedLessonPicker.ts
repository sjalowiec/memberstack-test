import type { RelatedLessonPickerItem, RelatedLessonRefView } from "../helpHubMemberLesson";
import {
  describeRelatedLessonRefs,
  publishedLessonsForPicker,
  relatedLessonIdsForStorage,
  type HelpHubLessonRecord,
} from "../helpHubMemberLesson";

export type RelatedLessonPickerState = {
  selectedIds: number[];
  unresolved: (string | number)[];
};

export function pickerStateFromRefs(
  relatedLessons: (string | number)[] | undefined,
  allLessons: HelpHubLessonRecord[],
): RelatedLessonPickerState {
  const views = describeRelatedLessonRefs(relatedLessons, allLessons);
  const selectedIds: number[] = [];
  const unresolved: (string | number)[] = [];
  for (const view of views) {
    if (view.state === "published" && view.id != null) {
      selectedIds.push(view.id);
    } else {
      unresolved.push(view.ref);
    }
  }
  return { selectedIds, unresolved };
}

export function serializeRelatedLessons(state: RelatedLessonPickerState): (string | number)[] {
  return relatedLessonIdsForStorage(state.selectedIds, state.unresolved);
}

export function filterPickerItems(
  items: RelatedLessonPickerItem[],
  query: string,
): RelatedLessonPickerItem[] {
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

export { describeRelatedLessonRefs, publishedLessonsForPicker };
export type { RelatedLessonPickerItem, RelatedLessonRefView };

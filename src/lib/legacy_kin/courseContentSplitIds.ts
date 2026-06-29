export function slugifyLessonPart(baseSlug: string, partNumber: number, title?: string): string {
  const fromTitle = title
    ? title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 48)
    : "";

  if (fromTitle && fromTitle !== baseSlug && !fromTitle.startsWith(`${baseSlug}-`)) {
    return `${baseSlug}-${fromTitle}`.slice(0, 80);
  }
  return `${baseSlug}-part-${partNumber}`;
}

export function maxLegacyComponentIdFromLessons(
  lessons: { blocks: { components: { legacyComponentId: number }[] }[] }[],
): number {
  let max = 0;
  for (const lesson of lessons) {
    for (const block of lesson.blocks) {
      for (const component of block.components) {
        const id = Number(component.legacyComponentId);
        if (Number.isFinite(id) && id > max) max = id;
      }
    }
  }
  return max;
}

export function maxAssignIdFromLessons(
  lessons: { blocks: { legacy?: { assignId?: number } }[] }[],
): number {
  let max = 0;
  for (const lesson of lessons) {
    for (const block of lesson.blocks) {
      const id = Number(block.legacy?.assignId ?? 0);
      if (Number.isFinite(id) && id > max) max = id;
    }
  }
  return max;
}

export function createIdAllocator(initialMax: number) {
  let next = initialMax;
  return () => {
    next += 1;
    return next;
  };
}

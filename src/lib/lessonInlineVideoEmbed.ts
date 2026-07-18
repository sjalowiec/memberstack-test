/**
 * Non-blocks lesson video embed: inline mediaType/mediaUrl, or catalog
 * type:"video" + videoSlug resolved to vimeoPlayerSrc.
 */
export function lessonNonBlocksEmbedSrc(options: {
  inlineVimeoSrc: string | null | undefined;
  hasLessonVideo: boolean;
  vimeoPlayerSrc: string;
}): string | null {
  const inline =
    typeof options.inlineVimeoSrc === "string" && options.inlineVimeoSrc.trim()
      ? options.inlineVimeoSrc.trim()
      : null;
  if (inline) return inline;
  if (!options.hasLessonVideo) return null;
  const catalog =
    typeof options.vimeoPlayerSrc === "string" ? options.vimeoPlayerSrc.trim() : "";
  return catalog || null;
}

/**
 * Sidebar thumb is redundant when the non-blocks path already shows the same
 * video in `.lesson-video-frame`.
 */
export function lessonShowsSidebarVideoThumb(options: {
  hasLessonBlocks: boolean;
  hasLessonVideo: boolean;
  embedSrc: string | null;
}): boolean {
  if (!options.hasLessonBlocks && options.embedSrc) return false;
  return options.hasLessonVideo;
}

/** Markup shape the non-blocks path must emit for a resolved embed URL. */
export function lessonNonBlocksVideoFrameMarkup(
  embedSrc: string,
  title: string,
): string {
  const safeTitle = title.trim() || "Lesson video";
  return [
    `<div class="lesson-block lesson-video-block">`,
    `<div class="lesson-video-frame lesson-video-frame--modal-trigger">`,
    `<iframe`,
    `src="${embedSrc}"`,
    `title="${safeTitle}"`,
    `/>`,
    `<button`,
    `class="lesson-video-frame__open"`,
    `data-player-src="${embedSrc}"`,
    `/>`,
    `</div>`,
    `</div>`,
  ].join("");
}

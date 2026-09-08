import videosPublic from "../../data/videos-public.json";
import {
  findPublicVideoByKey,
  vimeoNumericIdFromPublicVideo,
  type PublicVideoRow,
} from "../lessonVideo";
import {
  findPublicHelpHubTipBySlug,
  type HelpHubTipRecord,
} from "../helpHubPublic";
import { filterPublicCatalogVideos } from "../videoPublic";
import { catalogVideoPlaybackAccess } from "../videos/catalogVideoPlaybackAccess";
import { lessonRequiresMemberAccess, type HelpHubLessonRecord } from "../helpHubMemberLesson";
import type { MemberLessonRecord } from "./types";
import type {
  LessonBodyBlock,
  LessonLibraryVideoEmbed,
  PreparedLessonPage,
} from "./prepareLessonPageTypes";

export type { LessonBodyBlock, LessonLibraryVideoEmbed, PreparedLessonPage };

function lessonVimeoNumericId(l: MemberLessonRecord, catalogVideos: PublicVideoRow[]): string | null {
  const key = typeof l.videoSlug === "string" ? l.videoSlug.trim() : "";
  if (key) {
    const v = findPublicVideoByKey(catalogVideos, key);
    if (v) {
      const id = vimeoNumericIdFromPublicVideo(v);
      if (id) return id;
    }
  }
  const rawV = l.vimeoEmbedUrl;
  const raw =
    typeof rawV === "number" && Number.isFinite(rawV)
      ? String(Math.trunc(rawV))
      : typeof rawV === "string"
        ? rawV.trim()
        : "";
  if (!raw) return null;
  if (/^\d+$/.test(raw)) return raw;
  const m = raw.match(/\/(?:video\/)?(\d+)(?:\?|#|$)/);
  return m ? m[1] : null;
}

function lessonMatchesRelatedRef(ref: string, current: MemberLessonRecord, catalogVideos: PublicVideoRow[]): boolean {
  const trimmed = ref.trim();
  if (!trimmed) return false;
  if (typeof current.slug === "string" && current.slug.trim() === trimmed) return true;
  if (/^\d+$/.test(trimmed)) return lessonVimeoNumericId(current, catalogVideos) === trimmed;
  return false;
}

function lessonMatchesRelatedLessonRef(
  ref: unknown,
  current: MemberLessonRecord,
  catalogVideos: PublicVideoRow[],
): boolean {
  if (typeof ref === "number" && Number.isFinite(ref)) {
    return current.id === ref;
  }
  if (typeof ref === "string") {
    return lessonMatchesRelatedRef(ref, current, catalogVideos);
  }
  return false;
}

function vimeoPlayerUrlFromRawId(rawUnknown: unknown): string | null {
  const raw =
    typeof rawUnknown === "number" && Number.isFinite(rawUnknown)
      ? String(Math.trunc(rawUnknown))
      : typeof rawUnknown === "string"
        ? rawUnknown
        : "";
  if (!raw) return null;
  return `https://player.vimeo.com/video/${raw}`;
}

function lessonBlockIsRenderable(block: unknown): block is LessonBodyBlock {
  if (!block || typeof block !== "object") return false;
  const b = block as LessonBodyBlock;
  if (b.type === "text") {
    return typeof b.content === "string" && b.content.trim() !== "";
  }
  if (b.type === "vimeo") {
    return vimeoPlayerUrlFromRawId(b.vimeoId) !== null;
  }
  return false;
}

function resolveLessonLibraryVideo(
  videos: PublicVideoRow[],
  slugKey: string,
): LessonLibraryVideoEmbed | null {
  const k = slugKey.trim();
  if (!k) return null;
  const row = findPublicVideoByKey(videos, k);
  if (!row) return null;
  const videoId = vimeoNumericIdFromPublicVideo(row);
  if (!videoId) return null;
  const title =
    typeof row.title === "string" && row.title.trim() !== "" ? row.title.trim() : "Video";
  const contentId =
    row.content_id != null && String(row.content_id).trim() ? String(row.content_id).trim() : undefined;
  return {
    key: k,
    title,
    videoId,
    contentId,
    access_level: catalogVideoPlaybackAccess(row),
  };
}

export async function prepareLessonPage(
  lesson: MemberLessonRecord,
  options: {
    requestUrl: URL;
    helpHubTips: HelpHubTipRecord[];
    allLessons?: HelpHubLessonRecord[];
    catalogVideos?: PublicVideoRow[];
    preview?: boolean;
  },
): Promise<PreparedLessonPage> {
  const helpHubTips = options.helpHubTips;
  const catalogVideos =
    options.catalogVideos ??
    filterPublicCatalogVideos(Array.isArray(videosPublic) ? (videosPublic as PublicVideoRow[]) : []);
  const allLessons = options.allLessons ?? [];

  const url = options.requestUrl;
  const from = url.searchParams.get("from");
  const hubSlugParam = url.searchParams.get("hub");
  const hubTipForBackLink =
    typeof hubSlugParam === "string" && hubSlugParam.trim() !== ""
      ? findPublicHelpHubTipBySlug(helpHubTips, hubSlugParam)
      : undefined;
  const hubSlug =
    hubTipForBackLink && typeof hubTipForBackLink.slug === "string"
      ? hubTipForBackLink.slug.trim()
      : "";
  const showHelpHubBackLink = from === "help-hub" && hubSlug.length > 0;

  const requiresMemberAccess = options.preview
    ? false
    : lessonRequiresMemberAccess(lesson, helpHubTips, allLessons);

  function findTipForLesson(lessonRow: MemberLessonRecord): HelpHubTipRecord | undefined {
    const explicit = typeof lessonRow.relatedTipSlug === "string" ? lessonRow.relatedTipSlug.trim() : "";
    if (explicit) {
      return helpHubTips.find((t) => typeof t.slug === "string" && t.slug.trim() === explicit);
    }
    return helpHubTips.find(
      (t) =>
        Array.isArray(t.relatedLessons) &&
        t.relatedLessons.some((r) => lessonMatchesRelatedLessonRef(r, lessonRow, catalogVideos)),
    );
  }

  const relatedHelpHubsResolved: HelpHubTipRecord[] = [];
  if (Array.isArray(lesson.relatedHelpHubs)) {
    for (const ref of lesson.relatedHelpHubs) {
      if (typeof ref === "number") {
        const found = helpHubTips.find((h) => h.id === ref);
        if (found) relatedHelpHubsResolved.push(found);
      } else if (typeof ref === "string") {
        const found = helpHubTips.find(
          (h) => typeof h.slug === "string" && h.slug.trim() === ref.trim(),
        );
        if (found) relatedHelpHubsResolved.push(found);
      }
    }
  }

  const relatedTip = relatedHelpHubsResolved[0] ?? findTipForLesson(lesson);
  const relatedTipSlug =
    relatedTip && typeof relatedTip.slug === "string" && relatedTip.slug.trim() !== ""
      ? relatedTip.slug.trim()
      : null;
  const relatedTipHref = relatedTipSlug ? `/help-hub/${relatedTipSlug}` : null;

  const backToTipHref = showHelpHubBackLink && hubSlug ? `/help-hub/${hubSlug.trim()}` : "";
  const backToTipLabelLine =
    relatedTip && typeof relatedTip.question === "string" && relatedTip.question.trim() !== ""
      ? relatedTip.question.trim()
      : relatedTip && typeof relatedTip.title === "string" && relatedTip.title.trim() !== ""
        ? relatedTip.title.trim()
        : "";
  const backToTipLabel = backToTipLabelLine ? `Back to: ${backToTipLabelLine}` : "Back to Tip";

  function lessonVimeoPlayerSrc(l: MemberLessonRecord): string {
    const id = lessonVimeoNumericId(l, catalogVideos);
    if (id) return `https://player.vimeo.com/video/${id}`;
    const rawV = l.vimeoEmbedUrl;
    const raw = typeof rawV === "string" ? rawV.trim() : "";
    if (raw && /^https?:\/\//i.test(raw)) return raw;
    return "";
  }

  const vimeoPlayerSrc = lessonVimeoPlayerSrc(lesson);
  const hasLessonVideo = lesson.type === "video" && vimeoPlayerSrc.length > 0;

  function inlineLessonVimeoSrc(l: MemberLessonRecord): string | null {
    const mt = typeof l.mediaType === "string" ? l.mediaType.trim().toLowerCase() : "";
    if (mt !== "vimeo") return null;
    const raw = typeof l.mediaUrl === "string" ? l.mediaUrl.trim() : "";
    if (!raw) return null;
    return vimeoPlayerUrlFromRawId(raw);
  }

  const inlineVimeoSrc = inlineLessonVimeoSrc(lesson);
  const lessonBlocks = Array.isArray(lesson.blocks) ? (lesson.blocks as LessonBodyBlock[]) : [];
  const hasLessonBlocks = lessonBlocks.length > 0;
  const renderableLessonBlocks = lessonBlocks.filter(lessonBlockIsRenderable);
  const hasRenderableLessonBlocks = renderableLessonBlocks.length > 0;
  const hasRenderableBlockVideos = renderableLessonBlocks.some((block) => block.type === "vimeo");

  const summaryHtml =
    typeof lesson.summary === "string" && lesson.summary.trim() !== ""
      ? lesson.summary.trim()
      : typeof lesson.intro === "string" && lesson.intro.trim() !== ""
        ? lesson.intro.trim()
        : "";

  const showLessonBodyEmptyState =
    hasLessonBlocks && !hasRenderableLessonBlocks
      ? true
      : !hasLessonBlocks && !summaryHtml && !inlineVimeoSrc;
  const hasLessonModalVideo = hasLessonVideo || hasRenderableBlockVideos || Boolean(inlineVimeoSrc);

  const supportImageForPreview =
    typeof lesson.supportImage === "string" && lesson.supportImage.trim() !== ""
      ? lesson.supportImage.trim()
      : "";
  const videoPreviewUsesSupportImage = supportImageForPreview.length > 0;
  const videoOpenLabel = `Play video: ${String(lesson.title ?? "")}`;

  const supportImageDuplicateOfVideoPreview = hasLessonVideo && videoPreviewUsesSupportImage;
  const showSupportImageInCard =
    typeof lesson.supportImage === "string" &&
    lesson.supportImage.trim() !== "" &&
    !supportImageDuplicateOfVideoPreview;

  const hasSupportCard =
    showSupportImageInCard ||
    (typeof lesson.noteTitle === "string" && lesson.noteTitle.trim() !== "") ||
    (typeof lesson.noteText === "string" && lesson.noteText.trim() !== "");

  const lessonVideoSlugList = Array.isArray(lesson.videos)
    ? lesson.videos
        .filter((s): s is string => typeof s === "string" && s.trim() !== "")
        .map((s) => s.trim())
    : [];

  const lessonLibraryVideos: LessonLibraryVideoEmbed[] = lessonVideoSlugList
    .map((key) => resolveLessonLibraryVideo(catalogVideos, key))
    .filter((v): v is LessonLibraryVideoEmbed => v !== null);

  return {
    lesson,
    requiresMemberAccess,
    showHelpHubBackLink,
    backToTipHref,
    backToTipLabel,
    relatedTipHref,
    hasLessonBlocks,
    renderableLessonBlocks,
    showLessonBodyEmptyState,
    inlineVimeoSrc,
    lessonLibraryVideos,
    hasLessonVideo,
    videoPreviewUsesSupportImage,
    supportImageForPreview,
    videoOpenLabel,
    hasSupportCard,
    showSupportImageInCard,
    hasLessonModalVideo,
    vimeoPlayerSrc,
    summaryHtml,
  };
}

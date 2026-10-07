import {
  vimeoNumericIdFromPublicVideo,
  type PublicVideoRow,
} from "../lessonVideo";
import { catalogVideoPlaybackAccess } from "../videos/catalogVideoPlaybackAccess";
import { filterPublicCatalogVideos } from "../videoPublic";
import { buildHelpHubFaqPage, serializeJsonLd } from "../helpHubFaqSchema";
import {
  resolveHelpHubRelatedLessons,
  type HelpHubLessonRecord,
} from "../helpHubMemberLesson";
import {
  memberLessonCardsFromResolved,
  orderedMemberResourceCards,
  resolveRelatedLibraryVideoCards,
  type HelpHubMemberResourceCard,
} from "./memberResources";
import { isMemberOnlyToolPath } from "../tools/toolMembership";
import { helpHubRelatedToolButton, type HelpHubRelatedToolButton } from "./adminForm";
import { resolveHelpHubWatchAndLearn, type HelpHubWatchAndLearnVideo } from "./watchAndLearn";
import {
  helpHubRelatedToolModal,
  type HelpHubRelatedToolModal,
} from "./relatedToolModal";

export type HelpHubTryThis = {
  quickActionTitle?: string;
  quickAction?: string[];
  quickActionNote?: string;
};

export type { HelpHubRelatedToolModal };

export type HelpHubRelatedToolView = HelpHubRelatedToolButton & {
  /** True when the link opens a member-only tool from the tool catalog. */
  memberOnly: boolean;
  /** Set when this catalog tool opens over the Help Hub entry. */
  modal: HelpHubRelatedToolModal | null;
};

export type HelpHubPageTip = {
  slug?: string;
  active?: boolean;
  status?: string;
  title?: string;
  metaTitle?: string;
  metaDescription?: string;
  shortAnswer?: string;
  allMachines?: boolean;
  appliesTo?: string[];
  question?: string;
  hook?: string;
  bubbleAnswer?: string;
  videoId?: string | number;
  mediaType?: string;
  mediaUrl?: string;
  mediaPoster?: string;
  mediaAlt?: string;
  mediaCaption?: string;
  thumbnailAlt?: string;
  aboutTitle?: string;
  solutionText?: string;
  bridge?: string;
  tryThisTitle?: string;
  tryThis?: HelpHubTryThis | string;
  trySteps?: string[];
  tryNote?: string;
  tryImage?: string;
  tryImageAlt?: string;
  tryImageCaption?: string;
  relatedLessons?: (string | number)[];
  relatedLibraryVideos?: unknown;
  /** Related catalog videos shown after Try This. Titles and access come from the catalog. */
  watchAndLearn?: unknown;
  memberResourceOrder?: unknown;
  relatedToolEyebrow?: string;
  relatedToolTitle?: string;
  relatedToolNote?: string;
  relatedToolLabel?: string;
  relatedToolUrl?: string;
  jumpLinks?: { label: string; href: string }[];
};

function helpHubRelatedToolView(tip: HelpHubPageTip): HelpHubRelatedToolView | null {
  const button = helpHubRelatedToolButton(tip);
  if (!button) return null;
  return {
    ...button,
    memberOnly: isMemberOnlyToolPath(button.href),
    modal: helpHubRelatedToolModal(button.href),
  };
}

function filterTrySteps(steps: unknown): string[] {
  if (!Array.isArray(steps)) return [];
  return steps.filter(
    (step): step is string =>
      typeof step === "string" && step.trim() !== "" && step.trim() !== "...",
  );
}

function tryThisObject(tryThis: HelpHubPageTip["tryThis"]): HelpHubTryThis | null {
  if (tryThis && typeof tryThis === "object" && !Array.isArray(tryThis)) return tryThis;
  return null;
}

export function prepareHelpHubTipPage(
  tip: HelpHubPageTip,
  lessons: HelpHubLessonRecord[],
  videosPublic: unknown[],
) {
  const catalogVideosHelpHub = filterPublicCatalogVideos(
    Array.isArray(videosPublic) ? (videosPublic as PublicVideoRow[]) : [],
  );
  const relatedLessonsResolved = resolveHelpHubRelatedLessons(tip.relatedLessons, lessons);
  const tipSlug = typeof tip.slug === "string" ? tip.slug.trim() : "";
  const libraryResourceCards = resolveRelatedLibraryVideoCards(tip.relatedLibraryVideos, catalogVideosHelpHub, {
    tipSlug,
  });
  const lessonResourceCards = memberLessonCardsFromResolved(relatedLessonsResolved, { tipSlug });
  const memberResourceCards: HelpHubMemberResourceCard[] = orderedMemberResourceCards(
    libraryResourceCards,
    lessonResourceCards,
    tip.memberResourceOrder,
  );
  const tryObj = tryThisObject(tip.tryThis);
  const whyBodyRaw =
    typeof tip.solutionText === "string" && tip.solutionText.trim() !== ""
      ? tip.solutionText.trim()
      : typeof tip.bridge === "string" && tip.bridge.trim() !== ""
        ? tip.bridge.trim()
        : "";
  const appliesToList = Array.isArray(tip.appliesTo)
    ? tip.appliesTo.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean)
    : [];
  const quickSteps = filterTrySteps(tip.trySteps ?? tryObj?.quickAction);
  const tipVideoIdRaw = tip.videoId;
  const tipVideoId =
    tipVideoIdRaw !== undefined && tipVideoIdRaw !== null && String(tipVideoIdRaw).trim() !== ""
      ? String(tipVideoIdRaw).trim()
      : "";
  const catalogVideoForTip =
    tipVideoId !== ""
      ? catalogVideosHelpHub.find((v) => String(v.content_id ?? "") === tipVideoId)
      : undefined;
  const catalogIsOpenForPublicEmbed =
    catalogVideoForTip != null && catalogVideoPlaybackAccess(catalogVideoForTip) === "open";
  const catalogVimeoNumericId =
    catalogIsOpenForPublicEmbed && catalogVideoForTip != null
      ? vimeoNumericIdFromPublicVideo(catalogVideoForTip)
      : null;
  const pageTitle =
    (typeof tip.metaTitle === "string" && tip.metaTitle.trim() !== ""
      ? tip.metaTitle.trim()
      : typeof tip.title === "string" && tip.title.trim() !== ""
        ? tip.title.trim()
        : "") || "Help Hub";
  const layoutTitle =
    pageTitle.length > 55
      ? `Help Hub — ${pageTitle.slice(0, 55)}… | Knit it Now`
      : `Help Hub — ${pageTitle} | Knit it Now`;
  const pageDescription =
    (typeof tip.metaDescription === "string" && tip.metaDescription.trim() !== ""
      ? tip.metaDescription.trim()
      : typeof tip.shortAnswer === "string" && tip.shortAnswer.trim() !== ""
        ? tip.shortAnswer.trim()
        : typeof tip.bubbleAnswer === "string" && tip.bubbleAnswer.trim() !== ""
          ? tip.bubbleAnswer.trim()
          : "") || "Machine knitting help from Knit it Now.";
  const faqPage = buildHelpHubFaqPage({
    question: tip.question,
    title: tip.title,
    bubbleAnswer: tip.bubbleAnswer,
    aboutTitle: tip.aboutTitle,
    solutionText: tip.solutionText,
    bridge: tip.bridge,
    tryThisTitle: tip.tryThisTitle,
    tryThis: tryObj ?? undefined,
    trySteps: tip.trySteps,
  });

  return {
    relatedLessonsResolved,
    memberResourceCards,
    memberLessonsSectionTitle:
      memberResourceCards.length === 1 ? "Member Lesson" : "Member Lessons",
    watchAndLearnVideos: resolveHelpHubWatchAndLearn(tip.watchAndLearn, catalogVideosHelpHub, {
      tipSlug,
    }) satisfies HelpHubWatchAndLearnVideo[],
    whyBody: whyBodyRaw,
    tipJumpLinks: Array.isArray(tip.jumpLinks)
      ? tip.jumpLinks.filter(
          (j): j is { label: string; href: string } =>
            !!j &&
            typeof j.label === "string" &&
            j.label.trim() !== "" &&
            typeof j.href === "string" &&
            j.href.trim() !== "",
        )
      : [],
    appliesToList,
    showAllMachines: tip.allMachines === true,
    showSpecificMachines: tip.allMachines !== true && appliesToList.length > 0,
    quickSteps,
    tryObj,
    tryImageUrl:
      typeof tip.tryImage === "string" && tip.tryImage.trim() !== "" ? tip.tryImage.trim() : "",
    tryImageCaptionResolved:
      typeof tip.tryImageCaption === "string" && tip.tryImageCaption.trim() !== ""
        ? tip.tryImageCaption.trim()
        : "",
    hasTrySection:
      quickSteps.length > 0 ||
      (typeof tip.tryThisTitle === "string" && tip.tryThisTitle.trim() !== ""),
    mediaType: typeof tip.mediaType === "string" ? tip.mediaType : "",
    mediaUrl: typeof tip.mediaUrl === "string" ? tip.mediaUrl.trim() : "",
    mediaPoster: typeof tip.mediaPoster === "string" ? tip.mediaPoster.trim() : "",
    mediaAlt:
      (typeof tip.mediaAlt === "string" && tip.mediaAlt.trim()) ||
      (typeof tip.thumbnailAlt === "string" && tip.thumbnailAlt.trim()) ||
      "",
    mediaCaption:
      typeof tip.mediaCaption === "string" && tip.mediaCaption.trim() !== ""
        ? tip.mediaCaption.trim()
        : "",
    relatedTool: helpHubRelatedToolView(tip),
    catalogVimeoEmbedUrl:
      catalogVimeoNumericId != null ? `https://player.vimeo.com/video/${catalogVimeoNumericId}` : "",
    hasHeroMedia: Boolean(
      catalogVimeoNumericId != null ||
        (typeof tip.mediaUrl === "string" &&
          tip.mediaUrl.trim() !== "" &&
          (tip.mediaType === "image" || tip.mediaType === "vimeo" || tip.mediaType === "video")),
    ),
    layoutTitle,
    pageDescription,
    aboutHeading:
      typeof tip.aboutTitle === "string" && tip.aboutTitle.trim() !== ""
        ? tip.aboutTitle.trim()
        : "Why This Works",
    tryHeading:
      typeof tip.tryThisTitle === "string" && tip.tryThisTitle.trim() !== ""
        ? tip.tryThisTitle.trim()
        : "Try This",
    faqJsonLd: faqPage ? serializeJsonLd(faqPage) : "",
  };
}

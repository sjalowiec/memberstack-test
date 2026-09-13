import type { MemberLessonRecord } from "./types";

export type LessonBodyBlock =
  | { type: "text"; content?: string }
  | { type: "vimeo"; title?: string; vimeoId?: string | number };

export type LessonLibraryVideoEmbed = {
  key: string;
  title: string;
  videoId: string;
  contentId?: string;
  access_level: "open" | "member";
};

export type PreparedLessonPage = {
  lesson: MemberLessonRecord;
  requiresMemberAccess: boolean;
  showHelpHubBackLink: boolean;
  backToTipHref: string;
  backToTipLabel: string;
  relatedTipHref: string | null;
  hasLessonBlocks: boolean;
  renderableLessonBlocks: LessonBodyBlock[];
  showLessonBodyEmptyState: boolean;
  inlineVimeoSrc: string | null;
  lessonLibraryVideos: LessonLibraryVideoEmbed[];
  hasLessonVideo: boolean;
  videoPreviewUsesSupportImage: boolean;
  supportImageForPreview: string;
  videoOpenLabel: string;
  hasSupportCard: boolean;
  showSupportImageInCard: boolean;
  hasLessonModalVideo: boolean;
  vimeoPlayerSrc: string;
  summaryHtml: string;
};

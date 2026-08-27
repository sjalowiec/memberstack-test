/** Production-style KIN course document (assign-id lessons). */

export type KinCourseComponent = {
  type: string;
  order: number;
  componentId?: number | null;
  html?: string;
  vimeoId?: string;
  label?: string;
  videos?: Array<{ vimeoId?: string; label?: string }>;
  slides?: Array<{ src?: string; caption?: string }>;
  image?: string;
  imageWidth?: number | null;
  imageHeight?: number | null;
  wrapperStyle?: string;
  stageStyle?: string;
  spots?: Array<{
    index: number;
    text?: string;
    style?: string;
    location?: string;
    actionId?: string | null;
    action?: string | null;
  }>;
  items?: Array<{
    order: number;
    heading?: string;
    detailsHtml?: string;
    image?: string;
  }>;
  jumps?: Array<{ time?: string; title?: string }>;
  package?: string;
  playMode?: string;
  src?: string;
  pending?: boolean;
  unsupported?: boolean;
  legacyType?: string;
  filename?: string;
};

export type KinCourseLesson = {
  id: number;
  title: string;
  order: number;
  slug?: string;
  components: KinCourseComponent[];
};

export type KinCourseSection = {
  id: number;
  title: string;
  order: number;
  empty: boolean;
  lessons: KinCourseLesson[];
};

export type KinCourseDocument = {
  id: number;
  title: string;
  slug: string;
  catalogSlug?: string;
  thumbnail?: string;
  description?: string;
  sections: KinCourseSection[];
};

export type KinCourseLanding = {
  courseId: number;
  title: string;
  subtitle: string | null;
  fullTitle: string;
  image: { src: string; alt: string };
  descriptionHtml: string | null;
  topics: string[];
  included: Array<{ label: string }>;
  firstLessonId: number | null;
  catalogSlug?: string;
};

export type KinCoursePresentation = {
  completion?: {
    heading?: string;
    lead?: string;
    paragraphs?: string[];
  };
  hideComponents?: Array<{ lessonId: number; type: string }>;
  removeClassroomCtas?: boolean;
  removePurchaseCtas?: Array<{ lessonId: number }>;
  rewriteSrc?: Array<{ from: string; to: string }>;
  rewriteHref?: Array<{ from: string; to: string }>;
  splitGlossaryPhrases?: Array<{
    legacyId: number;
    match?: string;
    parts: Array<{ literal?: string; text?: string; legacyId?: number }>;
  }>;
  glossaryLinks?: Array<{ legacyId: number; confidence?: string }>;
};

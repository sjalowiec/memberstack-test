import type { CourseLesson } from "./coursePreviewPoc";

/** Captured from the img-boundary split that broke Decorative Seams in production. */
export const BROKEN_DECORATIVE_SEAMS_IMG_SPLIT: CourseLesson = {
  title: "Decorative Seams",
  slug: "decorative-seams",
  displayOrder: 25,
  legacy: {
    itemId: 64,
    lessonOrder: 25,
    contentSplitCleanup: true,
    contentSplitCleanupAt: "2026-06-25T20:15:32.447Z",
    contentSplitOriginalBlockCount: 6,
  },
  blocks: [
    {
      title: "Hairpin Lace Practice (3)",
      slug: "hairpin-lace-practice-part-3",
      order: 4,
      legacy: {
        assignId: 4062,
        blockType: "Practice",
        contentSplitFrom: "hairpin-lace-practice",
        contentSplitPart: 3,
        contentSplitCleanup: true,
      },
      components: [
        {
          type: "image",
          src: "/challenge/images/v2/2/not_enough_needles/left.png",
          legacyComponentId: 6157,
          order: 1,
        },
        {
          type: "richText",
          html: "</li>\r\n</ul>\r\n<br><b>Swatch 2:</b>\r\n<ul>\r\n<li>Cast on 60 <em>(30)</em> needles, on the LEFT side, leave a needle out of work as indicated in the video<br>",
          legacyComponentId: 6158,
          order: 2,
        },
      ],
    },
  ],
};

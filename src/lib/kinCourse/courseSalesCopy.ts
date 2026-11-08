/**
 * Sales-page copy for KIN courses.
 *
 * Course 86 wording is unchanged. Course 111 uses the SK840 sales copy below.
 * Course 103 uses the Brother 930/940 sales copy. Prices are never invented
 * here — the displayed amount comes from `COURSE_INDIVIDUAL_SALES.*.priceLabel`.
 * Course 33, 66, 87, 34, 50, and 51 use their one-time prices. The legacy
 * purchaser plan stays separate from checkout.
 */
import {
  BEGINNER_WORKSHOP_COURSE_SLUG,
  BROTHER_930_940_COURSE_SLUG,
  BROTHER_KH260_COURSE_SLUG,
  canonicalCourseCatalogSlug,
  KIN_TAITEXMA_160_COURSE_SLUG,
  LEGACY_SK840_COURSE_SLUG,
  LK150_FUN_COURSE_SLUG,
  LK150_PATTERNING_COURSE_SLUG,
  LK150_QUICK_START_COURSE_SLUG,
  RIBBER_BOOTCAMP_COURSE_SLUG,
} from "../../config/legacyCourseEntitlements";

export type KinCourseSalesFaq = {
  question: string;
  answer: string;
};

export type KinCourseSalesPoint = {
  title: string;
  text: string;
};

export type KinCourseSalesBlock =
  | { kind: "cta" }
  | { kind: "prose"; heading: string; paragraphs: readonly string[] }
  | { kind: "points"; heading: string; points: readonly KinCourseSalesPoint[] };

/** Membership / owner CTAs. No checkout price. */
export type KinCourseSalesAccessCta = {
  startLabel: string;
  startHref: string;
  joinLabel: string;
  joinHref: string;
  memberLabel: string;
  memberHref: string;
  signInBefore: string;
  signInLabel: string;
  signInAfter: string;
};

export type KinCourseSalesCopy = {
  /** Course name. When set, this is the page H1 and `headline` is the subordinate heading. */
  courseTitle?: string;
  headline: string;
  intro: readonly string[];
  benefitsHeading: string;
  benefits: readonly string[];
  supportingCopy: string;
  ctaHeading: string;
  purchaseButtonLabel: string;
  ownerBefore: string;
  ownerAction: string;
  ownerAfter: string;
  fallbackImageAlt: string;
  metaDescription: string;
  purchaseInfo?: {
    heading: string;
    items: readonly string[];
  };
  faq?: {
    heading: string;
    items: readonly KinCourseSalesFaq[];
  };
  /** When set, replaces the single benefits + purchase block. Course 86 and 111 omit this. */
  blocks?: readonly KinCourseSalesBlock[];
  /** Line under the closing heading. Course 33 uses this instead of a price. */
  accessLine?: string;
  accessCta?: KinCourseSalesAccessCta;
};

export const KIN_TAITEXMA_SALES_COPY: KinCourseSalesCopy = {
  headline: "Feel Confident Using Your Taitexma TH/TR-160",
  intro: [
    "Your Taitexma TH/TR-160 should be something you enjoy, not something that leaves you wondering what to do next.",
    "This course helps you move past the confusion and start using your machine with greater confidence.",
  ],
  benefitsHeading: "With this course, you’ll be able to:",
  benefits: [
    "Approach your machine without feeling overwhelmed",
    "Set up and operate your Taitexma TH/TR-160 more confidently",
    "Troubleshoot common problems",
    "Spend less time searching for answers and more time knitting",
  ],
  supportingCopy:
    "Work through the course at your own pace and return whenever you need a refresher.",
  ctaHeading: "Ready to feel more confident with your Taitexma TH/TR-160?",
  purchaseButtonLabel: "Purchase the Course",
  ownerBefore: "Already own this course?",
  ownerAction: "Sign in",
  ownerAfter: "to continue learning.",
  fallbackImageAlt: "Taitexma TH/TR-160 knitting machine",
  metaDescription:
    "Feel confident using your Taitexma TH/TR-160. This course helps you set up, operate, and troubleshoot your machine so you can spend more time knitting.",
};

export const KIN_SK840_SALES_COPY: KinCourseSalesCopy = {
  headline: "Feel Confident Using Your Silver Reed SK840",
  intro: [
    "Your knitting machine has tremendous possibilities, but learning how to use its electronic features can feel overwhelming.",
    "This course helps you become more comfortable with your Silver Reed SK840 so you can spend less time second-guessing your machine and more time knitting.",
  ],
  benefitsHeading: "With this course, you’ll be able to:",
  benefits: [
    "Approach your SK840 with greater confidence",
    "Better understand how your SK840 works",
    "Avoid common setup and operating frustrations",
    "Use the machine’s features more comfortably",
    "Spend less time searching for answers and more time knitting",
  ],
  supportingCopy:
    "Work through the course at your own pace and return whenever you need a refresher.",
  ctaHeading: "Ready to feel more confident with your Silver Reed SK840?",
  purchaseButtonLabel: "Purchase the Course",
  ownerBefore: "Already own this course?",
  ownerAction: "Sign in",
  ownerAfter: "to continue learning.",
  fallbackImageAlt: "Silver Reed SK840 knitting machine",
  metaDescription:
    "Feel confident using your Silver Reed SK840. This course helps you become more comfortable with your machine so you can spend more time knitting.",
  purchaseInfo: {
    heading: "One purchase. Ongoing access.",
    items: [
      "{price} one-time payment",
      "No Knit It Now membership required",
      "Learn at your own pace",
      "Return to the course whenever you need a refresher",
      "A free Knit It Now account is required to access your course",
    ],
  },
  faq: {
    heading: "Frequently Asked Questions",
    items: [
      {
        question: "Do I need a Knit It Now membership?",
        answer: "No. Your course purchase is separate from membership.",
      },
      {
        question: "How long can I access the course?",
        answer:
          "You’ll have ongoing access through your Knit It Now account, so you can return whenever you need a refresher.",
      },
      {
        question: "How do I access the course after purchasing?",
        answer:
          "Sign in to the Knit It Now account used during checkout, then visit the Courses page and select the course.",
      },
    ],
  },
};

export const KIN_BROTHER_930_940_SALES_COPY: KinCourseSalesCopy = {
  courseTitle: "Ultimate Brother 930/940 Workshop",
  headline: "Put your Brother 930 or 940 to work",
  intro: [
    "This workshop is for the Brother KH930 and KH940. The 940 has more memory in the electronics. The operation of the machine is the same. This machine was also sold as a Knit King Compuknit.",
    "Set up the machine and work through plain knitting, electronics, stitch patterns, and the ribber. The course includes more than 3 hours of video, plus cheatsheets and tips you can come back to.",
  ],
  benefitsHeading: "With this course, you’ll be able to:",
  benefits: [
    "Set up your Brother 930 or 940",
    "Knit plain fabric and use the machine’s electronics",
    "Work with stitch patterns",
    "Use the ribber with this machine",
  ],
  supportingCopy:
    "Work through the course at your own pace and return whenever you need a refresher.",
  ctaHeading: "Ready to use your Brother 930 or 940?",
  purchaseButtonLabel: "Purchase the Course",
  ownerBefore: "Already own this course?",
  ownerAction: "Sign in",
  ownerAfter: "to continue learning.",
  fallbackImageAlt: "Brother 930/940 knitting machine",
  metaDescription:
    "A workshop for the Brother KH930 and KH940, from setup and plain knitting through electronics, stitch patterns, and the ribber.",
  purchaseInfo: {
    heading: "One purchase. Ongoing access.",
    items: [
      "{price} one-time payment",
      "No Knit It Now membership required",
      "Learn at your own pace",
      "Return to the course whenever you need a refresher",
      "A free Knit It Now account is required to access your course",
    ],
  },
  faq: {
    heading: "Frequently Asked Questions",
    items: [
      {
        question: "Do I need a Knit It Now membership?",
        answer: "No. Your course purchase is separate from membership.",
      },
      {
        question: "How long can I access the course?",
        answer:
          "You’ll have ongoing access through your Knit It Now account, so you can return whenever you need a refresher.",
      },
      {
        question: "How do I access the course after purchasing?",
        answer:
          "Sign in to the Knit It Now account used during checkout, then visit the Courses page and select the course.",
      },
    ],
  },
};

/**
 * Published Course 66 outline from the public course page. A loaded course
 * can replace the section list at render time.
 */
export const KIN_RIBBER_BOOTCAMP_LESSON_TOPICS = [
  "Get Started",
  "Casting On",
  "Swatching on the Double Bed",
  "Binding Off",
  "Practice Makes Progress",
  "Troubleshooting Tips",
  "Knitting in the Round",
  "Full Needle Rib",
  "Practice Makes Progress",
  "Flat Ribs",
  "Shaping in Ribbing",
  "Tuck Rib",
  "Bands, Belts and Straps",
] as const;

export const KIN_RIBBER_BOOTCAMP_DESCRIPTION =
  "Get comfortable with your ribber through hands-on practice: cast on, bind off, needle arrangements, and double-bed fabrics.";

const KIN_RIBBER_BOOTCAMP_INCLUDED = [
  "Video tutorials",
  "Printable reference material",
  "Exercises",
] as const;

export function salesPlainText(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includedSentence(labels: readonly string[]): string {
  const items = labels.map((label) => label.trim()).filter(Boolean);
  if (items.length === 0) return "";
  if (items.length === 1) return `Includes ${items[0]}.`;
  if (items.length === 2) return `Includes ${items[0]} and ${items[1]}.`;
  return `Includes ${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}.`;
}

export const KIN_RIBBER_BOOTCAMP_SALES_COPY: KinCourseSalesCopy = {
  courseTitle: "Ribber Basic Bootcamp",
  headline: "Get comfortable with your ribber",
  intro: [
    KIN_RIBBER_BOOTCAMP_DESCRIPTION,
    "The goal of this course is to get you using your ribber. Practice casting on and binding off, then repeat those skills with other needle arrangements and stitch patterns.",
  ],
  benefitsHeading: "What You'll Learn",
  benefits: KIN_RIBBER_BOOTCAMP_LESSON_TOPICS,
  supportingCopy: includedSentence(KIN_RIBBER_BOOTCAMP_INCLUDED),
  ctaHeading: "Ready to get comfortable with your ribber?",
  purchaseButtonLabel: "Purchase the Course",
  ownerBefore: "Already own this course?",
  ownerAction: "Sign in",
  ownerAfter: "to continue learning.",
  fallbackImageAlt: "Ribber Basic Bootcamp",
  metaDescription: KIN_RIBBER_BOOTCAMP_DESCRIPTION,
  purchaseInfo: {
    heading: "One purchase. Ongoing access.",
    items: [
      "{price} one-time payment",
      "No Knit It Now membership required",
      "Learn at your own pace",
      "Return to the course whenever you need a refresher",
      "A free Knit It Now account is required to access your course",
    ],
  },
  faq: {
    heading: "Frequently Asked Questions",
    items: [
      {
        question: "Do I need a Knit It Now membership?",
        answer: "No. Your course purchase is separate from membership.",
      },
      {
        question: "How long can I access the course?",
        answer:
          "You’ll have ongoing access through your Knit It Now account, so you can return whenever you need a refresher.",
      },
      {
        question: "How do I access the course after purchasing?",
        answer:
          "Sign in to the Knit It Now account used during checkout, then visit the Courses page and select the course.",
      },
    ],
  },
};

export function ribberBootcampSalesCopy(outline?: {
  description?: string | null;
  topics?: readonly string[];
  included?: readonly string[];
}): KinCourseSalesCopy {
  const description = salesPlainText(outline?.description);
  const topics = (outline?.topics ?? []).map((topic) => topic.trim()).filter(Boolean);
  const included = (outline?.included ?? []).map((label) => label.trim()).filter(Boolean);
  const intro = description
    ? [description, KIN_RIBBER_BOOTCAMP_SALES_COPY.intro[1]].filter(
        (paragraph): paragraph is string => Boolean(paragraph),
      )
    : KIN_RIBBER_BOOTCAMP_SALES_COPY.intro;
  return {
    ...KIN_RIBBER_BOOTCAMP_SALES_COPY,
    intro,
    benefits: topics.length > 0 ? topics : KIN_RIBBER_BOOTCAMP_SALES_COPY.benefits,
    supportingCopy: included.length
      ? includedSentence(included)
      : KIN_RIBBER_BOOTCAMP_SALES_COPY.supportingCopy,
  };
}

const PUBLIC_COURSE_PURCHASE_INFO = {
  heading: "One purchase. Ongoing access.",
  items: [
    "{price} one-time payment",
    "No Knit It Now membership required",
    "Learn at your own pace",
    "Return to the course whenever you need a refresher",
    "A free Knit It Now account is required to access your course",
  ],
} as const;

const PUBLIC_COURSE_PURCHASE_FAQ = {
  heading: "Frequently Asked Questions",
  items: [
    {
      question: "Do I need a Knit It Now membership?",
      answer: "No. Your course purchase is separate from membership.",
    },
    {
      question: "How long can I access the course?",
      answer:
        "You’ll have ongoing access through your Knit It Now account, so you can return whenever you need a refresher.",
    },
    {
      question: "How do I access the course after purchasing?",
      answer:
        "Sign in to the Knit It Now account used during checkout, then visit the Courses page and select the course.",
    },
  ],
} as const;

export const KIN_BEGINNER_WORKSHOP_SALES_COPY: KinCourseSalesCopy = {
  courseTitle: "Beginner Workshop",
  headline: "Get Comfortable with Your Knitting Machine",
  intro: [
    "New to machine knitting, or feeling rusty after a break?",
    "Get familiar with the basics, from threading your machine and choosing yarn to casting on and knitting. Watch the demonstrations, practice at your machine, and revisit anything you need to see again.",
  ],
  benefitsHeading: "With this workshop, you can:",
  benefits: [
    "Get familiar with threading and basic machine operation",
    "Learn ways to cast on and bind off",
    "Explore swatching, gauge, and basic shaping",
    "Practice your skills with the included hat projects",
  ],
  supportingCopy:
    "Take your time, repeat the demonstrations, and build confidence with practice.",
  ctaHeading: "Ready to get comfortable with the basics?",
  purchaseButtonLabel: "Purchase the Course",
  ownerBefore: "Already own this course?",
  ownerAction: "Sign in",
  ownerAfter: "to continue learning.",
  fallbackImageAlt: "Beginner Workshop",
  metaDescription:
    "Get comfortable with your knitting machine. Get familiar with the basics, from threading your machine and choosing yarn to casting on and knitting.",
  purchaseInfo: PUBLIC_COURSE_PURCHASE_INFO,
  faq: PUBLIC_COURSE_PURCHASE_FAQ,
};

export function purchasableCourseSalesCopy(outline: {
  courseTitle: string;
  description?: string | null;
  topics?: readonly string[];
  included?: readonly string[];
}): KinCourseSalesCopy {
  const courseTitle = outline.courseTitle.trim() || "This course";
  const description = salesPlainText(outline.description);
  const topics = (outline.topics ?? []).map((topic) => topic.trim()).filter(Boolean);
  const included = (outline.included ?? []).map((label) => label.trim()).filter(Boolean);
  return {
    courseTitle,
    headline: description || courseTitle,
    intro: [
      "Buy this course once and keep it. No Knit It Now membership is required to keep access.",
    ],
    benefitsHeading: "What You'll Learn",
    benefits: topics,
    supportingCopy: includedSentence(included),
    ctaHeading: `Ready to start ${courseTitle}?`,
    purchaseButtonLabel: "Purchase the Course",
    ownerBefore: "Already own this course?",
    ownerAction: "Sign in",
    ownerAfter: "to continue learning.",
    fallbackImageAlt: courseTitle,
    metaDescription: description || courseTitle,
    purchaseInfo: PUBLIC_COURSE_PURCHASE_INFO,
    faq: PUBLIC_COURSE_PURCHASE_FAQ,
  };
}

export function getKinCourseSalesCopy(
  courseSlug: string | null | undefined,
): KinCourseSalesCopy | null {
  const slug = canonicalCourseCatalogSlug(courseSlug);
  if (slug === KIN_TAITEXMA_160_COURSE_SLUG) return KIN_TAITEXMA_SALES_COPY;
  if (slug === LEGACY_SK840_COURSE_SLUG) return KIN_SK840_SALES_COPY;
  if (slug === BROTHER_930_940_COURSE_SLUG) return KIN_BROTHER_930_940_SALES_COPY;
  if (slug === BEGINNER_WORKSHOP_COURSE_SLUG) return KIN_BEGINNER_WORKSHOP_SALES_COPY;
  if (slug === RIBBER_BOOTCAMP_COURSE_SLUG) return KIN_RIBBER_BOOTCAMP_SALES_COPY;
  const publicCourse = PUBLIC_PURCHASABLE_COURSE_SALES[slug ?? ""];
  if (publicCourse) return purchasableCourseSalesCopy(publicCourse);
  return null;
}

const PUBLIC_PURCHASABLE_COURSE_SALES: Record<
  string,
  { courseTitle: string; description: string }
> = {
  [BROTHER_KH260_COURSE_SLUG]: {
    courseTitle: "Brother KH/KR-260 Quick Start",
    description:
      "A step-by-step course for getting started with the Brother KH/KR-260, from setup and casting on through tuck, slip, Fair Isle, lace, plaiting, and ribber techniques.",
  },
  [LK150_PATTERNING_COURSE_SLUG]: {
    courseTitle: "Master LK-150 Patterning",
    description:
      "A step-by-step course for patterning on the LK-150, from needle selection through tuck, slip, plating, Fair Isle, and intarsia.",
  },
  [LK150_QUICK_START_COURSE_SLUG]: {
    courseTitle: "LK-150 Quick Start",
    description:
      "A step-by-step course for getting started with the LK-150, from yarn and machine setup through casting on, binding off, gauge, and a first project.",
  },
  [LK150_FUN_COURSE_SLUG]: {
    courseTitle: "LK-150 Fun",
    description:
      "Build on your LK-150 basics with texture, shaping, and creative techniques you can use in any project.",
  },
};

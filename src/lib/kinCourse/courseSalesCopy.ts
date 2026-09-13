/**
 * Sales-page copy for individually purchased KIN courses.
 *
 * Course 86 wording is unchanged. Course 111 uses the SK840 sales copy below.
 * Prices are never invented here — the displayed amount comes from
 * `COURSE_INDIVIDUAL_SALES.*.priceLabel`.
 */
import {
  canonicalCourseCatalogSlug,
  KIN_TAITEXMA_160_COURSE_SLUG,
  LEGACY_SK840_COURSE_SLUG,
} from "../../config/legacyCourseEntitlements";

export type KinCourseSalesFaq = {
  question: string;
  answer: string;
};

export type KinCourseSalesCopy = {
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

export function getKinCourseSalesCopy(
  courseSlug: string | null | undefined,
): KinCourseSalesCopy | null {
  const slug = canonicalCourseCatalogSlug(courseSlug);
  if (slug === KIN_TAITEXMA_160_COURSE_SLUG) return KIN_TAITEXMA_SALES_COPY;
  if (slug === LEGACY_SK840_COURSE_SLUG) return KIN_SK840_SALES_COPY;
  return null;
}

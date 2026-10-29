/**
 * Sales-page copy for KIN courses.
 *
 * Course 86 wording is unchanged. Course 111 uses the SK840 sales copy below.
 * Prices are never invented here — the displayed amount comes from
 * `COURSE_INDIVIDUAL_SALES.*.priceLabel`. Course 33 has no checkout price.
 */
import {
  BEGINNER_WORKSHOP_COURSE_SLUG,
  canonicalCourseCatalogSlug,
  COURSE_INDIVIDUAL_SALES,
  KIN_TAITEXMA_160_COURSE_SLUG,
  LEGACY_SK840_COURSE_SLUG,
} from "../../config/legacyCourseEntitlements";
import { kinCourseHomeHref } from "./hrefs";

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

const MEMBERSHIP_HREF = "/membership";

export const KIN_BEGINNER_WORKSHOP_SALES_COPY: KinCourseSalesCopy = {
  headline: "Get to know your machine. Knit your first projects with confidence.",
  intro: [
    "Your knitting machine is ready. You have yarn and plenty of ideas. But how do you get from moving the carriage to making something you’re proud of?",
    "The Beginner Workshop gives you a clear path to follow. Start with the essentials, practice each skill, and bring it all together as you knit your first hat.",
  ],
  benefitsHeading: "Build skills you’ll use again and again",
  benefits: [],
  supportingCopy: "",
  ctaHeading: "Your next project starts with the basics",
  purchaseButtonLabel: "",
  ownerBefore: "Already have access?",
  ownerAction: "Sign in",
  ownerAfter: "to continue.",
  fallbackImageAlt: "Beginner Workshop",
  metaDescription:
    "Get to know your machine and knit your first hat in the Beginner Workshop. The lessons are included with Knit It Now membership.",
  accessCta: {
    startLabel: "Start the Beginner Workshop",
    startHref: kinCourseHomeHref(COURSE_INDIVIDUAL_SALES.beginnerWorkshop.courseId),
    joinLabel: "Join Knit It Now",
    joinHref: MEMBERSHIP_HREF,
    memberLabel: "Become a member",
    memberHref: MEMBERSHIP_HREF,
    signInBefore: "Already have access?",
    signInLabel: "Sign in",
    signInAfter: "to continue.",
  },
  blocks: [
    { kind: "cta" },
    {
      kind: "prose",
      heading: "Know what to practice next",
      paragraphs: [
        "When you’re learning, even a small question can bring your knitting to a stop. Is this yarn suitable? Which cast-on should you use? What is your swatch telling you?",
        "Follow an organized sequence that helps you understand what you’re doing and why. Each lesson builds on what you’ve already practiced, so you can spend more time knitting and less time wondering where to begin.",
      ],
    },
    {
      kind: "points",
      heading: "Build skills you’ll use again and again",
      points: [
        {
          title: "Choose suitable yarn",
          text: "Give yourself a better start with yarn that works with your machine.",
        },
        {
          title: "Cast on and bind off",
          text: "Explore ways to begin and end your knitting, and understand when to use them.",
        },
        {
          title: "Swatch and measure gauge",
          text: "Connect your practice knitting to a project that comes out the size you intended.",
        },
        {
          title: "Create hems and shape your knitting",
          text: "Build the skills that turn a rectangle into something more.",
        },
        {
          title: "Read patterns and plan your yarn",
          text: "Make sense of the instructions and prepare for your project.",
        },
        {
          title: "Finish what you knit",
          text: "Bring the pieces together and enjoy the satisfaction of a completed project.",
        },
      ],
    },
    {
      kind: "prose",
      heading: "Turn practice into your first hat",
      paragraphs: [
        "Practice has more purpose when you can see what it’s helping you make.",
        "The workshop has one hat project, Project: Let’s Knit a Hat! The Hat Pattern Builder creates the instructions from your gauge. Apply the techniques you’ve learned, revisit anything that needs another try, and build experience you can carry into your next project.",
        "Videos, worksheets, the Yarn Estimator, and the Hat Pattern Builder support you along the way.",
      ],
    },
    {
      kind: "prose",
      heading: "New to machine knitting? Coming back after a break?",
      paragraphs: [
        "This workshop gives new knitters a foundation and returning knitters a place to refresh skills that feel a little rusty.",
        "The lessons teach knitting techniques for the machine you have: yarn, casting on, binding off, gauge, hems, shaping, reading patterns, and finishing. They are not a control-by-control guide for one brand. One cast-on in the course is noted as not appropriate for the LK150.",
        "Work at your own pace. Pause, practice, and watch a lesson again whenever you need to.",
      ],
    },
    {
      kind: "prose",
      heading: "Your next project starts with the basics",
      paragraphs: [
        "You don’t have to learn everything your machine can do before you enjoy using it.",
        "Start with the essentials. Make something. Build on that success.",
      ],
    },
    { kind: "cta" },
  ],
};

export function getKinCourseSalesCopy(
  courseSlug: string | null | undefined,
): KinCourseSalesCopy | null {
  const slug = canonicalCourseCatalogSlug(courseSlug);
  if (slug === KIN_TAITEXMA_160_COURSE_SLUG) return KIN_TAITEXMA_SALES_COPY;
  if (slug === LEGACY_SK840_COURSE_SLUG) return KIN_SK840_SALES_COPY;
  if (slug === BEGINNER_WORKSHOP_COURSE_SLUG) return KIN_BEGINNER_WORKSHOP_SALES_COPY;
  return null;
}

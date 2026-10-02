/**
 * Individual-course Memberstack entitlements.
 *
 * Checkout uses PRICE ids (`prc_*`) only. Entitlement checks use PLAN ids
 * (`pln_*`) on the member's active plan connections. Do not add these plans to
 * `COURSE_ACCESS_PLAN_IDS` / `MEMBER_PLAN_IDS` — that would unlock every
 * member course.
 *
 * Keep every Legacy course plan. Paid plans are additional one-time products
 * for the same catalog slugs.
 */
export const KIN_TAITEXMA_160_COURSE_SLUG = "taitexma-th-tr-160-getting-started" as const;
export const LEGACY_SK840_COURSE_SLUG = "mastering-the-silver-reed-sk840" as const;

export const LEGACY_TH160_COURSE_PLAN_ID = "pln_course-th160-legacy-lp1o10vtq" as const;
export const PAID_TH160_COURSE_PLAN_ID = "pln_course-th160-paid-ix1o20vv2" as const;
export const TH160_COURSE_PRICE_ID = "prc_course-th160-fe1ou0u3q" as const;

export const LEGACY_SK840_COURSE_PLAN_ID = "pln_legacy-sk840-course-qy1c4076q" as const;
/** Paid SK840 plan id includes two hyphens before `xy1u30uqt`. */
export const PAID_SK840_COURSE_PLAN_ID = "pln_course-sk840--xy1u30uqt" as const;
export const SK840_COURSE_PRICE_ID = "prc_course-sk840-hn300ud" as const;

export const BROTHER_KH260_COURSE_SLUG = "brother-kh-kr-260-quick-start" as const;
/** Free plan for verified legacy owners. There is no paid price for this course. */
export const LEGACY_BROTHER_260_COURSE_PLAN_ID = "pln_course-brother-260-legacy-m2vb0y2r" as const;

export const LK150_PATTERNING_COURSE_SLUG = "master-lk-patterning" as const;
/** Existing Memberstack plan "Course: LK150 Patterning". No checkout price is configured here. */
export const LK150_PATTERNING_COURSE_PLAN_ID = "pln_course-lk150-patterning-nw00gk6" as const;

export const LK150_FUN_COURSE_SLUG = "lk-150-fun" as const;
/** Free permanent plan for verified LK-150 Fun owners. No checkout price is configured here. */
export const LK150_FUN_COURSE_PLAN_ID = "pln_course-lk150-fun-legacy-qn6n0gzm" as const;

export const LK150_QUICK_START_COURSE_SLUG = "lk-150-quick-start" as const;
/** Free permanent plan for verified LK-150 Quick Start owners. The catalog course stays free. No checkout price is configured here. */
export const LK150_QUICK_START_COURSE_PLAN_ID = "pln_kin-lk150-quickstart-7h8i0oxj" as const;

export type IndividualCourseSaleKey = "th160" | "sk840" | "brother260" | "lk150Patterning" | "lk150QuickStart" | "lk150Fun";

export type IndividualCourseSale = {
  key: IndividualCourseSaleKey;
  courseId: 86 | 111 | 87 | 34 | 50 | 51;
  slug: string;
  aliases: readonly string[];
  legacyPlanId: string;
  /** Omit when the course is not sold. Checkout must not invent a price. */
  paidPlanId?: string;
  priceId?: string;
  /** Customer-facing price. Omit rather than inventing a dollar amount. */
  priceLabel?: string;
};

export const COURSE_INDIVIDUAL_SALES = {
  th160: {
    key: "th160",
    courseId: 86,
    slug: KIN_TAITEXMA_160_COURSE_SLUG,
    aliases: ["86"],
    legacyPlanId: LEGACY_TH160_COURSE_PLAN_ID,
    paidPlanId: PAID_TH160_COURSE_PLAN_ID,
    priceId: TH160_COURSE_PRICE_ID,
    priceLabel: "$49.99",
  },
  sk840: {
    key: "sk840",
    courseId: 111,
    slug: LEGACY_SK840_COURSE_SLUG,
    aliases: ["111"],
    legacyPlanId: LEGACY_SK840_COURSE_PLAN_ID,
    paidPlanId: PAID_SK840_COURSE_PLAN_ID,
    priceId: SK840_COURSE_PRICE_ID,
    priceLabel: "$49.99",
  },
  brother260: {
    key: "brother260",
    courseId: 87,
    slug: BROTHER_KH260_COURSE_SLUG,
    aliases: ["87"],
    legacyPlanId: LEGACY_BROTHER_260_COURSE_PLAN_ID,
  },
  lk150Patterning: {
    key: "lk150Patterning",
    courseId: 34,
    slug: LK150_PATTERNING_COURSE_SLUG,
    aliases: ["34"],
    legacyPlanId: LK150_PATTERNING_COURSE_PLAN_ID,
  },
  lk150QuickStart: {
    key: "lk150QuickStart",
    courseId: 50,
    slug: LK150_QUICK_START_COURSE_SLUG,
    aliases: ["50"],
    legacyPlanId: LK150_QUICK_START_COURSE_PLAN_ID,
  },
  lk150Fun: {
    key: "lk150Fun",
    courseId: 51,
    slug: LK150_FUN_COURSE_SLUG,
    aliases: ["51"],
    legacyPlanId: LK150_FUN_COURSE_PLAN_ID,
  },
} as const satisfies Record<IndividualCourseSaleKey, IndividualCourseSale>;

/** Plan ID → course slugs that plan unlocks (Legacy and Paid). */
export const LEGACY_COURSE_PLAN_SLUGS: Readonly<Record<string, readonly string[]>> = {
  [LEGACY_TH160_COURSE_PLAN_ID]: [KIN_TAITEXMA_160_COURSE_SLUG],
  [PAID_TH160_COURSE_PLAN_ID]: [KIN_TAITEXMA_160_COURSE_SLUG],
  [LEGACY_SK840_COURSE_PLAN_ID]: [LEGACY_SK840_COURSE_SLUG],
  [PAID_SK840_COURSE_PLAN_ID]: [LEGACY_SK840_COURSE_SLUG],
  [LEGACY_BROTHER_260_COURSE_PLAN_ID]: [BROTHER_KH260_COURSE_SLUG],
  [LK150_PATTERNING_COURSE_PLAN_ID]: [LK150_PATTERNING_COURSE_SLUG],
  [LK150_QUICK_START_COURSE_PLAN_ID]: [LK150_QUICK_START_COURSE_SLUG],
  [LK150_FUN_COURSE_PLAN_ID]: [LK150_FUN_COURSE_SLUG],
};

/** Map numeric player ids (`86`, `111`) to catalog slugs used by entitlement checks. */
export function canonicalCourseCatalogSlug(courseSlug: string | null | undefined): string {
  const slug = typeof courseSlug === "string" ? courseSlug.trim() : "";
  if (!slug) return "";
  for (const sale of Object.values(COURSE_INDIVIDUAL_SALES)) {
    if (sale.slug === slug || sale.aliases.includes(slug)) return sale.slug;
  }
  return slug;
}

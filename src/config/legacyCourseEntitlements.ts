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

export type IndividualCourseSaleKey = "th160" | "sk840";

export type IndividualCourseSale = {
  key: IndividualCourseSaleKey;
  courseId: 86 | 111;
  slug: string;
  aliases: readonly string[];
  legacyPlanId: string;
  paidPlanId: string;
  priceId: string;
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
  },
} as const satisfies Record<IndividualCourseSaleKey, IndividualCourseSale>;

/** Plan ID → course slugs that plan unlocks (Legacy and Paid). */
export const LEGACY_COURSE_PLAN_SLUGS: Readonly<Record<string, readonly string[]>> = {
  [LEGACY_TH160_COURSE_PLAN_ID]: [KIN_TAITEXMA_160_COURSE_SLUG],
  [PAID_TH160_COURSE_PLAN_ID]: [KIN_TAITEXMA_160_COURSE_SLUG],
  [LEGACY_SK840_COURSE_PLAN_ID]: [LEGACY_SK840_COURSE_SLUG],
  [PAID_SK840_COURSE_PLAN_ID]: [LEGACY_SK840_COURSE_SLUG],
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

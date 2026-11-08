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
/** Free plan for verified legacy owners. Checkout must not use this id. */
export const LEGACY_BROTHER_260_COURSE_PLAN_ID = "pln_course-brother-260-legacy-m2vb0y2r" as const;
/** One-time paid plan. Checkout uses {@link BROTHER_260_COURSE_PRICE_ID}, not this id. */
export const PAID_BROTHER_260_COURSE_PLAN_ID = "pln_course-brother-260-zz4b0m4l" as const;
export const BROTHER_260_COURSE_PRICE_ID = "prc_course-brother-260-ml3g0zuu" as const;

export const BROTHER_930_940_COURSE_SLUG = "ultimate-brother-930-940-workshop" as const;
/** Free plan "Course: Brother930-940 Legacy" for verified owners of challenge 103. */
export const LEGACY_BROTHER_930_940_COURSE_PLAN_ID =
  "pln_course-brother930-940-legacy-pzq0zzl" as const;
/** One-time paid plan. Checkout uses {@link BROTHER_930_940_COURSE_PRICE_ID}, not this id. */
export const PAID_BROTHER_930_940_COURSE_PLAN_ID = "pln_course-930-940-ob5g0fwc" as const;
export const BROTHER_930_940_COURSE_PRICE_ID = "prc_course-930-940-ap5j0fkk" as const;

export const LK150_PATTERNING_COURSE_SLUG = "master-lk-patterning" as const;
/**
 * Original Memberstack plan "Legacy - KIN_LK150 Patterning".
 * Legacy import assigned this free plan. It unlocks the existing Course 34
 * player and is not a checkout price.
 */
export const LEGACY_KIN_LK150_PATTERNING_PLAN_ID =
  "pln_legacy-kin-lk150-patterning-uk9508lp" as const;
/** Later free plan "Course: LK150 Patterning". Checkout must not use this id. */
export const LK150_PATTERNING_COURSE_PLAN_ID = "pln_course-lk150-patterning-nw00gk6" as const;
/** One-time paid plan. Checkout uses {@link LK150_PATTERNING_COURSE_PRICE_ID}, not this id. */
export const PAID_LK150_PATTERNING_COURSE_PLAN_ID = "pln_kin-lk150-patterning-gi8n0opa" as const;
/**
 * Memberstack spells this price id "patternining". Checkout must use that spelling.
 */
export const LK150_PATTERNING_COURSE_PRICE_ID = "prc_kin-lk150-patternining-nd9008k0" as const;

export const LK150_FUN_COURSE_SLUG = "lk-150-fun" as const;
/** Free plan "Course: Lk150 Fun Legacy". Checkout must not use this id. */
export const LK150_FUN_COURSE_PLAN_ID = "pln_course-lk150-fun-legacy-qn6n0gzm" as const;
/** Original free plan "Legacy - KIN_LK150 Fun". Checkout must not use this id. */
export const LEGACY_KIN_LK150_FUN_PLAN_ID = "pln_legacy-kin-lk150-fun-bv8v0oo3" as const;
/** One-time paid plan. Checkout uses {@link LK150_FUN_COURSE_PRICE_ID}, not this id. */
export const PAID_LK150_FUN_COURSE_PLAN_ID = "pln_course-lk150-fun-p21x0ren" as const;
export const LK150_FUN_COURSE_PRICE_ID = "prc_course-lk150-fun-594h0mo4" as const;

export const LK150_QUICK_START_COURSE_SLUG = "lk-150-quick-start" as const;
/** Free plan for verified LK-150 Quick Start owners. Checkout must not use this id. */
export const LK150_QUICK_START_COURSE_PLAN_ID = "pln_kin-lk150-quickstart-7h8i0oxj" as const;
/** One-time paid plan. Checkout uses {@link LK150_QUICK_START_COURSE_PRICE_ID}, not this id. */
export const PAID_LK150_QUICK_START_COURSE_PLAN_ID = "pln_course-lk150-quickstart-xr3h0zk8" as const;
export const LK150_QUICK_START_COURSE_PRICE_ID = "prc_course-lk150-quickstart-eg1t0rj5" as const;

export const BEGINNER_WORKSHOP_COURSE_SLUG = "beginner-workshop" as const;
/** Free plan for verified Beginner Workshop owners. Checkout must not use this id. */
export const LEGACY_BEGINNER_WORKSHOP_COURSE_PLAN_ID =
  "pln_course-beginner-workshop-legacy-wzr70hsx" as const;
/** One-time paid plan. Checkout uses {@link BEGINNER_WORKSHOP_COURSE_PRICE_ID}, not this id. */
export const PAID_BEGINNER_WORKSHOP_COURSE_PLAN_ID =
  "pln_course-beginner-workshop-6n490m9l" as const;
export const BEGINNER_WORKSHOP_COURSE_PRICE_ID =
  "prc_course-beginner-workshop-paid-4y4a0mi2" as const;

export const RIBBER_BOOTCAMP_COURSE_SLUG = "ribber-basic-bootcamp" as const;
/** Free plan for previous Ribber Basic Bootcamp buyers. Checkout must not use this id. */
export const LEGACY_RIBBER_BOOTCAMP_COURSE_PLAN_ID =
  "pln_course-ribber-bootcamp-legacy-sgc1002r" as const;
/** One-time paid plan. Checkout uses {@link RIBBER_BOOTCAMP_COURSE_PRICE_ID}, not this id. */
export const PAID_RIBBER_BOOTCAMP_COURSE_PLAN_ID =
  "pln_course-ribber-bootcamp-a4c200uh" as const;
export const RIBBER_BOOTCAMP_COURSE_PRICE_ID = "prc_course-ribber-bootcamp-84c300s0" as const;

export type IndividualCourseSaleKey =
  | "th160"
  | "sk840"
  | "brother260"
  | "brother930940"
  | "lk150Patterning"
  | "lk150QuickStart"
  | "lk150Fun"
  | "beginnerWorkshop"
  | "ribberBootcamp";

export type IndividualCourseSale = {
  key: IndividualCourseSaleKey;
  courseId: 86 | 111 | 87 | 103 | 34 | 50 | 51 | 33 | 66;
  slug: string;
  aliases: readonly string[];
  legacyPlanId: string;
  /**
   * Other free plans that unlock this same course. The legacy import plan for
   * LK150 Patterning is one of these. Checkout must not use these ids.
   */
  additionalLegacyPlanIds?: readonly string[];
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
    paidPlanId: PAID_BROTHER_260_COURSE_PLAN_ID,
    priceId: BROTHER_260_COURSE_PRICE_ID,
    priceLabel: "$49.99",
  },
  brother930940: {
    key: "brother930940",
    courseId: 103,
    slug: BROTHER_930_940_COURSE_SLUG,
    aliases: ["103"],
    legacyPlanId: LEGACY_BROTHER_930_940_COURSE_PLAN_ID,
    paidPlanId: PAID_BROTHER_930_940_COURSE_PLAN_ID,
    priceId: BROTHER_930_940_COURSE_PRICE_ID,
    priceLabel: "$65",
  },
  lk150Patterning: {
    key: "lk150Patterning",
    courseId: 34,
    slug: LK150_PATTERNING_COURSE_SLUG,
    aliases: ["34"],
    legacyPlanId: LK150_PATTERNING_COURSE_PLAN_ID,
    additionalLegacyPlanIds: [LEGACY_KIN_LK150_PATTERNING_PLAN_ID],
    paidPlanId: PAID_LK150_PATTERNING_COURSE_PLAN_ID,
    priceId: LK150_PATTERNING_COURSE_PRICE_ID,
    priceLabel: "$49.99",
  },
  lk150QuickStart: {
    key: "lk150QuickStart",
    courseId: 50,
    slug: LK150_QUICK_START_COURSE_SLUG,
    aliases: ["50"],
    legacyPlanId: LK150_QUICK_START_COURSE_PLAN_ID,
    paidPlanId: PAID_LK150_QUICK_START_COURSE_PLAN_ID,
    priceId: LK150_QUICK_START_COURSE_PRICE_ID,
    priceLabel: "$49.99",
  },
  lk150Fun: {
    key: "lk150Fun",
    courseId: 51,
    slug: LK150_FUN_COURSE_SLUG,
    aliases: ["51"],
    legacyPlanId: LK150_FUN_COURSE_PLAN_ID,
    additionalLegacyPlanIds: [LEGACY_KIN_LK150_FUN_PLAN_ID],
    paidPlanId: PAID_LK150_FUN_COURSE_PLAN_ID,
    priceId: LK150_FUN_COURSE_PRICE_ID,
    priceLabel: "$49.99",
  },
  beginnerWorkshop: {
    key: "beginnerWorkshop",
    courseId: 33,
    slug: BEGINNER_WORKSHOP_COURSE_SLUG,
    aliases: ["33"],
    legacyPlanId: LEGACY_BEGINNER_WORKSHOP_COURSE_PLAN_ID,
    paidPlanId: PAID_BEGINNER_WORKSHOP_COURSE_PLAN_ID,
    priceId: BEGINNER_WORKSHOP_COURSE_PRICE_ID,
    priceLabel: "$49.99",
  },
  ribberBootcamp: {
    key: "ribberBootcamp",
    courseId: 66,
    slug: RIBBER_BOOTCAMP_COURSE_SLUG,
    aliases: ["66"],
    legacyPlanId: LEGACY_RIBBER_BOOTCAMP_COURSE_PLAN_ID,
    paidPlanId: PAID_RIBBER_BOOTCAMP_COURSE_PLAN_ID,
    priceId: RIBBER_BOOTCAMP_COURSE_PRICE_ID,
    priceLabel: "$49.99",
  },
} as const satisfies Record<IndividualCourseSaleKey, IndividualCourseSale>;

/** Free and paid plan ids that unlock one individual course. */
export function individualCourseEntitlementPlanIds(sale: {
  legacyPlanId: string;
  paidPlanId?: string;
  additionalLegacyPlanIds?: readonly string[];
}): readonly string[] {
  return [
    ...(sale.additionalLegacyPlanIds ?? []),
    sale.legacyPlanId,
    ...(sale.paidPlanId ? [sale.paidPlanId] : []),
  ];
}

/** Plan ID → course slugs that plan unlocks (Legacy and Paid). */
export const LEGACY_COURSE_PLAN_SLUGS: Readonly<Record<string, readonly string[]>> =
  Object.fromEntries(
    Object.values(COURSE_INDIVIDUAL_SALES).flatMap((sale) =>
      individualCourseEntitlementPlanIds(sale).map((planId) => [planId, [sale.slug]] as const),
    ),
  );

/** Map numeric player ids (`86`, `111`) to catalog slugs used by entitlement checks. */
export function canonicalCourseCatalogSlug(courseSlug: string | null | undefined): string {
  const slug = typeof courseSlug === "string" ? courseSlug.trim() : "";
  if (!slug) return "";
  for (const sale of Object.values(COURSE_INDIVIDUAL_SALES)) {
    if (sale.slug === slug || sale.aliases.includes(slug)) return sale.slug;
  }
  return slug;
}

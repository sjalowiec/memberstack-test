/**
 * Legacy individual-course Memberstack plans.
 *
 * These grant access to specific catalog course slugs only. Do not add them to
 * `COURSE_ACCESS_PLAN_IDS` / `MEMBER_PLAN_IDS` — that would unlock every
 * member course.
 */
export const LEGACY_SK840_COURSE_PLAN_ID = "pln_legacy-sk840-course-qy1c4076q" as const;

export const LEGACY_SK840_COURSE_SLUG = "mastering-the-silver-reed-sk840" as const;

/** Plan ID → course slugs that plan unlocks. */
export const LEGACY_COURSE_PLAN_SLUGS: Readonly<Record<string, readonly string[]>> = {
  [LEGACY_SK840_COURSE_PLAN_ID]: [LEGACY_SK840_COURSE_SLUG],
};

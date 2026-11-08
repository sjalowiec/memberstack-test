import { describe, expect, it, vi } from "vitest";
import {
  BROTHER_930_940_COURSE_PRICE_ID,
  BROTHER_930_940_COURSE_SLUG,
  KIN_TAITEXMA_160_COURSE_SLUG,
  LEGACY_SK840_COURSE_SLUG,
  PAID_SK840_COURSE_PLAN_ID,
  PAID_TH160_COURSE_PLAN_ID,
  RIBBER_BOOTCAMP_COURSE_PRICE_ID,
  RIBBER_BOOTCAMP_COURSE_SLUG,
  SK840_COURSE_PRICE_ID,
  TH160_COURSE_PRICE_ID,
} from "../../config/legacyCourseEntitlements";
import { MEMBERSHIPS } from "../../config/memberships";
import { buildCourseCheckoutReturnUrls, startCourseCheckout } from "./courseCheckout";

function memberstackDom(options: {
  member?: unknown;
  purchasePlansWithCheckout?: ReturnType<typeof vi.fn>;
  openModal?: ReturnType<typeof vi.fn>;
}) {
  return {
    getCurrentMember: vi.fn().mockResolvedValue(options.member ?? { data: { id: "ms_buyer" } }),
    purchasePlansWithCheckout:
      options.purchasePlansWithCheckout ??
      vi.fn().mockResolvedValue({ data: { url: "https://checkout.stripe.com/test" } }),
    openModal: options.openModal,
  } as unknown as NonNullable<Window["$memberstackDom"]>;
}

describe("startCourseCheckout", () => {
  it("uses the TH160 Price ID, not the Paid Plan ID", async () => {
    const purchasePlansWithCheckout = vi.fn().mockResolvedValue({
      data: { url: "https://checkout.stripe.com/th160" },
    });
    const assignLocation = vi.fn();
    const result = await startCourseCheckout(KIN_TAITEXMA_160_COURSE_SLUG, {
      waitForMemberstack: async () =>
        memberstackDom({
          purchasePlansWithCheckout,
        }),
      getLocation: () => ({ href: "https://knititnow.com/courses/86" }) as Location,
      assignLocation,
    });

    expect(result).toMatchObject({ ok: true, priceId: TH160_COURSE_PRICE_ID });
    expect(purchasePlansWithCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        priceId: TH160_COURSE_PRICE_ID,
        autoRedirect: false,
      }),
    );
    expect(purchasePlansWithCheckout.mock.calls[0]?.[0]?.priceId).not.toBe(
      PAID_TH160_COURSE_PLAN_ID,
    );
    expect(assignLocation).toHaveBeenCalledWith("https://checkout.stripe.com/th160");
  });

  it("uses the SK840 Price ID, not the Paid Plan ID", async () => {
    const purchasePlansWithCheckout = vi.fn().mockResolvedValue({
      data: { url: "https://checkout.stripe.com/sk840" },
    });
    const result = await startCourseCheckout(LEGACY_SK840_COURSE_SLUG, {
      waitForMemberstack: async () =>
        memberstackDom({
          purchasePlansWithCheckout,
        }),
      getLocation: () => ({ href: "https://knititnow.com/courses/111" }) as Location,
      assignLocation: vi.fn(),
    });

    expect(result).toMatchObject({ ok: true, priceId: SK840_COURSE_PRICE_ID });
    expect(purchasePlansWithCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ priceId: SK840_COURSE_PRICE_ID }),
    );
    expect(purchasePlansWithCheckout.mock.calls[0]?.[0]?.priceId).not.toBe(
      PAID_SK840_COURSE_PLAN_ID,
    );
  });

  it("lets a logged-in nonmember purchase without opening signup", async () => {
    const openModal = vi.fn();
    const purchasePlansWithCheckout = vi.fn().mockResolvedValue({
      data: { url: "https://checkout.stripe.com/logged-in" },
    });
    const result = await startCourseCheckout(KIN_TAITEXMA_160_COURSE_SLUG, {
      waitForMemberstack: async () =>
        memberstackDom({
          member: { data: { id: "ms_free", planConnections: [] } },
          purchasePlansWithCheckout,
          openModal,
        }),
      getLocation: () => ({ href: "https://knititnow.com/courses/86" }) as Location,
      assignLocation: vi.fn(),
    });

    expect(result.ok).toBe(true);
    expect(openModal).not.toHaveBeenCalled();
  });

  it("starts Memberstack signup then checkout for logged-out visitors", async () => {
    const openModal = vi.fn().mockResolvedValue({ type: "SIGNUP" });
    const getCurrentMember = vi
      .fn()
      .mockResolvedValueOnce({ data: null })
      .mockResolvedValueOnce({ data: { id: "ms_new" } });
    const purchasePlansWithCheckout = vi.fn().mockResolvedValue({
      data: { url: "https://checkout.stripe.com/signup" },
    });

    const result = await startCourseCheckout(LEGACY_SK840_COURSE_SLUG, {
      waitForMemberstack: async () =>
        ({
          getCurrentMember,
          purchasePlansWithCheckout,
          openModal,
        }) as unknown as NonNullable<Window["$memberstackDom"]>,
      getLocation: () => ({ href: "https://knititnow.com/courses/111" }) as Location,
      assignLocation: vi.fn(),
    });

    expect(openModal).toHaveBeenCalledWith("SIGNUP");
    expect(result.ok).toBe(true);
    expect(purchasePlansWithCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ priceId: SK840_COURSE_PRICE_ID }),
    );
  });

  it("continues to checkout when the signup modal is used to log in", async () => {
    const openModal = vi.fn().mockResolvedValue({ type: "LOGIN" });
    const getCurrentMember = vi
      .fn()
      .mockResolvedValueOnce({ data: null })
      .mockResolvedValueOnce({ data: { id: "ms_existing" } });
    const purchasePlansWithCheckout = vi.fn().mockResolvedValue({
      data: { url: "https://checkout.stripe.com/login" },
    });

    const result = await startCourseCheckout("66", {
      waitForMemberstack: async () =>
        ({
          getCurrentMember,
          purchasePlansWithCheckout,
          openModal,
        }) as unknown as NonNullable<Window["$memberstackDom"]>,
      getLocation: () => ({ href: "https://kin-dev.netlify.app/courses/66" }) as Location,
      assignLocation: vi.fn(),
    });

    expect(openModal).toHaveBeenCalledWith("SIGNUP");
    expect(result).toMatchObject({
      ok: true,
      priceId: "prc_course-ribber-bootcamp-84c300s0",
    });
    expect(purchasePlansWithCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ priceId: "prc_course-ribber-bootcamp-84c300s0" }),
    );
  });
});

describe("signed-in member course checkout", () => {
  it("uses each course price and does not open signup", async () => {
    const courses = [
      { slug: RIBBER_BOOTCAMP_COURSE_SLUG, priceId: RIBBER_BOOTCAMP_COURSE_PRICE_ID, href: "https://kin-dev.netlify.app/courses/66" },
      { slug: KIN_TAITEXMA_160_COURSE_SLUG, priceId: TH160_COURSE_PRICE_ID, href: "https://kin-dev.netlify.app/courses/86" },
      { slug: LEGACY_SK840_COURSE_SLUG, priceId: SK840_COURSE_PRICE_ID, href: "https://kin-dev.netlify.app/courses/111" },
      { slug: BROTHER_930_940_COURSE_SLUG, priceId: BROTHER_930_940_COURSE_PRICE_ID, href: "https://kin-dev.netlify.app/courses/103" },
    ];

    for (const course of courses) {
      const openModal = vi.fn();
      const purchasePlansWithCheckout = vi.fn().mockResolvedValue({
        data: { url: `https://checkout.stripe.com/${course.slug}` },
      });
      const result = await startCourseCheckout(course.slug, {
        waitForMemberstack: async () =>
          memberstackDom({
            member: {
              data: {
                id: "ms_member",
                planConnections: [
                  { planId: MEMBERSHIPS.membership.memberstackPlanId, status: "ACTIVE" },
                ],
              },
            },
            purchasePlansWithCheckout,
            openModal,
          }),
        getLocation: () => ({ href: course.href }) as Location,
        assignLocation: vi.fn(),
      });

      expect(result).toMatchObject({ ok: true, priceId: course.priceId });
      expect(openModal).not.toHaveBeenCalled();
      expect(purchasePlansWithCheckout).toHaveBeenCalledWith(
        expect.objectContaining({ priceId: course.priceId, autoRedirect: false }),
      );
      expect(purchasePlansWithCheckout.mock.calls[0]?.[0]?.priceId).not.toBe(
        MEMBERSHIPS.membership.prices.monthly.memberstackPriceId,
      );
      expect(purchasePlansWithCheckout.mock.calls[0]?.[0]?.priceId).not.toBe(
        MEMBERSHIPS.membership.prices.annual.memberstackPriceId,
      );
    }
  });
});

describe("buildCourseCheckoutReturnUrls", () => {
  it("returns to the current course URL after checkout", () => {
    const { successUrl, cancelUrl } = buildCourseCheckoutReturnUrls({
      href: "https://knititnow.com/courses/86",
    } as Location);
    expect(successUrl).toContain("coursePurchase=success");
    expect(cancelUrl).toBe("https://knititnow.com/courses/86");
  });
});

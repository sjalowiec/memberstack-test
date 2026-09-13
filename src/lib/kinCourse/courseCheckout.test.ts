import { describe, expect, it, vi } from "vitest";
import {
  KIN_TAITEXMA_160_COURSE_SLUG,
  LEGACY_SK840_COURSE_SLUG,
  PAID_SK840_COURSE_PLAN_ID,
  PAID_TH160_COURSE_PLAN_ID,
  SK840_COURSE_PRICE_ID,
  TH160_COURSE_PRICE_ID,
} from "../../config/legacyCourseEntitlements";
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

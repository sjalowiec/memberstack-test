import { describe, expect, it, vi } from "vitest";
import {
  buildCourseInterestSubmitPayload,
  initCourseLandingInterestForms,
  submitCourseInterestRequest,
} from "./courseLandingInterestForm";

describe("buildCourseInterestSubmitPayload", () => {
  it("trims email and preserves ActiveCampaign-compatible fields", () => {
    expect(
      buildCourseInterestSubmitPayload({
        email: "  customer@example.com  ",
        courseSlug: "lk-150-quick-start",
        courseTitle: "LK-150 Quick Start",
      }),
    ).toEqual({
      email: "customer@example.com",
      customerEmail: "customer@example.com",
      courseSlug: "lk-150-quick-start",
      courseTitle: "LK-150 Quick Start",
    });
  });

  it("returns null for invalid email", () => {
    expect(
      buildCourseInterestSubmitPayload({
        email: "bad-email",
        courseSlug: "lk-150-quick-start",
        courseTitle: "LK-150 Quick Start",
      }),
    ).toBeNull();
  });
});

describe("submitCourseInterestRequest", () => {
  it("returns success when the API accepts the request", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await submitCourseInterestRequest(
      {
        email: "customer@example.com",
        customerEmail: "customer@example.com",
        courseSlug: "lk-150-quick-start",
        courseTitle: "LK-150 Quick Start",
      },
      { fetchImpl },
    );

    expect(result).toEqual({ ok: true });
  });

  it("returns a friendly error when the API rejects the request", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ ok: false, error: "Please enter a valid email address." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await submitCourseInterestRequest(
      {
        email: "customer@example.com",
        customerEmail: "customer@example.com",
        courseSlug: "lk-150-quick-start",
        courseTitle: "LK-150 Quick Start",
      },
      { fetchImpl },
    );

    expect(result).toEqual({
      ok: false,
      error: "Please enter a valid email address.",
    });
  });
});

describe("initCourseLandingInterestForms", () => {
  it("prevents duplicate submission while the request is in progress", async () => {
    let resolveFetch: ((value: Response) => void) | undefined;
    const fetchPromise = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    const fetchImpl = vi.fn(() => fetchPromise);

    const submitHandlers: Array<(event: Event) => void | Promise<void>> = [];
    const submitButton = { disabled: false };
    const form = {
      dataset: {
        courseSlug: "lk-150-quick-start",
        courseTitle: "LK-150 Quick Start",
        interestBound: "false",
        submitting: "false",
      },
      hidden: false,
      addEventListener(type: string, handler: (event: Event) => void) {
        if (type === "submit") submitHandlers.push(handler);
      },
      querySelector(selector: string) {
        if (selector === 'input[name="email"]') return { value: "customer@example.com" };
        if (selector === 'button[type="submit"]') return submitButton;
        return null;
      },
      parentElement: {
        querySelector(selector: string) {
          if (selector === "[data-interest-error]") {
            return { hidden: true, textContent: "" };
          }
          if (selector === "[data-interest-thanks]") {
            return { hidden: true };
          }
          return null;
        },
      },
    };

    const root = {
      querySelectorAll(selector: string) {
        return selector === "[data-course-interest-form]" ? [form] : [];
      },
    } as unknown as ParentNode;

    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchImpl as typeof fetch;

    initCourseLandingInterestForms(root);

    const event = { preventDefault() {} } as Event;
    const firstSubmit = submitHandlers[0]?.(event);
    await Promise.resolve();

    expect(form.dataset.submitting).toBe("true");
    expect(submitButton.disabled).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    await submitHandlers[0]?.(event);
    await Promise.resolve();
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    resolveFetch?.(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    await firstSubmit;
    await Promise.resolve();

    expect(form.hidden).toBe(true);
    globalThis.fetch = originalFetch;
  });
});

import { describe, expect, it, vi } from "vitest";
import { EMAIL_LIST_SIGNUP_MESSAGES } from "../lib/email/emailListSignupShared";
import {
  buildEmailListSignupPayload,
  initEmailListSignupForms,
  submitEmailListSignupRequest,
} from "./emailListSignupForm";

describe("buildEmailListSignupPayload", () => {
  it("requires first name and a valid email", () => {
    expect(
      buildEmailListSignupPayload({
        firstName: "",
        email: "ada@example.com",
      }),
    ).toEqual({ error: EMAIL_LIST_SIGNUP_MESSAGES.invalidFirstName });

    expect(
      buildEmailListSignupPayload({
        firstName: "Ada",
        email: "bad",
      }),
    ).toEqual({ error: EMAIL_LIST_SIGNUP_MESSAGES.invalidEmail });
  });

  it("trims values and includes an empty honeypot field", () => {
    expect(
      buildEmailListSignupPayload({
        firstName: "  Ada  ",
        email: "  ada@example.com  ",
      }),
    ).toEqual({
      firstName: "Ada",
      email: "ada@example.com",
      "bot-field": "",
    });
  });
});

describe("submitEmailListSignupRequest", () => {
  it("returns the server success message", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          ok: true,
          message: EMAIL_LIST_SIGNUP_MESSAGES.subscribed,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await submitEmailListSignupRequest(
      {
        firstName: "Ada",
        email: "ada@example.com",
        "bot-field": "",
      },
      { fetchImpl },
    );

    expect(result).toEqual({
      ok: true,
      message: EMAIL_LIST_SIGNUP_MESSAGES.subscribed,
    });
  });

  it("returns a friendly error on network failure", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("offline");
    });

    const result = await submitEmailListSignupRequest(
      {
        firstName: "Ada",
        email: "ada@example.com",
        "bot-field": "",
      },
      { fetchImpl },
    );

    expect(result).toEqual({
      ok: false,
      error: EMAIL_LIST_SIGNUP_MESSAGES.genericFailure,
    });
  });
});

describe("initEmailListSignupForms", () => {
  it("disables the button while submitting and preserves values on error", async () => {
    let resolveFetch: ((value: Response) => void) | undefined;
    const fetchPromise = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    const fetchImpl = vi.fn(() => fetchPromise);

    const submitHandlers: Array<(event: Event) => void | Promise<void>> = [];
    const submitButton = { disabled: false };
    const firstNameInput = { value: "Ada" };
    const emailInput = { value: "ada@example.com" };
    const botInput = { value: "" };
    const errorEl = { hidden: true, textContent: "" };
    const thanksMessageEl = { textContent: "" };
    const thanksEl = {
      hidden: true,
      querySelector(selector: string) {
        if (selector === "[data-signup-thanks-message]") return thanksMessageEl;
        return null;
      },
    };

    const form = {
      dataset: {
        signupBound: "false",
        submitting: "false",
      },
      hidden: false,
      addEventListener(type: string, handler: (event: Event) => void) {
        if (type === "submit") submitHandlers.push(handler);
      },
      dispatchEvent() {
        return true;
      },
      querySelector(selector: string) {
        if (selector === 'input[name="firstName"]') return firstNameInput;
        if (selector === 'input[name="email"]') return emailInput;
        if (selector === 'input[name="bot-field"]') return botInput;
        if (selector === 'button[type="submit"]') return submitButton;
        if (selector === "[data-signup-error]") return errorEl;
        return null;
      },
      closest() {
        return {
          querySelector(selector: string) {
            if (selector === "[data-signup-thanks]") return thanksEl;
            if (selector === "[data-signup-done]") {
              return { hidden: true };
            }
            return null;
          },
        };
      },
      parentElement: null,
    };

    const root = {
      querySelectorAll(selector: string) {
        return selector === "[data-email-list-signup]" ? [form] : [];
      },
    } as unknown as ParentNode;

    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchImpl as typeof fetch;

    initEmailListSignupForms(root);

    const event = { preventDefault() {} } as Event;
    const firstSubmit = submitHandlers[0]?.(event);
    await Promise.resolve();

    expect(form.dataset.submitting).toBe("true");
    expect(submitButton.disabled).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    // Duplicate rapid submit ignored.
    await submitHandlers[0]?.(event);
    await Promise.resolve();
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    resolveFetch?.(
      new Response(
        JSON.stringify({ ok: false, error: "Please enter a valid email address." }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      ),
    );
    await firstSubmit;

    expect(form.hidden).toBe(false);
    expect(form.dataset.submitting).toBe("false");
    expect(submitButton.disabled).toBe(false);
    expect(firstNameInput.value).toBe("Ada");
    expect(emailInput.value).toBe("ada@example.com");
    expect(errorEl.hidden).toBe(false);
    expect(errorEl.textContent).toBe("Please enter a valid email address.");

    globalThis.fetch = originalFetch;
  });
});

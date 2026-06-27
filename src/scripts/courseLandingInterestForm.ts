import {
  isValidEmailAddress,
  normalizeEmailAddress,
} from "../lib/email/validateEmailAddress";

export const COURSE_READY_NOTIFICATION_ENDPOINT = "/api/course-ready-notification";

export type CourseInterestSubmitPayload = {
  email: string;
  courseSlug: string;
  courseTitle: string;
  customerEmail: string;
};

export type CourseInterestSubmitResult =
  | { ok: true }
  | { ok: false; error: string };

export function buildCourseInterestSubmitPayload(args: {
  email: string;
  courseSlug: string;
  courseTitle: string;
}): CourseInterestSubmitPayload | null {
  const customerEmail = normalizeEmailAddress(args.email);
  const courseSlug = args.courseSlug.trim();
  const courseTitle = args.courseTitle.trim();

  if (!isValidEmailAddress(customerEmail) || !courseSlug || !courseTitle) {
    return null;
  }

  return {
    email: customerEmail,
    courseSlug,
    courseTitle,
    customerEmail,
  };
}

export async function submitCourseInterestRequest(
  payload: CourseInterestSubmitPayload,
  options: {
    fetchImpl?: typeof fetch;
    endpoint?: string;
  } = {},
): Promise<CourseInterestSubmitResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const endpoint = options.endpoint ?? COURSE_READY_NOTIFICATION_ENDPOINT;

  try {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    let data: { ok?: boolean; error?: string } | null = null;
    try {
      data = (await response.json()) as { ok?: boolean; error?: string };
    } catch {
      data = null;
    }

    if (response.ok && data?.ok) {
      return { ok: true };
    }

    return {
      ok: false,
      error:
        typeof data?.error === "string" && data.error.trim()
          ? data.error.trim()
          : "We couldn't submit your request right now. Please try again in a moment.",
    };
  } catch {
    return {
      ok: false,
      error: "We couldn't submit your request right now. Please try again in a moment.",
    };
  }
}

export function initCourseLandingInterestForms(root: ParentNode = document): void {
  root.querySelectorAll<HTMLFormElement>("[data-course-interest-form]").forEach((form) => {
    if (form.dataset.interestBound === "true") return;
    form.dataset.interestBound = "true";

    const emailInput = form.querySelector<HTMLInputElement>('input[name="email"]');
    const submitButton = form.querySelector<HTMLButtonElement>('button[type="submit"]');
    const errorEl = form.parentElement?.querySelector<HTMLElement>("[data-interest-error]");
    const thanksEl = form.parentElement?.querySelector<HTMLElement>("[data-interest-thanks]");
    const courseSlug = form.dataset.courseSlug ?? "";
    const courseTitle = form.dataset.courseTitle ?? "";

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (form.dataset.submitting === "true") return;

      const payload = buildCourseInterestSubmitPayload({
        email: emailInput?.value ?? "",
        courseSlug,
        courseTitle,
      });

      if (!payload) {
        if (errorEl) {
          errorEl.textContent = "Please enter a valid email address.";
          errorEl.hidden = false;
        }
        return;
      }

      form.dataset.submitting = "true";
      if (submitButton) submitButton.disabled = true;
      if (errorEl) errorEl.hidden = true;

      const result = await submitCourseInterestRequest(payload);

      if (result.ok) {
        form.hidden = true;
        if (thanksEl) thanksEl.hidden = false;
        return;
      }

      form.dataset.submitting = "false";
      if (submitButton) submitButton.disabled = false;
      if (errorEl) {
        errorEl.textContent = result.error;
        errorEl.hidden = false;
      }
    });
  });
}

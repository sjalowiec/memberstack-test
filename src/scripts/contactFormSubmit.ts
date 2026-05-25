const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const DEFAULT_THANKS_URL = "/contact/thanks/";
const DEFAULT_FALLBACK_ERROR =
  "Something went wrong sending your message. Please try again in a moment.";

export type ContactFormSubmitOptions = {
  form: HTMLFormElement;
  fileInput?: HTMLInputElement | null;
  submitBtn?: HTMLButtonElement | null;
  submitErrorEl?: HTMLElement | null;
  imageErrorEl?: HTMLElement | null;
  pageUrlInput?: HTMLInputElement | null;
  submittedAtInput?: HTMLInputElement | null;
  /** Defaults to ISO-8601 (contact page, Help Hub). */
  formatSubmittedAt?: () => string;
  thanksUrl?: string;
};

/** Locale date/time string used by Contact Sue modal. */
export function formatContactSubmittedAtLocale(): string {
  const now = new Date();
  const date = now.toLocaleDateString("en-US");
  const time = now.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${date} – ${time}`;
}

/** @param {File | undefined} file */
export function validateContactImage(file: File | undefined) {
  if (!file || file.size === 0) {
    return { ok: true as const };
  }
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return {
      ok: false as const,
      message: "Please choose a JPG, PNG, or WEBP image.",
    };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return {
      ok: false as const,
      message: "Please choose an image smaller than 5MB.",
    };
  }
  return { ok: true as const };
}

/**
 * POST via fetch (multipart FormData) to the contact Netlify function.
 * Redirects to thanks only after a 2xx response (email accepted server-side).
 */
export function wireContactFormSubmit(options: ContactFormSubmitOptions) {
  const {
    form,
    fileInput,
    submitBtn,
    submitErrorEl,
    imageErrorEl,
    pageUrlInput: pageUrlInputOption,
    submittedAtInput: submittedAtInputOption,
    formatSubmittedAt,
    thanksUrl = DEFAULT_THANKS_URL,
  } = options;

  const pageUrlInput =
    pageUrlInputOption ??
    (form.querySelector('input[name="page_url"]') as HTMLInputElement | null);
  const submittedAtInput =
    submittedAtInputOption ??
    (form.querySelector('input[name="submitted_at"]') as HTMLInputElement | null);

  function showImageError(message: string) {
    if (!imageErrorEl) return;
    imageErrorEl.textContent = message;
    imageErrorEl.hidden = false;
    if (submitErrorEl) submitErrorEl.hidden = true;
  }

  function clearImageError() {
    if (!imageErrorEl) return;
    imageErrorEl.textContent = "";
    imageErrorEl.hidden = true;
  }

  function showSubmitError(message: string) {
    if (!submitErrorEl) return;
    submitErrorEl.textContent = message;
    submitErrorEl.hidden = false;
  }

  function clearSubmitError() {
    if (!submitErrorEl) return;
    submitErrorEl.textContent = "";
    submitErrorEl.hidden = true;
  }

  if (fileInput) {
    fileInput.addEventListener("change", () => {
      const file = fileInput.files?.[0];
      if (!file) {
        clearImageError();
        return;
      }
      const result = validateContactImage(file);
      if (!result.ok) {
        showImageError(result.message);
      } else {
        clearImageError();
      }
    });
  }

  form.addEventListener(
    "submit",
    async (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      clearSubmitError();

      const file = fileInput?.files?.[0];
      const imageResult = validateContactImage(file);
      if (!imageResult.ok) {
        showImageError(imageResult.message);
        fileInput?.focus();
        return;
      }
      clearImageError();

      if (pageUrlInput) {
        pageUrlInput.value = window.location.href;
      }
      if (submittedAtInput) {
        submittedAtInput.value = formatSubmittedAt
          ? formatSubmittedAt()
          : new Date().toISOString();
      }

      if (submitBtn) {
        submitBtn.disabled = true;
      }

      try {
        const res = await fetch(form.action, {
          method: "POST",
          body: new FormData(form),
        });

        if (res.status >= 200 && res.status < 300) {
          window.location.href = thanksUrl;
          return;
        }

        const serverMessage = (await res.text()).trim();
        showSubmitError(serverMessage || DEFAULT_FALLBACK_ERROR);
      } catch {
        showSubmitError(DEFAULT_FALLBACK_ERROR);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
        }
      }
    },
    true,
  );
}

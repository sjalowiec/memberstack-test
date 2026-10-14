import {
  mergeContactImageSelection,
  validateContactImageBatch,
} from "../lib/contact/contactImages";
import { getTurnstileSlot, resetTurnstileWidget } from "./turnstile";

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

/**
 * POST via fetch (multipart FormData) to the contact Netlify function.
 * Redirects to thanks only after a 2xx response (message stored server-side).
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
  const imageListEl = form.querySelector("[data-contact-image-list]");
  let selectedFiles: File[] = [];

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

  function renderSelectedFiles() {
    if (!(imageListEl instanceof HTMLElement)) return;
    imageListEl.replaceChildren();
    if (selectedFiles.length === 0) {
      imageListEl.hidden = true;
      return;
    }

    imageListEl.hidden = false;
    selectedFiles.forEach((file, index) => {
      const item = document.createElement("li");
      item.className = "contact-form__file-item";

      const name = document.createElement("span");
      name.className = "contact-form__file-name";
      name.textContent = file.name;

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "contact-form__file-remove";
      remove.textContent = "Remove";
      remove.setAttribute("aria-label", `Remove ${file.name}`);
      remove.addEventListener("click", () => {
        selectedFiles = selectedFiles.filter((_, fileIndex) => fileIndex !== index);
        renderSelectedFiles();
        clearImageError();
      });

      item.append(name, remove);
      imageListEl.append(item);
    });
  }

  if (fileInput) {
    fileInput.addEventListener("change", () => {
      const incoming = Array.from(fileInput.files || []);
      if (incoming.length === 0) return;
      const result = mergeContactImageSelection(selectedFiles, incoming);
      selectedFiles = result.files;
      renderSelectedFiles();
      if (result.error) {
        showImageError(result.error);
      } else {
        clearImageError();
      }
      fileInput.value = "";
    });
  }

  form.addEventListener("reset", () => {
    selectedFiles = [];
    renderSelectedFiles();
    clearImageError();
  });

  form.addEventListener(
    "submit",
    async (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      clearSubmitError();

      const imageResult = validateContactImageBatch(selectedFiles);
      if (!imageResult.ok) {
        showImageError(imageResult.error);
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
        const body = new FormData(form);
        body.delete("images");
        for (const file of selectedFiles) {
          body.append("images", file, file.name);
        }

        const res = await fetch(form.action, {
          method: "POST",
          body,
        });

        if (res.status >= 200 && res.status < 300) {
          window.location.href = thanksUrl;
          return;
        }

        resetTurnstileWidget(getTurnstileSlot(form));
        const serverMessage = (await res.text()).trim();
        showSubmitError(serverMessage || DEFAULT_FALLBACK_ERROR);
      } catch {
        resetTurnstileWidget(getTurnstileSlot(form));
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

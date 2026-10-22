import { CONTACT_SUBJECT_MAX_LENGTH } from "./contactMessageRecord";

export type ContactInquiryPrefill = {
  subject: string | null;
  pagePath: string | null;
};

/** Reads the Studio post title and path from the existing contact page query. */
export function contactInquiryPrefill(search: string): ContactInquiryPrefill {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return {
    subject: cleanSubject(params.get("subject")),
    pagePath: cleanPagePath(params.get("page")),
  };
}

export function applyContactInquiryPrefill(
  form: HTMLFormElement,
  search: string,
  origin = window.location.origin,
): ContactInquiryPrefill {
  const prefill = contactInquiryPrefill(search);
  const subjectInput = form.querySelector('input[name="subject"]');
  if (subjectInput instanceof HTMLInputElement) {
    subjectInput.value = prefill.subject ?? "";
  }

  const pageUrlInput = form.querySelector('input[name="page_url"]');
  if (pageUrlInput instanceof HTMLInputElement && prefill.pagePath) {
    pageUrlInput.value = new URL(prefill.pagePath, origin).href;
    pageUrlInput.dataset.preserve = "true";
  }

  const note = form.querySelector("[data-contact-inquiry-about]");
  if (note instanceof HTMLElement) {
    note.hidden = !prefill.subject;
    note.textContent = prefill.subject ? `About: ${prefill.subject}` : "";
  }

  return prefill;
}

function cleanSubject(value: string | null): string | null {
  const cleaned = (value ?? "").replace(/[\u0000-\u001F\u007F]/g, "").trim();
  return cleaned ? cleaned.slice(0, CONTACT_SUBJECT_MAX_LENGTH) : null;
}

function cleanPagePath(value: string | null): string | null {
  const path = (value ?? "").trim();
  if (!path.startsWith("/") || path.startsWith("//") || /[\s\\]/.test(path)) return null;
  return path.slice(0, 300);
}

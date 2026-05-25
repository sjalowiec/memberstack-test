import {
  formatContactSubmittedAtLocale,
  wireContactFormSubmit,
} from "./contactFormSubmit";

/** Open/close Contact Sue modal and wire shared form submit. */
export function initContactModal() {
  const modal = document.getElementById("contact-modal");
  const overlay = document.getElementById("contact-modal-overlay");
  const closeBtn = document.getElementById("contact-modal-close");
  const form = document.getElementById("contactFormModal");
  const pageUrlInput = document.getElementById(
    "contactPageURLModal",
  ) as HTMLInputElement | null;
  const submittedAtInput = document.getElementById(
    "contactSubmittedAtModal",
  ) as HTMLInputElement | null;
  const formSourceInput = document.getElementById(
    "contactFormSourceModal",
  ) as HTMLInputElement | null;
  const fileInput = document.getElementById(
    "contactImagesModal",
  ) as HTMLInputElement | null;
  const imageErrorEl = document.getElementById("contact-image-error-modal");
  const submitErrorEl = document.getElementById("contact-submit-error-modal");
  const submitBtn = document.getElementById(
    "contact-modal-submit-btn",
  ) as HTMLButtonElement | null;

  const triggers = document.querySelectorAll(
    "#contact-modal-trigger, .contact-modal-trigger",
  );

  function clearFieldErrors() {
    if (imageErrorEl) {
      imageErrorEl.textContent = "";
      imageErrorEl.hidden = true;
    }
    if (submitErrorEl) {
      submitErrorEl.textContent = "";
      submitErrorEl.hidden = true;
    }
  }

  function openModal(source: string) {
    if (pageUrlInput) {
      pageUrlInput.value = window.location.href;
    }
    if (submittedAtInput) {
      submittedAtInput.value = formatContactSubmittedAtLocale();
    }
    if (formSourceInput) {
      formSourceInput.value = source || "unknown";
    }
    clearFieldErrors();

    modal?.setAttribute("aria-hidden", "false");
    modal?.classList.add("contact-modal--open");
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    modal?.setAttribute("aria-hidden", "true");
    modal?.classList.remove("contact-modal--open");
    document.body.style.overflow = "";
    if (form instanceof HTMLFormElement) {
      form.reset();
    }
    clearFieldErrors();
  }

  if (!(modal && overlay && closeBtn && form instanceof HTMLFormElement)) {
    return;
  }

  triggers.forEach((trigger) => {
    trigger.addEventListener("click", (e) => {
      e.preventDefault();
      const source =
        trigger.getAttribute("data-contact-source") || "unknown";
      openModal(source);
    });
  });

  overlay.addEventListener("click", closeModal);
  closeBtn.addEventListener("click", closeModal);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.getAttribute("aria-hidden") === "false") {
      closeModal();
    }
  });

  wireContactFormSubmit({
    form,
    fileInput,
    submitBtn,
    submitErrorEl,
    imageErrorEl,
    pageUrlInput,
    submittedAtInput,
    formatSubmittedAt: formatContactSubmittedAtLocale,
  });
}

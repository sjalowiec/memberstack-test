/**
 * Lazy-loaded feature preview modal for PatternsFeaturesSection.
 * Media loads only after a feature card is clicked; src is cleared on close.
 */

const FEATURE_PREVIEW_ROOT_SELECTOR = "[data-patterns-feature-preview-root]";
const FEATURE_PREVIEW_TRIGGER_SELECTOR = `${FEATURE_PREVIEW_ROOT_SELECTOR} [data-feature-media]`;

export function normalizeFeatureMediaSrc(path: string): string {
  const trimmed = String(path ?? "").trim();
  if (!trimmed) return "";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export function readFeaturePreviewFromTrigger(trigger: {
  getAttribute(name: string): string | null;
}): { title: string; media: string } | null {
  const title = String(trigger.getAttribute("data-feature-title") ?? "").trim();
  const media = normalizeFeatureMediaSrc(trigger.getAttribute("data-feature-media") ?? "");
  if (!title || !media) return null;
  return { title, media };
}

export type FeaturePreviewClickEvent = {
  preventDefault: () => void;
  stopPropagation: () => void;
  target: unknown;
};

function isElementLike(node: unknown): node is Element {
  return (
    node !== null &&
    typeof node === "object" &&
    "closest" in node &&
    typeof (node as Element).closest === "function"
  );
}

/** Resolves a feature card button from a click target; does not navigate or scroll. */
export function resolveFeaturePreviewTriggerFromClick(target: unknown): HTMLElement | null {
  if (!isElementLike(target)) return null;
  const trigger = target.closest(FEATURE_PREVIEW_TRIGGER_SELECTOR);
  if (!trigger || trigger.tagName !== "BUTTON") return null;
  const type = trigger.getAttribute("type");
  if (type && type !== "button") return null;
  if (trigger.hasAttribute("href")) return null;
  return trigger as HTMLElement;
}

/**
 * Handles feature card click: blocks default/propagation only for valid triggers.
 */
export function handleFeaturePreviewOpenClick(event: FeaturePreviewClickEvent): HTMLElement | null {
  const trigger = resolveFeaturePreviewTriggerFromClick(event.target);
  if (!trigger) return null;
  event.preventDefault();
  event.stopPropagation();
  return trigger;
}

let featurePreviewReturnFocus: HTMLElement | null = null;

function getFeaturePreviewElements() {
  const modal = document.querySelector("[data-patterns-feature-preview-modal]");
  if (!(modal instanceof HTMLElement)) return null;
  const titleEl = modal.querySelector("[data-patterns-feature-preview-title]");
  const mediaEl = modal.querySelector("[data-patterns-feature-preview-media]");
  const closeBtn = modal.querySelector("[data-patterns-feature-preview-close]");
  return {
    modal,
    titleEl: titleEl instanceof HTMLElement ? titleEl : null,
    mediaEl: mediaEl instanceof HTMLImageElement ? mediaEl : null,
    closeBtn: closeBtn instanceof HTMLButtonElement ? closeBtn : null,
  };
}

function setFeaturePreviewModalOpen(modal: HTMLElement, open: boolean) {
  modal.hidden = !open;
  modal.classList.toggle("is-open", open);
  modal.setAttribute("aria-hidden", open ? "false" : "true");
}

function focusWithoutScroll(el: HTMLElement | null | undefined) {
  if (!el || typeof el.focus !== "function") return;
  try {
    el.focus({ preventScroll: true });
  } catch {
    el.focus();
  }
}

function ensureFeaturePreviewModalOnBody(): HTMLElement | null {
  const modal = document.querySelector("[data-patterns-feature-preview-modal]");
  if (!(modal instanceof HTMLElement)) return null;
  if (modal.parentElement !== document.body) {
    document.body.appendChild(modal);
  }
  return modal;
}

export function closePatternsFeaturePreviewModal() {
  const els = getFeaturePreviewElements();
  if (!els) return;

  if (els.mediaEl) {
    els.mediaEl.removeAttribute("src");
    els.mediaEl.alt = "";
  }
  if (els.titleEl) {
    els.titleEl.textContent = "";
  }

  setFeaturePreviewModalOpen(els.modal, false);
  document.body.classList.remove("patterns-feature-preview-open");

  const ref = featurePreviewReturnFocus;
  featurePreviewReturnFocus = null;
  focusWithoutScroll(ref);
}

export function openPatternsFeaturePreviewModal(trigger: HTMLElement) {
  const payload = readFeaturePreviewFromTrigger(trigger);
  if (!payload) return;

  const els = getFeaturePreviewElements();
  if (!els?.mediaEl) return;

  featurePreviewReturnFocus = trigger;

  if (els.titleEl) {
    els.titleEl.textContent = payload.title;
  }
  els.modal.setAttribute("aria-label", payload.title);
  els.mediaEl.alt = payload.title;
  els.mediaEl.src = payload.media;

  setFeaturePreviewModalOpen(els.modal, true);
  document.body.classList.add("patterns-feature-preview-open");
  focusWithoutScroll(els.closeBtn);
}

export function initPatternsFeaturePreviewModal(root: ParentNode = document) {
  if (!root.querySelector(FEATURE_PREVIEW_ROOT_SELECTOR)) return;
  if (document.documentElement.getAttribute("data-patterns-feature-preview-initialized") === "true") {
    return;
  }
  document.documentElement.setAttribute("data-patterns-feature-preview-initialized", "true");

  const modal = ensureFeaturePreviewModalOnBody();
  if (!modal) return;

  setFeaturePreviewModalOpen(modal, false);

  document.addEventListener("click", (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;

    const trigger = handleFeaturePreviewOpenClick(e);
    if (trigger) {
      openPatternsFeaturePreviewModal(trigger);
      return;
    }

    if (target.closest("[data-patterns-feature-preview-close]")) {
      e.preventDefault();
      e.stopPropagation();
      closePatternsFeaturePreviewModal();
      return;
    }

    const dialog = target.closest("[data-patterns-feature-preview-dialog]");
    if (!dialog && target.closest("[data-patterns-feature-preview-modal]")) {
      closePatternsFeaturePreviewModal();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const els = getFeaturePreviewElements();
    if (!els || els.modal.hidden) return;
    closePatternsFeaturePreviewModal();
  });
}

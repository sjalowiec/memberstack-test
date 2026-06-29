import { hydrateGlossaryTooltipPlaceholders } from "./glossaryTooltipHydrate";

const GLOSSARY_TERM_LINK_SELECTOR =
  'a.glossary-link[href^="/glossary/"], a[href^="/glossary/"].glossary-link';

let modalListenersBound = false;
let linkClickBound = false;

export function glossarySlugFromTermHref(href: string): string | null {
  const trimmed = (href ?? "").trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^\/glossary\/([^/?#]+)/i);
  if (!match?.[1]) return null;
  return decodeURIComponent(match[1].replace(/\/$/, ""));
}

function getModalElements() {
  const modalRoot = document.getElementById("glossaryModal");
  const modalBody = document.getElementById("glossaryModalBody");
  const modalTitleEl = document.getElementById("glossaryModalTitle");
  const closeBtn = modalRoot?.querySelector(".glossaryModal__close") ?? null;
  const modalBackdrop = modalRoot?.querySelector(".glossaryModal__backdrop") ?? null;
  return { modalRoot, modalBody, modalTitleEl, closeBtn, modalBackdrop };
}

function closeGlossaryTermModal() {
  const { modalRoot } = getModalElements();
  if (!modalRoot) return;
  modalRoot.classList.remove("is-open");
  modalRoot.hidden = true;
  document.body.style.overflow = "";
}

export function openGlossaryTermModal(slug: string) {
  const normalizedSlug = (slug ?? "").trim().replace(/\/$/, "");
  if (!normalizedSlug) return;

  const { modalRoot, modalBody, modalTitleEl, closeBtn } = getModalElements();
  if (!modalRoot || !modalBody) return;

  modalRoot.hidden = false;
  modalRoot.classList.add("is-open");
  document.body.style.overflow = "hidden";
  modalBody.innerHTML = "<p>Loading…</p>";
  if (modalTitleEl) modalTitleEl.textContent = "";
  if (closeBtn instanceof HTMLElement) closeBtn.focus();

  (window as Window & { __kbmOpenGlossaryTermModal?: (slug: string) => void }).__kbmOpenGlossaryTermModal =
    openGlossaryTermModal;

  void fetch(`/glossary/modal/${encodeURIComponent(normalizedSlug)}/`)
    .then((res) => res.text())
    .then((html) => {
      const doc = new DOMParser().parseFromString(html, "text/html");
      const container =
        doc.querySelector("main.glossaryEntry") ?? doc.querySelector("[data-glossary-entry]");
      modalBody.innerHTML = container ? container.outerHTML : html;

      const heading = modalBody.querySelector(
        ".glossaryEntry h1, .glossaryEntry h2, .glossary-entry__title, h1, h2",
      );
      const title = heading?.textContent?.trim() ?? "";
      if (modalTitleEl) modalTitleEl.textContent = title;

      modalBody.querySelectorAll("img").forEach((img) => {
        if (img.closest(".glossary-related-tools")) return;
        img.style.maxWidth = "100%";
        img.style.height = "auto";
      });

      hydrateGlossaryTooltipPlaceholders(modalBody);
    })
    .catch(() => {
      modalBody.innerHTML = "<p>Could not load glossary entry.</p>";
    });
}

function bindModalChrome() {
  if (modalListenersBound) return;
  modalListenersBound = true;

  const { closeBtn, modalBackdrop } = getModalElements();
  closeBtn?.addEventListener("click", closeGlossaryTermModal);
  modalBackdrop?.addEventListener("click", closeGlossaryTermModal);

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const { modalRoot } = getModalElements();
    if (!modalRoot?.classList.contains("is-open")) return;
    closeGlossaryTermModal();
  });
}

/** Intercept in-content glossary links and open the shared modal instead of navigating. */
export function bindGlossaryTermLinks(root: ParentNode = document) {
  bindModalChrome();

  if (linkClickBound) return;
  linkClickBound = true;

  root.addEventListener(
    "click",
    (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest(GLOSSARY_TERM_LINK_SELECTOR);
      if (!(anchor instanceof HTMLAnchorElement)) return;

      const slug = glossarySlugFromTermHref(anchor.getAttribute("href") ?? "");
      if (!slug) return;

      event.preventDefault();
      event.stopPropagation();
      openGlossaryTermModal(slug);
    },
    true,
  );
}

export function initGlossaryTermModal() {
  bindModalChrome();
  bindGlossaryTermLinks(document);

  const w = window as Window & {
    __kbmOpenGlossaryTermModal?: (slug: string) => void;
    __kbmHydrateGlossaryTooltips?: typeof hydrateGlossaryTooltipPlaceholders;
  };
  w.__kbmOpenGlossaryTermModal = openGlossaryTermModal;
  w.__kbmHydrateGlossaryTooltips = hydrateGlossaryTooltipPlaceholders;
}

import { hydrateGlossaryTooltipPlaceholders } from "./glossaryTooltipHydrate";

const COURSE_GLOSSARY_ROOT_SELECTOR = ".legacy-course, .course-preview, .legacy-content";

let modalListenersBound = false;
let linkClickBound = false;
let returnFocus: HTMLElement | null = null;

function glossaryPathname(href: string): string | null {
  const trimmed = (href ?? "").trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      const host = url.hostname.replace(/^www\./i, "");
      if (!/knititnow\.com$/i.test(host)) return null;
      return url.pathname;
    } catch {
      return null;
    }
  }
  if (!trimmed.startsWith("/")) return null;
  return trimmed.split(/[?#]/, 1)[0] ?? null;
}

/** Term slug for a glossary href, including legacy /glossary/id/slug/term addresses. */
export function glossarySlugFromTermHref(href: string): string | null {
  const pathname = glossaryPathname(href);
  if (!pathname) return null;
  const match = pathname.match(/^\/glossary\/(.+?)\/?$/i);
  if (!match?.[1]) return null;
  const parts = match[1]
    .split("/")
    .filter(Boolean)
    .map((part) => decodeURIComponent(part));
  if (parts.length === 0 || parts[0]!.toLowerCase() === "modal") return null;
  if (parts.length === 1) return parts[0]!;
  const slug = parts.find(
    (part, index) => index > 0 && !/^\d+$/.test(part) && part.toLowerCase() !== "term",
  );
  return slug ?? null;
}

/**
 * Classed glossary links open the modal anywhere the shared script is loaded.
 * Inside a course, a plain glossary-term address does too. The glossary index
 * and other links stay normal navigation.
 */
export function glossaryModalSlugForLink(
  href: string,
  options: { classed?: boolean; inCourse?: boolean },
): string | null {
  if (!options.classed && !options.inCourse) return null;
  return glossarySlugFromTermHref(href);
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
  const wasOpen = modalRoot.classList.contains("is-open");
  modalRoot.classList.remove("is-open");
  modalRoot.hidden = true;
  document.body.style.overflow = "";
  const focusTarget = returnFocus;
  returnFocus = null;
  if (wasOpen && focusTarget && document.contains(focusTarget)) focusTarget.focus();
}

export function openGlossaryTermModal(slug: string, opener?: HTMLElement | null) {
  const normalizedSlug = (slug ?? "").trim().replace(/\/$/, "");
  if (!normalizedSlug) return;
  if (opener) returnFocus = opener;

  const { modalRoot, modalBody, modalTitleEl, closeBtn } = getModalElements();
  if (!modalRoot || !modalBody) return;

  modalRoot.hidden = false;
  modalRoot.classList.add("is-open");
  document.body.style.overflow = "hidden";
  modalBody.innerHTML = "<p>Loading...</p>";
  if (modalTitleEl) modalTitleEl.textContent = "";
  if (closeBtn instanceof HTMLElement) closeBtn.focus();

  (window as Window & { __kbmOpenGlossaryTermModal?: (slug: string) => void }).__kbmOpenGlossaryTermModal =
    openGlossaryTermModal;

  void fetch(`/glossary/modal/${encodeURIComponent(normalizedSlug)}/`)
    .then((res) => {
      const finalPath = new URL(res.url, window.location.origin).pathname.replace(/\/$/, "");
      if (!res.ok || finalPath === "/glossary") {
        throw new Error("Glossary entry was not found.");
      }
      return res.text();
    })
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
      if (event.defaultPrevented) return;
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a");
      if (!(anchor instanceof HTMLAnchorElement)) return;

      const slug = glossaryModalSlugForLink(anchor.getAttribute("href") ?? "", {
        classed: anchor.classList.contains("glossary-link"),
        inCourse: Boolean(anchor.closest(COURSE_GLOSSARY_ROOT_SELECTOR)),
      });
      if (!slug) return;

      event.preventDefault();
      event.stopPropagation();
      openGlossaryTermModal(slug, anchor);
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

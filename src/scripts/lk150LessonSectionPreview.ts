import {
  SECTION_QUERY_PARAM,
  parseSectionQueryIndex,
} from "../lib/legacy_kin/coursePreviewPoc";

function getSectionCount(picker: HTMLElement): number {
  return parseInt(picker.dataset.sectionCount ?? "1", 10);
}

function readLinkSectionIndex(link: HTMLElement): number {
  const raw = Number.parseInt(link.dataset.sectionIndex ?? "1", 10);
  if (Number.isNaN(raw)) return 0;
  return raw - 1;
}

function readSectionIndex(picker: HTMLElement): number {
  const count = getSectionCount(picker);
  const params = new URLSearchParams(window.location.search);
  return parseSectionQueryIndex(params.get(SECTION_QUERY_PARAM), count);
}

function updateSectionUrl(oneBasedSection: number): void {
  const url = new URL(window.location.href);
  url.searchParams.set(SECTION_QUERY_PARAM, String(oneBasedSection));
  window.history.replaceState(null, "", url);
}

function updateSectionLinkStates(activeIndex: number): void {
  document.querySelectorAll("[data-lk150-section-link]").forEach((link) => {
    if (!(link instanceof HTMLElement)) return;
    const linkIndex = readLinkSectionIndex(link);
    const isActive = linkIndex === activeIndex;
    link.classList.toggle("course-preview__sidebar-section-link--active", isActive);
    if (link instanceof HTMLAnchorElement) {
      link.setAttribute("aria-current", isActive ? "location" : "false");
    }
  });
}

function showSection(picker: HTMLElement, zeroBasedIndex: number): void {
  const count = getSectionCount(picker);
  const index = Math.min(Math.max(zeroBasedIndex, 0), count - 1);

  picker.querySelectorAll("[data-lk150-section-panel]").forEach((panel, panelIndex) => {
    if (!(panel instanceof HTMLElement)) return;
    panel.hidden = panelIndex !== index;
  });

  updateSectionLinkStates(index);
  updateSectionUrl(index + 1);
}

function scrollToContent(picker: HTMLElement): void {
  const target =
    picker.querySelector("[data-lk150-section-content]") ??
    picker.querySelector(".course-preview__content");
  (target ?? picker).scrollIntoView({ behavior: "smooth", block: "start" });
}

function initPicker(picker: HTMLElement): void {
  showSection(picker, readSectionIndex(picker));

  document.querySelectorAll("[data-lk150-section-link]").forEach((link) => {
    link.addEventListener("click", (event) => {
      if (!(link instanceof HTMLElement)) return;
      event.preventDefault();
      showSection(picker, readLinkSectionIndex(link));
      scrollToContent(picker);
    });
  });

  window.addEventListener("popstate", () => {
    showSection(picker, readSectionIndex(picker));
  });
}

document.querySelectorAll("[data-lk150-section-picker]").forEach((picker) => {
  if (picker instanceof HTMLElement) {
    initPicker(picker);
  }
});

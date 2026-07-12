import { initSortableTables } from "./sortableTable";
import { extractOrdersFragmentHtml } from "./watsonMemberOrdersSection";

export const PDF_PURCHASES_SECTION_SHOW_LABEL = "Show PDF purchases";
export const PDF_PURCHASES_SECTION_HIDE_LABEL = "Hide PDF purchases";

export function formatPdfPurchasesSectionHeading(recordCount: number): string {
  return `Legacy PDF Purchases (${recordCount})`;
}

export function buildPdfPurchasesFragmentUrl(memberid: string): string {
  return `/watson/members/${encodeURIComponent(memberid)}/pdf-purchases-fragment`;
}

export type PdfPurchasesSectionElements = {
  toggle: HTMLButtonElement;
  panel: HTMLElement;
};

export function getPdfPurchasesSectionElements(section: HTMLElement): PdfPurchasesSectionElements | null {
  const toggle = section.querySelector<HTMLButtonElement>("[data-watson-pdf-purchases-section-toggle]");
  const panel = section.querySelector<HTMLElement>("[data-watson-pdf-purchases-panel]");
  if (!toggle || !panel) {
    return null;
  }
  return { toggle, panel };
}

export function setPdfPurchasesSectionExpanded(
  toggle: HTMLButtonElement,
  panel: HTMLElement,
  expanded: boolean,
): void {
  toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
  toggle.textContent = expanded ? PDF_PURCHASES_SECTION_HIDE_LABEL : PDF_PURCHASES_SECTION_SHOW_LABEL;
  panel.hidden = !expanded;
}

export function isPdfPurchasesSectionExpanded(toggle: HTMLButtonElement): boolean {
  return toggle.getAttribute("aria-expanded") === "true";
}

export async function loadPdfPurchasesFragment(
  panel: HTMLElement,
  fragmentUrl: string,
  fetchHtml: typeof fetch = fetch,
): Promise<void> {
  if (panel.dataset.pdfPurchasesLoaded === "true") {
    return;
  }

  const response = await fetchHtml(fragmentUrl, { credentials: "same-origin" });
  if (!response.ok) {
    throw new Error(`Failed to load PDF purchases (${response.status})`);
  }

  const html = await response.text();
  panel.innerHTML = extractOrdersFragmentHtml(html);
  panel.dataset.pdfPurchasesLoaded = "true";
}

export function renderEmptyPdfPurchasesPlaceholder(): string {
  return '<p class="watson__placeholder">No legacy PDF purchase records found for this member.</p>';
}

export function renderPdfPurchasesLoadError(): string {
  return '<p class="watson__status watson__status--error" role="alert">Unable to load PDF purchases.</p>';
}

export function initMemberPdfPurchasesSection(
  section: HTMLElement,
  options: {
    recordCount: number;
    fragmentUrl: string;
    fetchHtml?: typeof fetch;
    initTable?: (root: ParentNode) => void;
  },
): void {
  const elements = getPdfPurchasesSectionElements(section);
  if (!elements) {
    return;
  }

  const { toggle, panel } = elements;
  const fetchHtml = options.fetchHtml ?? fetch;
  const initTable = options.initTable ?? (() => {});

  setPdfPurchasesSectionExpanded(toggle, panel, false);

  toggle.addEventListener("click", async () => {
    if (isPdfPurchasesSectionExpanded(toggle)) {
      setPdfPurchasesSectionExpanded(toggle, panel, false);
      return;
    }

    setPdfPurchasesSectionExpanded(toggle, panel, true);

    if (options.recordCount === 0) {
      if (panel.dataset.pdfPurchasesLoaded !== "true") {
        panel.innerHTML = renderEmptyPdfPurchasesPlaceholder();
        panel.dataset.pdfPurchasesLoaded = "true";
      }
      return;
    }

    if (panel.dataset.pdfPurchasesLoaded === "true") {
      return;
    }

    toggle.disabled = true;
    try {
      await loadPdfPurchasesFragment(panel, options.fragmentUrl, fetchHtml);
      initTable(panel);
    } catch {
      panel.innerHTML = renderPdfPurchasesLoadError();
      panel.dataset.pdfPurchasesLoaded = "false";
    } finally {
      toggle.disabled = false;
    }
  });
}

export function initMemberPdfPurchasesSections(root: ParentNode = document): void {
  const sections = root.querySelectorAll<HTMLElement>("[data-watson-pdf-purchases-section]");
  for (const section of sections) {
    const recordCount = Number.parseInt(section.dataset.recordCount ?? "0", 10);
    const fragmentUrl = section.dataset.pdfPurchasesFragmentUrl;
    if (!fragmentUrl) {
      continue;
    }

    initMemberPdfPurchasesSection(section, {
      recordCount: Number.isNaN(recordCount) ? 0 : recordCount,
      fragmentUrl,
      initTable: (panel) => {
        initSortableTables(panel);
      },
    });
  }
}

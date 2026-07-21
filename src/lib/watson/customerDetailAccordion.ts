import { initSortableTables } from "./sortableTable";
import {
  loadPdfPurchasesFragment,
  renderEmptyPdfPurchasesPlaceholder,
  renderPdfPurchasesLoadError,
} from "./watsonMemberPdfPurchasesSection";

export const CUSTOMER_ACCORDION_GROUP_ATTR = "data-watson-customer-accordion-group";
export const CUSTOMER_ACCORDION_ATTR = "data-watson-customer-accordion";
export const CUSTOMER_PDF_PANEL_ATTR = "data-watson-customer-pdf-panel";

export function formatCustomerAccordionTitle(title: string, count?: number | null): string {
  if (count == null || Number.isNaN(count)) {
    return title;
  }
  return `${title} (${count})`;
}

export function getCustomerAccordionElements(group: HTMLElement): HTMLDetailsElement[] {
  return [...group.querySelectorAll<HTMLDetailsElement>(`[${CUSTOMER_ACCORDION_ATTR}]`)];
}

export function closeOtherCustomerAccordions(
  group: HTMLElement,
  openDetails: HTMLDetailsElement,
): void {
  for (const details of getCustomerAccordionElements(group)) {
    if (details !== openDetails && details.open) {
      details.open = false;
    }
  }
}

async function loadCustomerPdfPanel(
  panel: HTMLElement,
  options: {
    fetchHtml?: typeof fetch;
    initTable?: (root: ParentNode) => void;
  } = {},
): Promise<void> {
  if (panel.dataset.pdfPurchasesLoaded === "true") {
    return;
  }

  const recordCount = Number.parseInt(panel.dataset.recordCount ?? "0", 10);
  const fragmentUrl = panel.dataset.pdfPurchasesFragmentUrl;
  const fetchHtml = options.fetchHtml ?? fetch;
  const initTable = options.initTable ?? ((root) => initSortableTables(root));

  if (!fragmentUrl || Number.isNaN(recordCount) || recordCount === 0) {
    panel.innerHTML = renderEmptyPdfPurchasesPlaceholder();
    panel.dataset.pdfPurchasesLoaded = "true";
    return;
  }

  try {
    await loadPdfPurchasesFragment(panel, fragmentUrl, fetchHtml);
    initTable(panel);
  } catch {
    panel.innerHTML = renderPdfPurchasesLoadError();
    panel.dataset.pdfPurchasesLoaded = "false";
  }
}

function escapeCssIdent(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }
  return value.replace(/([^a-zA-Z0-9_-])/g, "\\$1");
}

export function openCustomerAccordionFromHash(group: HTMLElement, hash = typeof window !== "undefined" ? window.location.hash : ""): void {
  const id = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!id) {
    return;
  }

  const target = group.querySelector<HTMLDetailsElement>(`#${escapeCssIdent(id)}`);
  if (!target || !target.hasAttribute(CUSTOMER_ACCORDION_ATTR)) {
    return;
  }

  target.open = true;
  closeOtherCustomerAccordions(group, target);
}

export function initCustomerDetailAccordions(
  root: ParentNode = document,
  options: {
    fetchHtml?: typeof fetch;
    initTable?: (root: ParentNode) => void;
  } = {},
): void {
  const groups = root.querySelectorAll<HTMLElement>(`[${CUSTOMER_ACCORDION_GROUP_ATTR}]`);

  for (const group of groups) {
    if (group.dataset.watsonCustomerAccordionBound === "1") {
      continue;
    }
    group.dataset.watsonCustomerAccordionBound = "1";

    const accordions = getCustomerAccordionElements(group);
    for (const details of accordions) {
      details.addEventListener("toggle", () => {
        if (!details.open) {
          return;
        }

        closeOtherCustomerAccordions(group, details);

        const pdfPanel = details.querySelector<HTMLElement>(`[${CUSTOMER_PDF_PANEL_ATTR}]`);
        if (pdfPanel) {
          void loadCustomerPdfPanel(pdfPanel, options);
        }
      });
    }

    openCustomerAccordionFromHash(group);
  }
}

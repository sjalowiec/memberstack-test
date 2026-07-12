import { initSortableTables } from "./sortableTable";
import { initOrderItemToggles } from "./watsonOrdersTable";

export const ORDERS_SECTION_SHOW_LABEL = "Show orders";
export const ORDERS_SECTION_HIDE_LABEL = "Hide orders";

export function formatOrdersSectionHeading(orderCount: number): string {
  return `Orders (${orderCount})`;
}

export function buildOrdersFragmentUrl(memberid: string): string {
  return `/watson/members/${encodeURIComponent(memberid)}/orders-fragment`;
}

export function extractOrdersFragmentHtml(html: string): string {
  if (typeof DOMParser !== "undefined") {
    const doc = new DOMParser().parseFromString(html, "text/html");
    return doc.body.innerHTML.trim();
  }

  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return bodyMatch?.[1]?.trim() ?? html.trim();
}

export type OrdersSectionElements = {
  toggle: HTMLButtonElement;
  panel: HTMLElement;
};

export function getOrdersSectionElements(section: HTMLElement): OrdersSectionElements | null {
  const toggle = section.querySelector<HTMLButtonElement>("[data-watson-orders-section-toggle]");
  const panel = section.querySelector<HTMLElement>("[data-watson-orders-panel]");
  if (!toggle || !panel) {
    return null;
  }
  return { toggle, panel };
}

export function setOrdersSectionExpanded(
  toggle: HTMLButtonElement,
  panel: HTMLElement,
  expanded: boolean,
): void {
  toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
  toggle.textContent = expanded ? ORDERS_SECTION_HIDE_LABEL : ORDERS_SECTION_SHOW_LABEL;
  panel.hidden = !expanded;
}

export function isOrdersSectionExpanded(toggle: HTMLButtonElement): boolean {
  return toggle.getAttribute("aria-expanded") === "true";
}

export async function loadOrdersFragment(
  panel: HTMLElement,
  fragmentUrl: string,
  fetchHtml: typeof fetch = fetch,
): Promise<void> {
  if (panel.dataset.ordersLoaded === "true") {
    return;
  }

  const response = await fetchHtml(fragmentUrl, { credentials: "same-origin" });
  if (!response.ok) {
    throw new Error(`Failed to load orders (${response.status})`);
  }

  const html = await response.text();
  panel.innerHTML = extractOrdersFragmentHtml(html);
  panel.dataset.ordersLoaded = "true";
}

export function renderEmptyOrdersPlaceholder(): string {
  return '<p class="watson__placeholder">No store orders found for this member.</p>';
}

export function renderOrdersLoadError(): string {
  return '<p class="watson__status watson__status--error" role="alert">Unable to load orders.</p>';
}

export type InitOrdersTableBehavior = (root: ParentNode) => void;

export function initMemberOrdersSection(
  section: HTMLElement,
  options: {
    orderCount: number;
    fragmentUrl: string;
    fetchHtml?: typeof fetch;
    initOrdersTable?: InitOrdersTableBehavior;
  },
): void {
  const elements = getOrdersSectionElements(section);
  if (!elements) {
    return;
  }

  const { toggle, panel } = elements;
  const fetchHtml = options.fetchHtml ?? fetch;
  const initOrdersTable = options.initOrdersTable ?? (() => {});

  setOrdersSectionExpanded(toggle, panel, false);

  toggle.addEventListener("click", async () => {
    if (isOrdersSectionExpanded(toggle)) {
      setOrdersSectionExpanded(toggle, panel, false);
      return;
    }

    setOrdersSectionExpanded(toggle, panel, true);

    if (options.orderCount === 0) {
      if (panel.dataset.ordersLoaded !== "true") {
        panel.innerHTML = renderEmptyOrdersPlaceholder();
        panel.dataset.ordersLoaded = "true";
      }
      return;
    }

    if (panel.dataset.ordersLoaded === "true") {
      return;
    }

    toggle.disabled = true;
    try {
      await loadOrdersFragment(panel, options.fragmentUrl, fetchHtml);
      initOrdersTable(panel);
      panel.dataset.ordersTableInitialized = "true";
    } catch {
      panel.innerHTML = renderOrdersLoadError();
      panel.dataset.ordersLoaded = "false";
    } finally {
      toggle.disabled = false;
    }
  });
}

export function initMemberOrdersSections(root: ParentNode = document): void {
  const sections = root.querySelectorAll<HTMLElement>("[data-watson-orders-section]");
  for (const section of sections) {
    const orderCount = Number.parseInt(section.dataset.orderCount ?? "0", 10);
    const fragmentUrl = section.dataset.ordersFragmentUrl;
    if (!fragmentUrl) {
      continue;
    }

    initMemberOrdersSection(section, {
      orderCount: Number.isNaN(orderCount) ? 0 : orderCount,
      fragmentUrl,
      initOrdersTable: (panel) => {
        initSortableTables(panel);
        initOrderItemToggles(panel);
      },
    });
  }
}

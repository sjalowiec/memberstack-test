import { initSortableTables } from "./sortableTable";
import { extractOrdersFragmentHtml } from "./watsonMemberOrdersSection";

export const MEMBERSHIP_SECTION_SHOW_LABEL = "Show membership history";
export const MEMBERSHIP_SECTION_HIDE_LABEL = "Hide membership history";

export function formatMembershipSectionHeading(recordCount: number): string {
  return `Membership History (${recordCount})`;
}

export function buildMembershipFragmentUrl(memberid: string): string {
  return `/watson/members/${encodeURIComponent(memberid)}/membership-fragment`;
}

export type MembershipSectionElements = {
  toggle: HTMLButtonElement;
  panel: HTMLElement;
};

export function getMembershipSectionElements(section: HTMLElement): MembershipSectionElements | null {
  const toggle = section.querySelector<HTMLButtonElement>("[data-watson-membership-section-toggle]");
  const panel = section.querySelector<HTMLElement>("[data-watson-membership-panel]");
  if (!toggle || !panel) {
    return null;
  }
  return { toggle, panel };
}

export function setMembershipSectionExpanded(
  toggle: HTMLButtonElement,
  panel: HTMLElement,
  expanded: boolean,
): void {
  toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
  toggle.textContent = expanded ? MEMBERSHIP_SECTION_HIDE_LABEL : MEMBERSHIP_SECTION_SHOW_LABEL;
  panel.hidden = !expanded;
}

export function isMembershipSectionExpanded(toggle: HTMLButtonElement): boolean {
  return toggle.getAttribute("aria-expanded") === "true";
}

export async function loadMembershipFragment(
  panel: HTMLElement,
  fragmentUrl: string,
  fetchHtml: typeof fetch = fetch,
): Promise<void> {
  if (panel.dataset.membershipLoaded === "true") {
    return;
  }

  const response = await fetchHtml(fragmentUrl, { credentials: "same-origin" });
  if (!response.ok) {
    throw new Error(`Failed to load membership history (${response.status})`);
  }

  const html = await response.text();
  panel.innerHTML = extractOrdersFragmentHtml(html);
  panel.dataset.membershipLoaded = "true";
}

export function renderEmptyMembershipPlaceholder(): string {
  return '<p class="watson__placeholder">No legacy subscription records found for this member.</p>';
}

export function renderMembershipLoadError(): string {
  return '<p class="watson__status watson__status--error" role="alert">Unable to load membership history.</p>';
}

export function initMemberMembershipSection(
  section: HTMLElement,
  options: {
    recordCount: number;
    fragmentUrl: string;
    fetchHtml?: typeof fetch;
    initTable?: (root: ParentNode) => void;
  },
): void {
  const elements = getMembershipSectionElements(section);
  if (!elements) {
    return;
  }

  const { toggle, panel } = elements;
  const fetchHtml = options.fetchHtml ?? fetch;
  const initTable = options.initTable ?? (() => {});

  setMembershipSectionExpanded(toggle, panel, false);

  toggle.addEventListener("click", async () => {
    if (isMembershipSectionExpanded(toggle)) {
      setMembershipSectionExpanded(toggle, panel, false);
      return;
    }

    setMembershipSectionExpanded(toggle, panel, true);

    if (options.recordCount === 0) {
      if (panel.dataset.membershipLoaded !== "true") {
        panel.innerHTML = renderEmptyMembershipPlaceholder();
        panel.dataset.membershipLoaded = "true";
      }
      return;
    }

    if (panel.dataset.membershipLoaded === "true") {
      return;
    }

    toggle.disabled = true;
    try {
      await loadMembershipFragment(panel, options.fragmentUrl, fetchHtml);
      initTable(panel);
    } catch {
      panel.innerHTML = renderMembershipLoadError();
      panel.dataset.membershipLoaded = "false";
    } finally {
      toggle.disabled = false;
    }
  });
}

export function initMemberMembershipSections(root: ParentNode = document): void {
  const sections = root.querySelectorAll<HTMLElement>("[data-watson-membership-section]");
  for (const section of sections) {
    const recordCount = Number.parseInt(section.dataset.recordCount ?? "0", 10);
    const fragmentUrl = section.dataset.membershipFragmentUrl;
    if (!fragmentUrl) {
      continue;
    }

    initMemberMembershipSection(section, {
      recordCount: Number.isNaN(recordCount) ? 0 : recordCount,
      fragmentUrl,
      initTable: (panel) => {
        initSortableTables(panel);
      },
    });
  }
}

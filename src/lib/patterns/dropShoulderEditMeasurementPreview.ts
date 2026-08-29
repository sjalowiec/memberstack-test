/**
 * Drop Shoulder Edit Pattern measurement preview tabs (Body / Sleeve).
 * Presentation only — does not persist, save, or recompute pattern math.
 */

export const DROP_SHOULDER_EDIT_PREVIEW_TABS = ["body", "sleeve"] as const;

export type DropShoulderEditPreviewTab = (typeof DROP_SHOULDER_EDIT_PREVIEW_TABS)[number];

export const DROP_SHOULDER_EDIT_PREVIEW_DEFAULT_TAB: DropShoulderEditPreviewTab = "body";

export const DROP_SHOULDER_EDIT_SLEEVE_FIELD_KEYS = [
  "upperArm",
  "sleeveLength",
  "wrist",
  "cuffDepth",
] as const;

export function isDropShoulderEditPreviewTab(value: string | null | undefined): value is DropShoulderEditPreviewTab {
  return value === "body" || value === "sleeve";
}

export function dropShoulderEditPreviewTabForField(key: string): DropShoulderEditPreviewTab {
  return (DROP_SHOULDER_EDIT_SLEEVE_FIELD_KEYS as readonly string[]).includes(key)
    ? "sleeve"
    : "body";
}

export function applyDropShoulderEditPreviewTabSelection(
  tablist: ParentNode,
  tab: DropShoulderEditPreviewTab,
): void {
  tablist.querySelectorAll("[data-ds-edit-preview-tab]").forEach((node) => {
    if (!(node instanceof HTMLElement)) return;
    const selected = node.getAttribute("data-ds-edit-preview-tab") === tab;
    node.setAttribute("aria-selected", selected ? "true" : "false");
    node.classList.toggle("is-active", selected);
  });
}

export function applyDropShoulderEditPreviewChipVisibility(
  overlay: ParentNode,
  tab: DropShoulderEditPreviewTab,
): void {
  overlay.querySelectorAll("[data-ds-preview-tab]").forEach((node) => {
    if (!(node instanceof HTMLElement)) return;
    node.hidden = node.dataset.dsPreviewTab !== tab;
  });
}

export function createDropShoulderEditPreviewTablist(doc: Document): HTMLElement {
  const tablist = doc.createElement("div");
  tablist.className = "ds-edit-preview-tabs";
  tablist.setAttribute("role", "tablist");
  tablist.setAttribute("aria-label", "Measurement preview");
  for (const tab of DROP_SHOULDER_EDIT_PREVIEW_TABS) {
    const btn = doc.createElement("button");
    btn.type = "button";
    btn.setAttribute("role", "tab");
    btn.setAttribute("data-ds-edit-preview-tab", tab);
    btn.textContent = tab === "body" ? "Body" : "Sleeve";
    tablist.append(btn);
  }
  applyDropShoulderEditPreviewTabSelection(tablist, DROP_SHOULDER_EDIT_PREVIEW_DEFAULT_TAB);
  return tablist;
}

import { describe, expect, it } from "vitest";
import {
  isVideoFiltersPanelExpanded,
  setVideoFiltersPanelExpanded,
  syncVideoFiltersLayoutForViewport,
  syncVideoSearchPlaceholder,
  toggleVideoFiltersPanel,
  VIDEO_FILTERS_PANEL_ID,
  VIDEO_FILTERS_TOGGLE_ID,
  VIDEO_SEARCH_PLACEHOLDER_DESKTOP,
  VIDEO_SEARCH_PLACEHOLDER_MOBILE,
} from "./videoToolbarFiltersDisclosure";

/** Minimal DOM stub — suite runs without jsdom. */
function makeEls(expanded = false) {
  const classSet = new Set<string>();
  const attrs = new Map<string, string>();
  attrs.set("aria-controls", VIDEO_FILTERS_PANEL_ID);
  attrs.set("aria-expanded", expanded ? "true" : "false");

  const toggle = {
    id: VIDEO_FILTERS_TOGGLE_ID,
    classList: {
      toggle(name: string, force?: boolean) {
        const on = force === undefined ? !classSet.has(name) : force;
        if (on) classSet.add(name);
        else classSet.delete(name);
        return on;
      },
      contains(name: string) {
        return classSet.has(name);
      },
    },
    setAttribute(name: string, value: string) {
      attrs.set(name, value);
    },
    getAttribute(name: string) {
      return attrs.has(name) ? attrs.get(name)! : null;
    },
  };

  const panelAttrs = new Map<string, string>();
  if (!expanded) panelAttrs.set("hidden", "");

  const panel = {
    id: VIDEO_FILTERS_PANEL_ID,
    hasAttribute(name: string) {
      return panelAttrs.has(name);
    },
    setAttribute(name: string, value: string) {
      panelAttrs.set(name, value);
    },
    removeAttribute(name: string) {
      panelAttrs.delete(name);
    },
  };

  return {
    toggle: toggle as unknown as HTMLElement,
    panel: panel as unknown as HTMLElement,
    classSet,
    attrs,
    panelAttrs,
  };
}

describe("videoToolbarFiltersDisclosure", () => {
  it("starts collapsed and reports expansion from the hidden attribute", () => {
    const els = makeEls(false);
    expect(isVideoFiltersPanelExpanded(els.panel)).toBe(false);
    expect(els.toggle.getAttribute("aria-expanded")).toBe("false");
  });

  it("expands and collapses with aria-expanded and is-expanded", () => {
    const els = makeEls(false);
    setVideoFiltersPanelExpanded(els, true);
    expect(isVideoFiltersPanelExpanded(els.panel)).toBe(true);
    expect(els.panel.hasAttribute("hidden")).toBe(false);
    expect(els.toggle.getAttribute("aria-expanded")).toBe("true");
    expect(els.classSet.has("is-expanded")).toBe(true);

    setVideoFiltersPanelExpanded(els, false);
    expect(isVideoFiltersPanelExpanded(els.panel)).toBe(false);
    expect(els.panel.hasAttribute("hidden")).toBe(true);
    expect(els.toggle.getAttribute("aria-expanded")).toBe("false");
    expect(els.classSet.has("is-expanded")).toBe(false);
  });

  it("toggles open then closed on repeated activation", () => {
    const els = makeEls(false);
    expect(toggleVideoFiltersPanel(els)).toBe(true);
    expect(isVideoFiltersPanelExpanded(els.panel)).toBe(true);
    expect(toggleVideoFiltersPanel(els)).toBe(false);
    expect(isVideoFiltersPanelExpanded(els.panel)).toBe(false);
  });

  it("forces the panel open on desktop and collapsed on mobile layout sync", () => {
    const els = makeEls(false);
    syncVideoFiltersLayoutForViewport(els, false);
    expect(isVideoFiltersPanelExpanded(els.panel)).toBe(true);

    syncVideoFiltersLayoutForViewport(els, true);
    expect(isVideoFiltersPanelExpanded(els.panel)).toBe(false);
  });

  it("uses the short mobile search placeholder and long desktop placeholder", () => {
    const input = { placeholder: "" } as HTMLInputElement;
    syncVideoSearchPlaceholder(input, true);
    expect(input.placeholder).toBe(VIDEO_SEARCH_PLACEHOLDER_MOBILE);
    syncVideoSearchPlaceholder(input, false);
    expect(input.placeholder).toBe(VIDEO_SEARCH_PLACEHOLDER_DESKTOP);
  });
});

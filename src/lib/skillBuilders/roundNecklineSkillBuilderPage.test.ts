import { describe, expect, it } from "vitest";
import { applyShoulderTabSelection } from "./roundNecklineSkillBuilderPage";

type StubButton = HTMLButtonElement & { _attrs: Map<string, string> };
type StubPanel = HTMLElement & { _attrs: Map<string, string> };

function makeTab(controls: string, selected: boolean): StubButton {
  const attrs = new Map<string, string>();
  attrs.set("aria-controls", controls);
  attrs.set("aria-selected", selected ? "true" : "false");
  const tab = {
    _attrs: attrs,
    tabIndex: selected ? 0 : -1,
    getAttribute(name: string) {
      return attrs.has(name) ? attrs.get(name)! : null;
    },
    setAttribute(name: string, value: string) {
      attrs.set(name, value);
    },
  };
  return tab as unknown as StubButton;
}

function makePanel(id: string, hidden: boolean): StubPanel {
  const attrs = new Map<string, string>();
  if (hidden) attrs.set("aria-hidden", "true");
  const panel = {
    id,
    hidden,
    _attrs: attrs,
    getAttribute(name: string) {
      return attrs.has(name) ? attrs.get(name)! : null;
    },
    setAttribute(name: string, value: string) {
      attrs.set(name, value);
    },
    removeAttribute(name: string) {
      attrs.delete(name);
    },
  };
  return panel as unknown as StubPanel;
}

describe("Skill Builder shoulder tabs", () => {
  it("defaults to the left panel and hides the right checklist", () => {
    const leftTab = makeTab("sb-panel-left", true);
    const rightTab = makeTab("sb-panel-right", false);
    const leftPanel = makePanel("sb-panel-left", false);
    const rightPanel = makePanel("sb-panel-right", true);

    applyShoulderTabSelection([leftTab, rightTab], [leftPanel, rightPanel], leftTab);

    expect(leftTab.getAttribute("aria-selected")).toBe("true");
    expect(rightTab.getAttribute("aria-selected")).toBe("false");
    expect(leftTab.tabIndex).toBe(0);
    expect(rightTab.tabIndex).toBe(-1);
    expect(leftPanel.hidden).toBe(false);
    expect(rightPanel.hidden).toBe(true);
    expect(leftPanel.getAttribute("aria-hidden")).toBeNull();
    expect(rightPanel.getAttribute("aria-hidden")).toBe("true");
  });

  it("shows only the right panel when the right tab is selected", () => {
    const leftTab = makeTab("sb-panel-left", true);
    const rightTab = makeTab("sb-panel-right", false);
    const leftPanel = makePanel("sb-panel-left", false);
    const rightPanel = makePanel("sb-panel-right", true);

    applyShoulderTabSelection([leftTab, rightTab], [leftPanel, rightPanel], rightTab);

    expect(leftTab.getAttribute("aria-selected")).toBe("false");
    expect(rightTab.getAttribute("aria-selected")).toBe("true");
    expect(leftTab.tabIndex).toBe(-1);
    expect(rightTab.tabIndex).toBe(0);
    expect(leftPanel.hidden).toBe(true);
    expect(rightPanel.hidden).toBe(false);
    expect(leftPanel.getAttribute("aria-hidden")).toBe("true");
    expect(rightPanel.getAttribute("aria-hidden")).toBeNull();
  });

  it("restores the left panel when switching back", () => {
    const leftTab = makeTab("sb-panel-left", false);
    const rightTab = makeTab("sb-panel-right", true);
    const leftPanel = makePanel("sb-panel-left", true);
    const rightPanel = makePanel("sb-panel-right", false);

    applyShoulderTabSelection([leftTab, rightTab], [leftPanel, rightPanel], leftTab);

    expect(leftPanel.hidden).toBe(false);
    expect(rightPanel.hidden).toBe(true);
    expect(leftTab.getAttribute("aria-selected")).toBe("true");
    expect(rightTab.getAttribute("aria-selected")).toBe("false");
  });
});

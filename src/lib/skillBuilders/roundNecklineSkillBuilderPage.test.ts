import { describe, expect, it } from "vitest";
import {
  applyRoundNecklineWorkspaceMode,
  applyShoulderTabSelection,
  canCreateRoundNecklinePractice,
  formatRoundNecklineSetupSummary,
  parseSkillBuilderGaugeValue,
  readKnownRoundNecklineLeadMember,
  readRoundNecklineGaugeInputs,
  resolveRoundNecklinePracticeCreation,
  setRoundNecklineSetupSummary,
  syncRoundNecklineCreatePracticeButton,
  syncRoundNecklinePracticeSelection,
} from "./roundNecklineSkillBuilderPage";
import { parseRoundNecklinePracticeId } from "./roundNecklineSkillBuilders";

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

describe("Round Neckline setup-to-practice workflow", () => {
  function makeEl(initial: { hidden?: boolean; text?: string } = {}) {
    const attrs = new Map<string, string>();
    const el = {
      hidden: initial.hidden ?? false,
      textContent: initial.text ?? "",
      dataset: {} as Record<string, string>,
      getAttribute(name: string) {
        return attrs.has(name) ? attrs.get(name)! : null;
      },
      setAttribute(name: string, value: string) {
        attrs.set(name, value);
      },
    };
    return el;
  }

  function makePage(parts: {
    setupHidden?: boolean;
    summaryHidden?: boolean;
    resultsHidden?: boolean;
    leadHidden?: boolean;
    exerciseId?: string;
  }) {
    const setup = makeEl({ hidden: parts.setupHidden ?? false });
    const summary = makeEl({ hidden: parts.summaryHidden ?? true });
    const results = makeEl({ hidden: parts.resultsHidden ?? true });
    const lead = makeEl({ hidden: parts.leadHidden ?? true });
    const page = {
      dataset: { sbExercise: parts.exerciseId ?? "shallow-back", sbWorkspace: "" },
      querySelectorAll(selector: string) {
        if (selector === "[data-sb-setup]") return [setup];
        if (selector === "[data-sb-practice]") return [];
        return [];
      },
      querySelector(selector: string) {
        if (selector === "[data-sb-setup-summary]") return summary;
        if (selector === "[data-sb-results]") return results;
        if (selector === "[data-sb-lead-capture]") return lead;
        return null;
      },
    };
    return { page: page as unknown as HTMLElement, setup, summary, results, lead };
  }

  it("shows GET KNITTING only when a practice and both gauge values are valid", () => {
    expect(canCreateRoundNecklinePractice("shallow-back", "", "")).toBe(false);
    expect(canCreateRoundNecklinePractice("shallow-back", "16", "")).toBe(false);
    expect(canCreateRoundNecklinePractice("shallow-back", "", "24")).toBe(false);
    expect(canCreateRoundNecklinePractice("shallow-back", "0", "24")).toBe(false);
    expect(canCreateRoundNecklinePractice("other", "16", "24")).toBe(false);
    expect(canCreateRoundNecklinePractice("shallow-back", "16", "24")).toBe(true);
    expect(canCreateRoundNecklinePractice("deep-front", "28", "40")).toBe(true);
  });

  it("does not build generated practice before the learner deliberately starts it", () => {
    expect(parseSkillBuilderGaugeValue("")).toBeNull();
    expect(readRoundNecklineGaugeInputs({ value: "" }, { value: "" })).toBeNull();
    expect(
      resolveRoundNecklinePracticeCreation("round-neckline-basics", "shallow-back", "", ""),
    ).toBeNull();
    expect(
      resolveRoundNecklinePracticeCreation("round-neckline-basics", "shallow-back", "16", ""),
    ).toBeNull();
  });

  it("collapses the large setup after GET KNITTING and shows the compact summary", () => {
    const { page, setup, summary, results } = makePage({
      setupHidden: false,
      summaryHidden: true,
      resultsHidden: false,
    });

    applyRoundNecklineWorkspaceMode(page, "practice");

    expect(page.dataset.sbWorkspace).toBe("practice");
    expect(setup.hidden).toBe(true);
    expect(summary.hidden).toBe(false);
    expect(results.hidden).toBe(false);
  });

  it("compact summary shows the selected practice and entered gauge", () => {
    expect(formatRoundNecklineSetupSummary("Shallow Back Neckline", 16, 24)).toBe(
      'Shallow Back Neckline · 16 sts × 24 rows per 4"',
    );
    expect(formatRoundNecklineSetupSummary("Deep Front Neckline", 28, 40)).toBe(
      'Deep Front Neckline · 28 sts × 40 rows per 4"',
    );
    const summaryText = makeEl();
    setRoundNecklineSetupSummary(
      summaryText as unknown as HTMLElement,
      "Shallow Back Neckline",
      16,
      24,
    );
    expect(summaryText.textContent).toBe('Shallow Back Neckline · 16 sts × 24 rows per 4"');
  });

  it("Change practice or gauge restores the setup without clearing selection or gauge", () => {
    const stitch = { value: "16" };
    const row = { value: "24" };
    const { page, setup, summary, results } = makePage({
      setupHidden: true,
      summaryHidden: false,
      resultsHidden: false,
      exerciseId: "deep-front",
    });

    applyRoundNecklineWorkspaceMode(page, "setup");

    expect(page.dataset.sbWorkspace).toBe("setup");
    expect(setup.hidden).toBe(false);
    expect(summary.hidden).toBe(true);
    expect(results.hidden).toBe(true);
    expect(page.dataset.sbExercise).toBe("deep-front");
    expect(stitch.value).toBe("16");
    expect(row.value).toBe("24");
  });

  it("keeps CREATE hidden until ready, then shows it again when editing", () => {
    const button = {
      hidden: true,
      disabled: true,
    } as HTMLButtonElement;

    syncRoundNecklineCreatePracticeButton(button, false);
    expect(button.hidden).toBe(true);
    expect(button.disabled).toBe(true);

    syncRoundNecklineCreatePracticeButton(button, true);
    expect(button.hidden).toBe(false);
    expect(button.disabled).toBe(false);
  });

  it("regenerated practice uses the current practice and gauge values", () => {
    const shallow = resolveRoundNecklinePracticeCreation(
      "round-neckline-basics",
      "shallow-back",
      "16",
      "24",
    );
    const deep = resolveRoundNecklinePracticeCreation(
      "round-neckline-basics",
      "deep-front",
      "16",
      "24",
    );
    const finer = resolveRoundNecklinePracticeCreation(
      "round-neckline-basics",
      "shallow-back",
      "28",
      "40",
    );

    expect(shallow?.exerciseId).toBe("shallow-back");
    expect(deep?.exerciseId).toBe("deep-front");
    expect(shallow?.neckDepthRows).toBeLessThan(deep!.neckDepthRows);
    expect(finer?.castOnStitches).not.toBe(shallow?.castOnStitches);
    expect(finer?.rowsBeforeNeckline).not.toBe(shallow?.rowsBeforeNeckline);
    expect(finer?.gauge.stitchesPerFourInches).toBe(28);
    expect(finer?.gauge.rowsPerFourInches).toBe(40);
  });

  it("Shallow/Deep switching still updates the selected practice without creating results", () => {
    const shallow = {
      dataset: { sbPractice: "shallow-back" },
      classList: { toggle() {} },
      setAttribute() {},
    };
    const deep = {
      dataset: { sbPractice: "deep-front" },
      classList: { toggle() {} },
      setAttribute() {},
    };
    const page = {
      dataset: { sbExercise: "shallow-back" },
      querySelectorAll(selector: string) {
        if (selector === "[data-sb-practice]") return [shallow, deep];
        if (selector === "[data-sb-video-exercise]") return [];
        return [];
      },
      querySelector(selector: string) {
        if (selector === '[data-sb-practice="deep-front"]') return deep;
        if (selector === "[data-sb-exercise-description]") return null;
        return null;
      },
    } as unknown as HTMLElement;

    syncRoundNecklinePracticeSelection(page, "deep-front");
    expect(page.dataset.sbExercise).toBe("deep-front");
    expect(parseRoundNecklinePracticeId(page.dataset.sbExercise)).toBe("deep-front");
    expect(
      resolveRoundNecklinePracticeCreation("round-neckline-basics", "deep-front", "", ""),
    ).toBeNull();
  });

  it("shows email capture before generated practice and keeps gauge values", () => {
    const stitch = { value: "16" };
    const row = { value: "24" };
    const { page, setup, summary, results, lead } = makePage({
      setupHidden: false,
      summaryHidden: true,
      resultsHidden: true,
      leadHidden: true,
      exerciseId: "deep-front",
    });

    applyRoundNecklineWorkspaceMode(page, "lead");

    expect(page.dataset.sbWorkspace).toBe("lead");
    expect(setup.hidden).toBe(false);
    expect(lead.hidden).toBe(false);
    expect(results.hidden).toBe(true);
    expect(summary.hidden).toBe(true);
    expect(page.dataset.sbExercise).toBe("deep-front");
    expect(stitch.value).toBe("16");
    expect(row.value).toBe("24");
    expect(
      resolveRoundNecklinePracticeCreation(
        "round-neckline-basics",
        "deep-front",
        stitch.value,
        row.value,
      )?.exerciseId,
    ).toBe("deep-front");
  });

  it("reads a logged-in member email without prompting for one", async () => {
    const member = await readKnownRoundNecklineLeadMember({
      getCurrentMember: async () => ({
        data: {
          id: "ms_1",
          auth: { email: "ada@example.com", firstName: "Ada" },
        },
      }),
    });
    expect(member).toEqual({ email: "ada@example.com", firstName: "Ada" });

    const guest = await readKnownRoundNecklineLeadMember({
      getCurrentMember: async () => ({ data: null }),
    });
    expect(guest).toBeNull();
  });

  it("does not deliver personalized practice while the email capture step is showing", () => {
    const { page, results, lead } = makePage({
      resultsHidden: true,
      leadHidden: true,
    });

    applyRoundNecklineWorkspaceMode(page, "lead");
    expect(lead.hidden).toBe(false);
    expect(results.hidden).toBe(true);

    applyRoundNecklineWorkspaceMode(page, "setup");
    expect(lead.hidden).toBe(true);
    expect(results.hidden).toBe(true);
  });

  it("legacy practice query values still resolve to the same workspace practices", () => {
    expect(parseRoundNecklinePracticeId("shallow-back")).toBe("shallow-back");
    expect(parseRoundNecklinePracticeId("deep-front")).toBe("deep-front");
    expect(parseRoundNecklinePracticeId("other")).toBeNull();
    expect(
      canCreateRoundNecklinePractice(parseRoundNecklinePracticeId("shallow-back"), "", ""),
    ).toBe(false);
  });
});

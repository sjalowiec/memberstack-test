import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  SKILL_BUILDER_PRINT_BUTTON_ATTR,
  bindSkillBuilderPrintButtons,
  printSkillBuilder,
  resetSkillBuilderPrintBindForTests,
} from "./skillBuilderPrint";

const printCss = readFileSync(
  join(process.cwd(), "src/styles/skill-builders-print.css"),
  "utf8",
);
const printButton = readFileSync(
  join(process.cwd(), "src/components/skill-builders/SkillBuilderPrintButton.astro"),
  "utf8",
);

describe("skillBuilderPrint", () => {
  afterEach(() => {
    resetSkillBuilderPrintBindForTests();
    vi.unstubAllGlobals();
  });

  it("printSkillBuilder calls the browser print dialog", () => {
    const print = vi.fn();
    vi.stubGlobal("window", { print });
    printSkillBuilder();
    expect(print).toHaveBeenCalledTimes(1);
  });

  it("binds once with click delegation on the print control attribute", () => {
    const print = vi.fn();
    const listeners: Array<(event: Event) => void> = [];
    const button = {
      nodeType: 1,
      closest: (selector: string) =>
        selector.includes(SKILL_BUILDER_PRINT_BUTTON_ATTR) ? button : null,
    };
    class FakeElement {}
    vi.stubGlobal("Element", FakeElement);
    Object.setPrototypeOf(button, FakeElement.prototype);
    vi.stubGlobal("window", { print, [Symbol.for("bound")]: undefined });
    vi.stubGlobal("document", {
      addEventListener: (_type: string, handler: (event: Event) => void) => {
        listeners.push(handler);
      },
    });

    bindSkillBuilderPrintButtons();
    bindSkillBuilderPrintButtons();
    expect(listeners).toHaveLength(1);

    const preventDefault = vi.fn();
    listeners[0]({ target: button, preventDefault } as unknown as Event);
    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(print).toHaveBeenCalledTimes(1);
  });
});

describe("Skill Builder print control and sheet", () => {
  it("uses a dedicated Skill Builder print button, not the tools PrintButton", () => {
    expect(printButton).toContain('data-sb-print-button');
    expect(printButton).toContain("Print Practice");
    expect(printButton).toContain("bindSkillBuilderPrintButtons");
    expect(printButton).toContain('type="button"');
    expect(printButton).toContain("aria-label");
    expect(printButton).toContain("skill-builders-print.css");
    expect(printButton).not.toContain("kbm-print-button");
    expect(printButton).not.toContain("Print Worksheet");
    expect(printButton).not.toContain("onclick=");
  });

  it("hides chrome, video, gating, completion, and the print control in print CSS", () => {
    expect(printCss).toContain("@media print");
    expect(printCss).toContain("[data-sb-print-hide]");
    expect(printCss).toContain("[data-sb-print-button]");
    expect(printCss).toContain("[data-sb-member-lock]");
    expect(printCss).toContain("header.sb-practice-hero");
    expect(printCss).toContain("page-break-inside: avoid");
    expect(printCss).toContain("break-inside: avoid");
    expect(printCss).toContain("list-style: decimal");
    expect(printCss).not.toContain("zoom:");
    expect(printCss).not.toContain("transform: scale");
  });
});

/**
 * Bust Dart modal: Cancel/close bypass validation; Add/Update commits via form submit.
 * Shared by Sleeveless + Drop Shoulder finished patterns.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const modalSource = readFileSync(
  join(here, "../components/patterns/BustDartPatternModal.astro"),
  "utf8",
);
const clientSource = readFileSync(join(here, "bustDartPatternModalClient.ts"), "utf8");
const helpVideoSource = readFileSync(join(here, "../lib/tools/dartFormulaHelpVideo.ts"), "utf8");
const sleevelessPatternPage = readFileSync(
  join(here, "../pages/patterns/sleeveless/pattern/index.astro"),
  "utf8",
);
const dropShoulderPatternPage = readFileSync(
  join(here, "../pages/patterns/drop-shoulder/pattern/index.astro"),
  "utf8",
);

function buttonBlock(attr: string): string {
  const idx = modalSource.indexOf(attr);
  expect(idx).toBeGreaterThan(-1);
  const start = modalSource.lastIndexOf("<button", idx);
  const end = modalSource.indexOf(">", idx);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return modalSource.slice(start, end + 1);
}

describe("BustDartPatternModal Cancel / close bypass validation", () => {
  it("Cancel is explicitly type=button (not submit)", () => {
    const cancel = buttonBlock("data-bust-dart-modal-cancel");
    expect(cancel).toContain('type="button"');
    expect(cancel).not.toContain('type="submit"');
  });

  it("× close control is explicitly type=button (not submit)", () => {
    const close = buttonBlock("data-bust-dart-modal-close");
    expect(close).toContain('type="button"');
    expect(close).not.toContain('type="submit"');
  });

  it("client wires Cancel and × to closeModal without saving", () => {
    expect(clientSource).toMatch(
      /cancelBtn\?\.addEventListener\("click"[\s\S]*?closeModal\(\)/,
    );
    expect(clientSource).toMatch(
      /closeBtn\?\.addEventListener\("click"[\s\S]*?closeModal\(\)/,
    );
    const closeFn = clientSource.slice(
      clientSource.indexOf("function closeModal"),
      clientSource.indexOf("async function removeDartAndRefresh"),
    );
    expect(closeFn).toContain("modal.close");
    expect(closeFn).not.toContain("applyBustDartConfigToWorkingDraft");
    expect(closeFn).not.toContain("persistBustDartCustomization");
    expect(closeFn).not.toContain("commitBustDartFromModal");
  });

  it("closing restores focus to the opener; Escape uses native dialog close", () => {
    expect(clientSource).toContain("lastFocus");
    expect(clientSource).toContain("openModal(openBtn)");
    expect(clientSource).toMatch(
      /modal\.addEventListener\("close"[\s\S]*?restore\.focus\(\)/,
    );
    expect(modalSource).toContain("<dialog");
  });
});

describe("BustDartPatternModal Add / Update commit path", () => {
  it("Add/Update is type=submit with formnovalidate so custom validation runs", () => {
    const add = buttonBlock("data-bust-dart-modal-add");
    expect(add).toContain('type="submit"');
    expect(add).toContain("formnovalidate");
    expect(add).toContain("kbm-btn-primary");
    const formTag = modalSource.match(/<form\b[^>]*>/)?.[0] ?? "";
    expect(formTag).toContain("data-bust-dart-modal-form");
    expect(formTag).not.toMatch(/method\s*=/);
  });

  it("delegated Add click and form submit both call commitBustDartFromModal (not Cancel)", () => {
    expect(clientSource).toContain("async function commitBustDartFromModal");
    expect(clientSource).toMatch(
      /closest\("\[data-bust-dart-modal-add\]"\)[\s\S]*?commitBustDartFromModal\(\)/,
    );
    expect(clientSource).toMatch(
      /form\?\.addEventListener\("submit"[\s\S]*?ev\.preventDefault\(\)[\s\S]*?commitBustDartFromModal\(\)/,
    );
    expect(clientSource).toContain('setError(modal, "Select a cup size.")');
    expect(clientSource).toContain(
      'setError(modal, "Enter dart width and depth greater than 0.")',
    );
    expect(clientSource).toContain("applyBustDartConfigToWorkingDraft");
    expect(clientSource).toContain("persistBustDartCustomization");
    // Local draft write must refresh the pattern before awaiting cloud persist.
    const commitFn = clientSource.slice(
      clientSource.indexOf("async function commitBustDartFromModal"),
      clientSource.indexOf('form?.addEventListener("submit"'),
    );
    expect(commitFn.indexOf("await refreshPatternView()")).toBeLessThan(
      commitFn.indexOf("persistBustDartCustomization"),
    );
    expect(clientSource).toContain("kbmInvalidateSleevelessPatternRender");
    expect(clientSource).not.toContain("requestSubmit(");
    expect(clientSource).not.toContain("reportValidity(");
    expect(clientSource).not.toContain("checkValidity(");
  });

  it("Sleeveless and Drop Shoulder share the same modal + client", () => {
    expect(sleevelessPatternPage).toContain("BustDartPatternModal");
    expect(dropShoulderPatternPage).toContain("BustDartPatternModal");
    expect(sleevelessPatternPage).toContain("sleevelessPatternBuilderPage");
    expect(dropShoulderPatternPage).toContain("sleevelessPatternBuilderPage");
    const builderBoot = readFileSync(join(here, "sleevelessPatternBuilderPage.ts"), "utf8");
    expect(builderBoot).toContain("initBustDartPatternCustomization");
  });
});

describe("BustDartPatternModal mobile / styled actions", () => {
  it("principal actions use kbm-btn classes (not unstyled Bootstrap btn)", () => {
    expect(buttonBlock("data-bust-dart-modal-cancel")).toContain("kbm-btn");
    expect(buttonBlock("data-bust-dart-modal-cancel")).toContain("kbm-btn-outline");
    expect(buttonBlock("data-bust-dart-modal-add")).toContain("kbm-btn-primary");
    expect(buttonBlock("data-bust-dart-modal-remove")).toContain("kbm-btn-outline");
    expect(buttonBlock("data-bust-dart-modal-remove")).toContain(
      "bust-dart-pattern-modal__btn--remove",
    );
    expect(modalSource).not.toMatch(/class="btn /);
    expect(helpVideoSource).toContain(
      'className: "bust-dart-pattern-modal__watch kbm-btn kbm-btn-outline"',
    );
    expect(helpVideoSource).not.toContain("btn btn-outline-secondary");
  });

  it("defines ~44px touch targets and stacks actions on a phone breakpoint", () => {
    expect(modalSource).toContain("min-height: 44px");
    expect(modalSource).toContain("width: 44px");
    expect(modalSource).toContain("height: 44px");
    expect(modalSource).toContain("@media (max-width: 480px)");
    expect(modalSource).toContain("flex-direction: column-reverse");
    expect(modalSource).toContain("bust-dart-pattern-modal__body");
    expect(modalSource).toContain("overflow-y: auto");
    expect(modalSource).toContain("max-height: min(92dvh");
  });
});

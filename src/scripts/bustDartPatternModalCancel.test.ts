/**
 * Bust Dart modal Cancel / close must bypass required-field validation.
 * Shared by Sleeveless + Drop Shoulder finished patterns (Add and Update).
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
    expect(cancel).not.toContain("formnovalidate");
  });

  it("× close control is explicitly type=button (not submit)", () => {
    const close = buttonBlock("data-bust-dart-modal-close");
    expect(close).toContain('type="button"');
    expect(close).not.toContain('type="submit"');
  });

  it("Add/Update confirmation remains a non-submit button with custom validation in the client", () => {
    const add = buttonBlock("data-bust-dart-modal-add");
    expect(add).toContain('type="button"');
    expect(clientSource).toContain('setError(modal, "Select a cup size.")');
    expect(clientSource).toContain(
      'setError(modal, "Enter dart width and depth greater than 0.")',
    );
    expect(clientSource).toContain("data-bust-dart-modal-add");
    // Confirmation still validates; dismiss paths must not call these APIs.
    expect(clientSource).not.toContain("requestSubmit(");
    expect(clientSource).not.toContain("reportValidity(");
    expect(clientSource).not.toContain("checkValidity(");
  });

  it("client wires Cancel and × to closeModal without saving or validating", () => {
    expect(clientSource).toContain('"[data-bust-dart-modal-cancel]"');
    expect(clientSource).toContain('"[data-bust-dart-modal-close]"');
    expect(clientSource).toMatch(
      /cancelBtn\?\.addEventListener\("click"[\s\S]*?closeModal\(\)/,
    );
    expect(clientSource).toMatch(
      /closeBtn\?\.addEventListener\("click"[\s\S]*?closeModal\(\)/,
    );
    // Form submit is blocked so Enter / accidental submit cannot run constraint validation.
    expect(clientSource).toMatch(
      /form\?\.addEventListener\("submit"[\s\S]*?ev\.preventDefault\(\)/,
    );
    // closeModal only closes the dialog — no apply/persist/remove.
    const closeFn = clientSource.slice(
      clientSource.indexOf("function closeModal"),
      clientSource.indexOf("async function removeDartAndRefresh"),
    );
    expect(closeFn).toContain("modal.close");
    expect(closeFn).not.toContain("applyBustDartConfigToWorkingDraft");
    expect(closeFn).not.toContain("persistBustDartCustomization");
    expect(closeFn).not.toContain("removeBustDartFromWorkingDraft");
    expect(closeFn).not.toContain("setError");
  });

  it("closing restores focus to the opener; Escape uses native dialog close", () => {
    expect(clientSource).toContain("lastFocus");
    expect(clientSource).toContain("openModal(openBtn)");
    expect(clientSource).toMatch(
      /modal\.addEventListener\("close"[\s\S]*?restore\.focus\(\)/,
    );
    // Escape closes <dialog> natively and fires the same close handler (no form submit).
    expect(modalSource).toContain("<dialog");
    expect(modalSource).toContain("data-bust-dart-pattern-modal");
  });

  it("required cup/width/depth stay on the form for Add/Update confirmation only", () => {
    // Fields remain required for accessibility / native hints if ever submitted,
    // but Cancel/× never submit, and the client blocks form submit.
    expect(modalSource).toContain("required");
    expect(modalSource).toContain('id="bust-dart-pattern-cup"');
    expect(modalSource).toContain('id="bust-dart-pattern-width"');
    expect(modalSource).toContain('id="bust-dart-pattern-depth"');
  });

  it("Sleeveless and Drop Shoulder share the same modal + client", () => {
    expect(sleevelessPatternPage).toContain("BustDartPatternModal");
    expect(dropShoulderPatternPage).toContain("BustDartPatternModal");
    expect(sleevelessPatternPage).toContain("sleevelessPatternBuilderPage");
    expect(dropShoulderPatternPage).toContain("sleevelessPatternBuilderPage");
    const builderBoot = readFileSync(join(here, "sleevelessPatternBuilderPage.ts"), "utf8");
    expect(builderBoot).toContain("initBustDartPatternCustomization");
    expect(builderBoot).toContain("bustDartPatternModalClient");
  });

  it("Cancel markup no longer uses method=dialog submit value=cancel", () => {
    expect(modalSource).not.toMatch(
      /data-bust-dart-modal-cancel[^>]*type="submit"|type="submit"[^>]*data-bust-dart-modal-cancel/,
    );
    expect(modalSource).not.toMatch(
      /data-bust-dart-modal-close[^>]*type="submit"|type="submit"[^>]*data-bust-dart-modal-close/,
    );
    // Legacy submit-cancel pairing removed from both dismiss controls.
    const cancel = buttonBlock("data-bust-dart-modal-cancel");
    const close = buttonBlock("data-bust-dart-modal-close");
    expect(cancel).not.toContain('value="cancel"');
    expect(close).not.toContain('value="cancel"');
  });
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const gaugeInputAstro = readFileSync(resolve("src/components/wizards/GaugeInput.astro"), "utf8");

describe("GaugeInput formFields mode", () => {
  it("renders short titles and unit hints instead of long floating labels", () => {
    expect(gaugeInputAstro).toContain("formFields");
    expect(gaugeInputAstro).toContain("gauge-input-wrapper--form-fields");
    expect(gaugeInputAstro).toContain("editWorkspaceGaugeFieldTitle");
    expect(gaugeInputAstro).toContain("editWorkspaceGaugeUnitDescription");
    expect(gaugeInputAstro).toContain('data-gauge-hint="stitch"');
    expect(gaugeInputAstro).toContain('data-gauge-hint="row"');
  });

  it("keeps form-fields single-column below 700px and hides the × divider in that mode", () => {
    expect(gaugeInputAstro).toMatch(
      /\.gauge-input-wrapper--form-fields \.gauge-form-fields\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/,
    );
    expect(gaugeInputAstro).toMatch(
      /@media \(min-width:\s*700px\)[\s\S]*\.gauge-input-wrapper--form-fields \.gauge-form-fields\s*\{[\s\S]*grid-template-columns:\s*repeat\(2/,
    );
    // Form-fields markup has no gauge-divider × between stitch/row fields.
    const formFieldsBlock = gaugeInputAstro.slice(
      gaugeInputAstro.indexOf("{formFields ? ("),
      gaugeInputAstro.indexOf(") : ("),
    );
    expect(formFieldsBlock).not.toContain("gauge-divider");
  });

  it("overrides floating-label nowrap only in the default (non-formFields) chip path", () => {
    expect(gaugeInputAstro).toContain("white-space: nowrap !important");
    expect(gaugeInputAstro).toContain("gauge-form-field__label");
    expect(gaugeInputAstro).toMatch(
      /\.gauge-form-field__label\s*\{[\s\S]*white-space:\s*normal/,
    );
  });
});

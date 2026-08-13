import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  SKILL_BUILDER_ROW_GAUGE_LABEL,
  SKILL_BUILDER_STITCH_GAUGE_LABEL,
  skillBuilderGaugeLabels,
} from "./skillBuilderGaugeLabels";

const ROOT = process.cwd();
const SKILL_BUILDER_DIRS = [
  join(ROOT, "src/components/skill-builders"),
  join(ROOT, "src/pages/learn/skill-builders"),
];

function listFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...listFiles(full));
    else out.push(full);
  }
  return out;
}

describe("Skill Builder gauge field labels", () => {
  it("keeps Sts (4″/10 cm) and Rows (4″/10 cm) in both unit modes", () => {
    const expected = {
      stitch: "Sts (4″/10 cm)",
      row: "Rows (4″/10 cm)",
    };
    expect(SKILL_BUILDER_STITCH_GAUGE_LABEL).toBe(expected.stitch);
    expect(SKILL_BUILDER_ROW_GAUGE_LABEL).toBe(expected.row);
    expect(skillBuilderGaugeLabels("in")).toEqual(expected);
    expect(skillBuilderGaugeLabels("cm")).toEqual(expected);
    expect(skillBuilderGaugeLabels("in")).toEqual(skillBuilderGaugeLabels("cm"));
  });

  it("uses locked combined labels on every Skill Builder that asks for gauge", () => {
    const wrapper = readFileSync(
      join(ROOT, "src/components/skill-builders/SkillBuilderGaugeInput.astro"),
      "utf8",
    );
    expect(wrapper).toContain("lockUnitLabels");
    expect(wrapper).toContain("SKILL_BUILDER_STITCH_GAUGE_LABEL");
    expect(wrapper).toContain("SKILL_BUILDER_ROW_GAUGE_LABEL");
    expect(wrapper).toContain("stitchLabelInches={SKILL_BUILDER_STITCH_GAUGE_LABEL}");
    expect(wrapper).toContain("stitchLabelCm={SKILL_BUILDER_STITCH_GAUGE_LABEL}");
    expect(wrapper).toContain("rowLabelInches={SKILL_BUILDER_ROW_GAUGE_LABEL}");
    expect(wrapper).toContain("rowLabelCm={SKILL_BUILDER_ROW_GAUGE_LABEL}");

    const gaugeInput = readFileSync(join(ROOT, "src/components/wizards/GaugeInput.astro"), "utf8");
    expect(gaugeInput).toContain("lockUnitLabels");
    expect(gaugeInput).toContain('data-gauge-lock-labels');
    expect(gaugeInput).toContain('dataset.gaugeLockLabels === "true"');

    const files = SKILL_BUILDER_DIRS.flatMap(listFiles).filter((path) =>
      /\.(astro|ts|tsx)$/.test(path),
    );
    const gaugeAskers = files.filter((path) => {
      if (path.endsWith("SkillBuilderGaugeInput.astro")) return false;
      const source = readFileSync(path, "utf8");
      return /GaugeInput/.test(source) || /stitch-gauge/.test(source);
    });
    expect(gaugeAskers.length).toBeGreaterThan(0);
    for (const path of gaugeAskers) {
      const source = readFileSync(path, "utf8");
      expect(source).toContain("SkillBuilderGaugeInput");
      expect(source).not.toMatch(/from ["'].*wizards\/GaugeInput\.astro["']/);
    }
  });
});

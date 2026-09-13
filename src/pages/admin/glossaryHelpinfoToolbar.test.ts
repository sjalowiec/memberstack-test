import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const adminSource = readFileSync(resolve(process.cwd(), "src/pages/admin/glossary.astro"), "utf8");
const entrySource = readFileSync(resolve(process.cwd(), "src/components/GlossaryEntry.astro"), "utf8");
const apiSource = readFileSync(resolve(process.cwd(), "src/pages/api/admin/glossary.ts"), "utf8");

describe("glossary Helpinfo formatting toolbar", () => {
  it("keeps Helpinfo as a raw HTML textarea with a helper toolbar", () => {
    expect(adminSource).toContain('className = "ga-textarea ga-textarea--helpinfo"');
    expect(adminSource).toContain("insertHelpinfoToolbar(helpTa)");
    expect(adminSource).toContain("Formatting is saved as HTML.");
    expect(adminSource).toContain('helpinfoFmtBtn("bold"');
    expect(adminSource).toContain('helpinfoFmtBtn("italic"');
    expect(adminSource).toContain('helpinfoFmtBtn("underline"');
    expect(adminSource).toContain('helpinfoFmtBtn("ul"');
    expect(adminSource).toContain('helpinfoFmtBtn("ol"');
    expect(adminSource).toContain('helpinfoFmtBtn("br"');
    expect(adminSource).toContain('helpinfoFmtBtn("link"');
  });

  it("inserts the requested HTML wrappers without auto-saving", () => {
    expect(adminSource).toContain('wrapHelpinfoSelection(ta, "<strong>", "</strong>")');
    expect(adminSource).toContain('wrapHelpinfoSelection(ta, "<em>", "</em>")');
    expect(adminSource).toContain('wrapHelpinfoSelection(ta, "<u>", "</u>")');
    expect(adminSource).toContain("wrapHelpinfoLinesAsList(ta, cmd)");
    expect(adminSource).toContain('const text = "<br><br>";');
    expect(adminSource).toContain("window.prompt");
    expect(adminSource).toContain("new Event(\"input\", { bubbles: true })");
    expect(adminSource).not.toContain("applyHelpinfoFormat(ta, cmd);\n        save");
    const saveClick = adminSource.indexOf('document.getElementById("ga-save")');
    const formatClick = adminSource.indexOf("applyHelpinfoFormat(ta, cmd)");
    expect(formatClick).toBeGreaterThan(-1);
    expect(saveClick).toBeGreaterThan(-1);
    expect(formatClick).not.toBe(saveClick);
  });

  it("still saves glossary.json as a JSON array of entries", () => {
    expect(adminSource).toContain('fetch("/api/admin/glossary"');
    expect(adminSource).toContain("JSON.stringify(glossary)");
    expect(apiSource).toContain("src/data/glossary.json");
    expect(apiSource).toContain("JSON.stringify(body, null, 2)");
  });

  it("leaves public modal rendering as HTML helpinfo", () => {
    expect(entrySource).toContain("set:html={helpinfoRaw}");
  });
});

import { describe, expect, it } from "vitest";

import {
  formatWatsonTableCell,
  joinWatsonDisplayParts,
  WATSON_REPLACEMENT_CHARACTER,
} from "./displayFormat";
import { formatMemberDisplayName } from "./memberSearch";

describe("displayFormat", () => {
  it("renders missing table values as blank", () => {
    expect(formatWatsonTableCell(null)).toBe("");
    expect(formatWatsonTableCell(undefined)).toBe("");
    expect(formatWatsonTableCell("   ")).toBe("");
  });

  it("never returns the Unicode replacement character", () => {
    expect(formatWatsonTableCell(WATSON_REPLACEMENT_CHARACTER)).toBe("");
    expect(formatWatsonTableCell(`before${WATSON_REPLACEMENT_CHARACTER}after`)).toBe("");
  });

  it("joins display parts with a plain separator", () => {
    expect(joinWatsonDisplayParts(["Store order", "$12.00", "Paid"])).toBe(
      "Store order - $12.00 - Paid",
    );
    expect(joinWatsonDisplayParts(["Only value", null, ""])).toBe("Only value");
  });

  it("does not use replacement characters in member display fallbacks", () => {
    const displayName = formatMemberDisplayName({ fristname: null, lastname: null });
    expect(displayName).toBe("");
    expect(displayName).not.toContain(WATSON_REPLACEMENT_CHARACTER);
    expect(displayName).not.toBe("?");
  });
});

describe("Watson source files", () => {
  it("does not contain literal replacement characters in watson UI sources", () => {
    const fs = require("node:fs") as typeof import("node:fs");
    const path = require("node:path") as typeof import("node:path");

    const offenders: string[] = [];

    function walk(entryPath: string): void {
      if (!fs.existsSync(entryPath)) {
        return;
      }
      const stat = fs.statSync(entryPath);
      if (stat.isFile()) {
        if (/\.(astro|ts|css)$/.test(entryPath) && fs.readFileSync(entryPath, "utf8").includes(WATSON_REPLACEMENT_CHARACTER)) {
          offenders.push(path.relative(process.cwd(), entryPath));
        }
        return;
      }
      for (const name of fs.readdirSync(entryPath)) {
        walk(path.join(entryPath, name));
      }
    }

    for (const root of [
      "src/lib/watson",
      "src/components/watson",
      "src/pages/watson",
      "src/styles/watson.css",
    ]) {
      walk(path.resolve(root));
    }

    expect(offenders).toEqual([]);
  });
});

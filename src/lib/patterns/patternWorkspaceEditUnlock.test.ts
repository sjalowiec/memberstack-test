import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));

describe("pattern workspace Edit Pattern unlock wiring", () => {
  it("uses per-system edit access and shows the unlock modal instead of hiding Edit", () => {
    const src = readFileSync(
      join(dir, "../../scripts/sleevelessPatternEditDrawerPrototype.ts"),
      "utf-8",
    );

    expect(src).toContain("canEditPatternSettingsForSystem(access, patternSystem)");
    expect(src).toContain("applyLockedPatternEditButtonState(openBtn, true)");
    expect(src).not.toContain("openBtn.hidden = true");
    expect(src).toContain("offerPatternEditingUnlockModal(resolvedAccess, { patternSystem })");
  });
});

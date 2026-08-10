import { describe, expect, it, vi } from "vitest";

describe("sleevelessPatternPageShared module load", () => {
  it("imports without duplicate-binding SyntaxError", async () => {
    // Module assigns window helpers at load time (browser page script).
    vi.stubGlobal("window", {
      location: { pathname: "/patterns/sleeveless/pattern/", href: "http://localhost/patterns/sleeveless/pattern/" },
      addEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });
    vi.stubGlobal("document", {
      readyState: "complete",
      getElementById: () => null,
      querySelector: () => null,
      addEventListener: vi.fn(),
    });
    try {
      const mod = await import("./sleevelessPatternPageShared.ts");
      expect(typeof mod.initSleevelessPatternBuilderPage).toBe("function");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

import { describe, expect, it } from "vitest";

import type { ToolRecord } from "../tools/toolAdminFields";
import {
  isValidLocalToolIcon,
  resolveToolIconFromCatalog,
  resolveWhatsNewToolIcon,
} from "./toolIcon";

describe("resolveWhatsNewToolIcon (canonical tools.json catalog)", () => {
  it("matches a registered tool URL to its local icon", () => {
    expect(
      resolveWhatsNewToolIcon({ category: "tool", destinationUrl: "/tools/slope" }),
    ).toBe("/icons/tools/slope.svg");
    // Trailing slashes and query strings still resolve to the same tool.
    expect(
      resolveWhatsNewToolIcon({ category: "tool", destinationUrl: "/tools/slope/" }),
    ).toBe("/icons/tools/slope.svg");
    expect(
      resolveWhatsNewToolIcon({ category: "tool", destinationUrl: "/tools/slope?ref=whatsnew" }),
    ).toBe("/icons/tools/slope.svg");
  });

  it("returns null for a tool card with no destination URL", () => {
    expect(resolveWhatsNewToolIcon({ category: "tool", destinationUrl: "" })).toBeNull();
    expect(resolveWhatsNewToolIcon({ category: "tool", destinationUrl: null })).toBeNull();
    expect(resolveWhatsNewToolIcon({ category: "tool" })).toBeNull();
  });

  it("returns null for a tool card whose URL matches no registered tool", () => {
    expect(
      resolveWhatsNewToolIcon({ category: "tool", destinationUrl: "/tools/not-a-real-tool" }),
    ).toBeNull();
    expect(
      resolveWhatsNewToolIcon({ category: "tool", destinationUrl: "/patterns/drop-shoulder" }),
    ).toBeNull();
  });

  it("does not show tool icons on non-tool categories, even when linking to a tool", () => {
    for (const category of ["pattern", "resource", "learning", "improvement"]) {
      expect(
        resolveWhatsNewToolIcon({ category, destinationUrl: "/tools/slope" }),
      ).toBeNull();
    }
  });

  it("returns null for external destination URLs", () => {
    expect(
      resolveWhatsNewToolIcon({
        category: "tool",
        destinationUrl: "https://example.com/tools/slope",
      }),
    ).toBeNull();
    expect(
      resolveWhatsNewToolIcon({ category: "tool", destinationUrl: "//evil.example/tools/slope" }),
    ).toBeNull();
  });
});

describe("resolveToolIconFromCatalog (injected catalog)", () => {
  const withIcon: ToolRecord[] = [
    { title: "Widget", href: "/tools/widget", icon: "widget.svg" },
  ];

  it("resolves a matching tool with a valid local icon", () => {
    expect(
      resolveToolIconFromCatalog(
        { category: "tool", destinationUrl: "/tools/widget" },
        withIcon,
      ),
    ).toBe("/icons/tools/widget.svg");
  });

  it("returns null when the matched tool has no icon", () => {
    const noIcon: ToolRecord[] = [{ title: "Widget", href: "/tools/widget" }];
    expect(
      resolveToolIconFromCatalog(
        { category: "tool", destinationUrl: "/tools/widget" },
        noIcon,
      ),
    ).toBeNull();
    const emptyIcon: ToolRecord[] = [
      { title: "Widget", href: "/tools/widget", icon: "   " },
    ];
    expect(
      resolveToolIconFromCatalog(
        { category: "tool", destinationUrl: "/tools/widget" },
        emptyIcon,
      ),
    ).toBeNull();
  });

  it("rejects external or arbitrary image sources on the matched tool", () => {
    const cases = [
      "https://evil.example/x.svg",
      "//evil.example/x.svg",
      "data:image/svg+xml,<svg/>",
      "javascript:alert(1)",
      "../secrets/x.svg",
      "sub/dir/x.svg",
      "x.exe",
    ];
    for (const icon of cases) {
      const catalog: ToolRecord[] = [{ title: "Widget", href: "/tools/widget", icon }];
      expect(
        resolveToolIconFromCatalog(
          { category: "tool", destinationUrl: "/tools/widget" },
          catalog,
        ),
      ).toBeNull();
    }
  });
});

describe("isValidLocalToolIcon", () => {
  it("accepts bare local icon filenames", () => {
    expect(isValidLocalToolIcon("slope.svg")).toBe(true);
    expect(isValidLocalToolIcon("gauge-calculator.svg")).toBe(true);
    expect(isValidLocalToolIcon("FullScaleGraphPaper.svg")).toBe(true);
    expect(isValidLocalToolIcon("icon.png")).toBe(true);
  });

  it("rejects external, arbitrary, or unsafe sources", () => {
    expect(isValidLocalToolIcon("")).toBe(false);
    expect(isValidLocalToolIcon("   ")).toBe(false);
    expect(isValidLocalToolIcon("https://evil.example/x.svg")).toBe(false);
    expect(isValidLocalToolIcon("//evil.example/x.svg")).toBe(false);
    expect(isValidLocalToolIcon("data:image/svg+xml,<svg/>")).toBe(false);
    expect(isValidLocalToolIcon("../secrets/x.svg")).toBe(false);
    expect(isValidLocalToolIcon("dir/x.svg")).toBe(false);
    expect(isValidLocalToolIcon("x.exe")).toBe(false);
    expect(isValidLocalToolIcon("noextension")).toBe(false);
  });
});

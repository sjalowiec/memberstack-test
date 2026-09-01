import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createEmptySockDraft, type SockDraft } from "./sockDraft";
import { createSockSizingAdapter } from "./sockSizing";
import { buildSockPatternFromDraft } from "./sockPatternPage";
import {
  SOCK_PAIR_TAB_SOCK_1,
  SOCK_PAIR_TAB_SOCK_2,
  buildSockPairInstructionTabsHtml,
} from "./sockPairInstructionTabs";

const adapter = createSockSizingAdapter(
  JSON.parse(readFileSync(resolve("public/data/sizing_socks.json"), "utf8")),
);

function completeDraft(overrides: Partial<SockDraft> = {}): SockDraft {
  return createEmptySockDraft({
    sizeSel: "woman_med",
    constructionDirection: "cuff-to-toe",
    footCircumference: "8.5",
    footLength: "9",
    legCircumference: "8.5",
    legLength: "4.5",
    gaugeSlots: {
      inches: { stitch: "28", row: "40" },
      cm: { stitch: "", row: "" },
    },
    availableNeedles: "200",
    ...overrides,
  });
}

function mustPair() {
  const result = buildSockPatternFromDraft(completeDraft(), adapter);
  expect(result.ok, result.ok ? "" : result.message).toBe(true);
  if (!result.ok) throw new Error(result.message);
  return result;
}

describe("Sock 1 / Sock 2 selector", () => {
  it("selects Sock 1 by default and keeps Sock 2's complete mirrored document in the DOM", () => {
    const pair = mustPair();
    const html = buildSockPairInstructionTabsHtml(pair.sock1, pair.sock2);
    expect(html).toContain(`data-socks-pair-tab="${SOCK_PAIR_TAB_SOCK_1}"`);
    expect(html).toContain(`data-socks-pair-tab="${SOCK_PAIR_TAB_SOCK_2}"`);
    expect(html).toMatch(
      /data-socks-pair-tab="sock-1"[^>]*aria-selected="true"/,
    );
    expect(html).toMatch(
      /data-socks-pair-tab="sock-2"[^>]*aria-selected="false"/,
    );
    expect(html).not.toMatch(/data-socks-pair-panel="sock-1"[^>]*\shidden/);
    expect(html).toMatch(/data-socks-pair-panel="sock-2"[^>]*\shidden/);
    expect(html).toContain('data-sock="1"');
    expect(html).toContain('data-sock="2"');
    expect(html).toContain("Sock 1 — Cuff to Toe");
    expect(html).toContain("Sock 2 — Cuff to Toe");
    expect(html).toContain("carriage on the RIGHT");
    expect(html).toContain("carriage on the LEFT");
    expect(html).not.toContain("reverse shaping");
    expect(html.match(/data-section-id="heel"/g)?.length).toBe(2);
    expect(html.match(/data-section-id="toe"/g)?.length).toBe(2);
    const sectionIds = [...html.matchAll(/<section id="([^"]+)"/g)].map(
      (match) => match[1]!,
    );
    expect(sectionIds).toContain("sock-1-heel");
    expect(sectionIds).toContain("sock-2-heel");
    expect(new Set(sectionIds).size).toBe(sectionIds.length);
  });

  it("does not recalculate when switching presentation — both documents are already rendered", () => {
    const src = readFileSync(resolve("src/lib/patterns/sock/sockPairInstructionTabs.ts"), "utf8");
    expect(src).toContain("renderBasicSockInstructionsHtml");
    expect(src).toContain("buildPatternDiagramTabsShellHtml");
    expect(src).not.toMatch(/calculateBasicSockPattern/);
    expect(src).not.toMatch(/buildBasicSockInstructionPair/);
  });
});

describe("print retains both instruction documents", () => {
  it("marks both panels with print headings and relies on Pattern print CSS to un-hide Sock 2", () => {
    const pair = mustPair();
    const html = buildSockPairInstructionTabsHtml(pair.sock1, pair.sock2);
    expect(html).toContain('class="socks-pair-print-heading">Sock 1</h3>');
    expect(html).toContain('class="socks-pair-print-heading">Sock 2</h3>');
    expect(html).toContain("no-print");
    const page = readFileSync(resolve("src/pages/patterns/socks/pattern.astro"), "utf8");
    expect(page).toContain(".socks-pair-tabs__panel[hidden]");
    expect(page).toContain("display: block !important");
    expect(page).toContain(".socks-pair-print-heading");
  });
});

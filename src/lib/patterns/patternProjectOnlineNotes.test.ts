import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyPatternProjectOnlineNotes,
  HAT_PATTERN_ONLINE_NOTES_SELECTORS,
  SLEEVELESS_PATTERN_ONLINE_NOTES_SELECTORS,
} from "./patternProjectOnlineNotes";

class FakeEl {
  textContent = "";
  attrs: Record<string, string> = {};
  setAttribute(name: string, value: string): void {
    this.attrs[name] = value;
  }
  removeAttribute(name: string): void {
    delete this.attrs[name];
  }
  getAttribute(name: string): string | null {
    return this.attrs[name] ?? null;
  }
}

function stubNotesDom(selectors = SLEEVELESS_PATTERN_ONLINE_NOTES_SELECTORS) {
  const wrap = new FakeEl();
  const block = new FakeEl();
  const text = new FakeEl();
  const map: Record<string, FakeEl> = {
    [selectors.wrap]: wrap,
    [selectors.block]: block,
    [selectors.text]: text,
  };
  vi.stubGlobal("HTMLElement", FakeEl);
  vi.stubGlobal("document", { querySelector: (sel: string) => map[sel] ?? null });
  return { wrap, block, text };
}

describe("applyPatternProjectOnlineNotes", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("hides the block when notes are missing or blank", () => {
    const dom = stubNotesDom();
    applyPatternProjectOnlineNotes(null);
    expect(dom.wrap.getAttribute("hidden")).toBe("");
    expect(dom.text.textContent).toBe("");

    applyPatternProjectOnlineNotes("   ");
    expect(dom.wrap.getAttribute("hidden")).toBe("");
    expect(dom.block.getAttribute("hidden")).toBe("");
  });

  it("shows sweater and hat notes with the same presentation helper", () => {
    const sweater = stubNotesDom();
    applyPatternProjectOnlineNotes("Use the blue yarn.");
    expect(sweater.text.textContent).toBe("Use the blue yarn.");
    expect(sweater.wrap.getAttribute("hidden")).toBeNull();
    expect(sweater.block.getAttribute("hidden")).toBeNull();
    vi.unstubAllGlobals();

    const hat = stubNotesDom(HAT_PATTERN_ONLINE_NOTES_SELECTORS);
    applyPatternProjectOnlineNotes("Tension 7\nKnitPicks yarn", {
      selectors: HAT_PATTERN_ONLINE_NOTES_SELECTORS,
    });
    expect(hat.text.textContent).toBe("Tension 7\nKnitPicks yarn");
    expect(hat.wrap.getAttribute("hidden")).toBeNull();
  });
});

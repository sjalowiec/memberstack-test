import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applySleevelessPatternOnlineProjectHeader } from "./sleevelessPatternOnlineProjectHeader";
import { saveCurrentPattern } from "../lib/patterns/patternStorage";
import { SLEEVELESS_PATTERN_ONLINE_HEADING_FALLBACK } from "../lib/patterns/sleevelessPatternProjectMeta";
import { stubLocalStorage } from "../lib/patterns/test/stubLocalStorage";

/**
 * Node-safe DOM stub. `applySleevelessPatternOnlineProjectHeader` guards every element with
 * `instanceof HTMLElement`, so stub HTMLElement to BE this class (instances then pass the check).
 */
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

function stubHeaderDom() {
  const heading = new FakeEl();
  const notesWrap = new FakeEl();
  const notesBlock = new FakeEl();
  const notesText = new FakeEl();
  const map: Record<string, FakeEl> = {
    "[data-sleeveless-pattern-online-heading]": heading,
    "[data-sleeveless-pattern-online-notes-wrap]": notesWrap,
    "[data-sleeveless-pattern-online-notes]": notesBlock,
    "[data-sleeveless-pattern-online-notes-text]": notesText,
  };
  vi.stubGlobal("HTMLElement", FakeEl);
  vi.stubGlobal("document", { querySelector: (sel: string) => map[sel] ?? null });
  return { heading, notesWrap, notesBlock, notesText };
}

describe("applySleevelessPatternOnlineProjectHeader — null-safe notes", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not crash when a loaded saved pattern has empty/missing notes (returns null)", () => {
    // Saved pattern loaded into the working draft with a title but NO notes — the exact state that
    // makes getSleevelessPatternOnlineNotesText() return null, which previously crashed on .trim().
    saveCurrentPattern({
      patternProject: { title: "Sue's Summer Vest", notes: "", titleCustomized: true },
    });
    const dom = stubHeaderDom();

    expect(() => applySleevelessPatternOnlineProjectHeader()).not.toThrow();

    // Header still renders: heading shows the saved title and the notes block is hidden (not shown).
    expect(dom.heading.textContent).toBe("Sue's Summer Vest");
    expect(dom.notesWrap.getAttribute("hidden")).toBe("");
    expect(dom.notesText.textContent).toBe("");
  });

  it("falls back to the generic heading when there is no saved title", () => {
    saveCurrentPattern({ patternProject: { title: "", notes: "" } });
    const dom = stubHeaderDom();

    expect(() => applySleevelessPatternOnlineProjectHeader()).not.toThrow();
    expect(dom.heading.textContent).toBe(SLEEVELESS_PATTERN_ONLINE_HEADING_FALLBACK);
  });

  it("still shows notes when the saved pattern has them", () => {
    saveCurrentPattern({
      patternProject: { title: "Vest", notes: "Use the blue yarn.", titleCustomized: true },
    });
    const dom = stubHeaderDom();

    applySleevelessPatternOnlineProjectHeader();

    expect(dom.notesText.textContent).toBe("Use the blue yarn.");
    expect(dom.notesWrap.getAttribute("hidden")).toBeNull();
    expect(dom.notesBlock.getAttribute("hidden")).toBeNull();
  });
});

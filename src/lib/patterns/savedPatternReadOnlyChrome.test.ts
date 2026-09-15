import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applySavedPatternReadOnlyChrome,
  isSavedPatternReadOnlyDocument,
  SAVED_PATTERN_READONLY_MODE_ATTR,
} from "./savedPatternReadOnlyChrome";

class FakeHTMLElement {
  hidden = false;
  disabled = false;
  readOnly = false;
  attrs = new Map<string, string>();
  getAttribute(name: string): string | null {
    return this.attrs.get(name) ?? null;
  }
  setAttribute(name: string, value: string): void {
    this.attrs.set(name, value);
  }
  removeAttribute(name: string): void {
    this.attrs.delete(name);
  }
  addEventListener(): void {}
}

class FakeHTMLButtonElement extends FakeHTMLElement {}
class FakeHTMLInputElement extends FakeHTMLElement {}
class FakeHTMLTextAreaElement extends FakeHTMLElement {}
class FakeHTMLAnchorElement extends FakeHTMLElement {}

function stubDom(): void {
  vi.stubGlobal("HTMLElement", FakeHTMLElement);
  vi.stubGlobal("HTMLButtonElement", FakeHTMLButtonElement);
  vi.stubGlobal("HTMLInputElement", FakeHTMLInputElement);
  vi.stubGlobal("HTMLTextAreaElement", FakeHTMLTextAreaElement);
  vi.stubGlobal("HTMLAnchorElement", FakeHTMLAnchorElement);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("applySavedPatternReadOnlyChrome", () => {
  it("hides edit, copy, new, builder, and notes controls", () => {
    stubDom();
    const edit = new FakeHTMLAnchorElement();
    const create = new FakeHTMLAnchorElement();
    const notes = new FakeHTMLTextAreaElement();
    const root = {
      querySelectorAll(selector: string) {
        if (selector.includes("data-socks-edit-open")) return [edit];
        if (selector.includes("new=1")) return [create];
        if (selector.includes("data-pattern-project-notes")) return [notes];
        return [];
      },
    } as unknown as ParentNode;
    const html = new FakeHTMLElement();
    vi.stubGlobal("document", { documentElement: html, body: html });

    applySavedPatternReadOnlyChrome(root);

    expect(edit.hidden).toBe(true);
    expect(create.hidden).toBe(true);
    expect(notes.disabled).toBe(true);
    expect(notes.readOnly).toBe(true);
  });

  it("keeps print, glossary help, and embedded Socks technique videos visible", () => {
    stubDom();
    const printBtn = new FakeHTMLButtonElement();
    const glossary = new FakeHTMLElement();
    const video = new FakeHTMLElement();
    const root = {
      querySelectorAll(selector: string) {
        if (selector.includes("data-socks-edit-open") || selector.includes("new=1")) {
          return [];
        }
        return [];
      },
    } as unknown as ParentNode;
    const html = new FakeHTMLElement();
    vi.stubGlobal("document", { documentElement: html, body: html });

    applySavedPatternReadOnlyChrome(root);

    expect(printBtn.hidden).toBe(false);
    expect(glossary.hidden).toBe(false);
    expect(video.hidden).toBe(false);
  });

  it("marks the document as read-only so other scripts can skip mutation", () => {
    stubDom();
    const html = new FakeHTMLElement();
    const body = new FakeHTMLElement();
    vi.stubGlobal("document", {
      documentElement: html,
      body,
      querySelectorAll: () => [],
    });

    applySavedPatternReadOnlyChrome(document);
    expect(isSavedPatternReadOnlyDocument(document)).toBe(true);
    expect(document.documentElement.getAttribute(SAVED_PATTERN_READONLY_MODE_ATTR)).toBe(
      "readonly",
    );
  });
});

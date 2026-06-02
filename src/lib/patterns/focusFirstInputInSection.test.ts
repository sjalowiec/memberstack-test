import { describe, expect, it } from "vitest";
import { focusFirstInputInSection } from "./focusFirstInputInSection";

/**
 * Node-safe DOM stub (the suite runs without jsdom): just enough surface for
 * {@link focusFirstInputInSection} — querySelector(All), disabled, tabindex,
 * visibility, focus(), and a shared mutable `activeElement`.
 */
type FakeDoc = { activeElement: FakeField | null };

type FakeFieldOptions = {
  disabled?: boolean;
  tabindex?: string | null;
  visible?: boolean;
};

class FakeField {
  disabled: boolean;
  visible: boolean;
  focusCalls = 0;
  lastFocusOptions: FocusOptions | undefined;
  private attrs: Record<string, string | null>;
  private doc: FakeDoc;

  constructor(doc: FakeDoc, options: FakeFieldOptions = {}) {
    this.doc = doc;
    this.disabled = options.disabled ?? false;
    this.visible = options.visible ?? true;
    this.attrs = { tabindex: options.tabindex ?? null };
  }

  get ownerDocument(): FakeDoc {
    return this.doc;
  }

  get offsetParent(): unknown {
    return this.visible ? {} : null;
  }

  getClientRects(): { length: number } {
    return { length: this.visible ? 1 : 0 };
  }

  getAttribute(name: string): string | null {
    return this.attrs[name] ?? null;
  }

  focus(options?: FocusOptions): void {
    this.focusCalls += 1;
    this.lastFocusOptions = options;
    this.doc.activeElement = this;
  }
}

class FakeBody {
  constructor(private fields: FakeField[]) {}
  querySelectorAll(): FakeField[] {
    return this.fields;
  }
}

class FakeSection {
  constructor(private body: FakeBody | null) {}
  querySelector(sel: string): FakeBody | null {
    return sel === ".express-acc__body" ? this.body : null;
  }
}

function setup(fieldOptions: FakeFieldOptions[]): {
  doc: FakeDoc;
  section: FakeSection;
  fields: FakeField[];
} {
  const doc: FakeDoc = { activeElement: null };
  const fields = fieldOptions.map((o) => new FakeField(doc, o));
  const section = new FakeSection(new FakeBody(fields));
  return { doc, section, fields };
}

const asSection = (s: FakeSection) => s as unknown as HTMLElement;

describe("focusFirstInputInSection", () => {
  it("focuses the first visible, enabled field and prevents scroll", () => {
    const { doc, section, fields } = setup([{}, {}]);

    focusFirstInputInSection(asSection(section));

    expect(fields[0].focusCalls).toBe(1);
    expect(fields[0].lastFocusOptions).toEqual({ preventScroll: true });
    expect(fields[1].focusCalls).toBe(0);
    expect(doc.activeElement).toBe(fields[0]);
  });

  it("skips disabled, tabindex=-1, and not-yet-rendered fields", () => {
    const { section, fields } = setup([
      { disabled: true },
      { tabindex: "-1" },
      { visible: false },
      {},
    ]);

    focusFirstInputInSection(asSection(section));

    expect(fields[0].focusCalls).toBe(0);
    expect(fields[1].focusCalls).toBe(0);
    expect(fields[2].focusCalls).toBe(0);
    expect(fields[3].focusCalls).toBe(1);
  });

  it("does nothing when the first eligible field already has focus", () => {
    const { doc, section, fields } = setup([{}, {}]);
    doc.activeElement = fields[0];

    focusFirstInputInSection(asSection(section));

    expect(fields[0].focusCalls).toBe(0);
    expect(fields[1].focusCalls).toBe(0);
  });

  it("no-ops when the section has no accordion body", () => {
    const section = new FakeSection(null);
    expect(() => focusFirstInputInSection(asSection(section))).not.toThrow();
  });
});

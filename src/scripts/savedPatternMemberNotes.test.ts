import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { stubLocalStorage } from "../lib/patterns/test/stubLocalStorage";

vi.mock("../lib/patterns/customPatternProjectClient", () => ({
  loadCustomPatternProject: vi.fn(),
  patchCustomPatternProjectMemberNotes: vi.fn(),
}));

import {
  loadCustomPatternProject,
  patchCustomPatternProjectMemberNotes,
} from "../lib/patterns/customPatternProjectClient";
import {
  bindSavedPatternMemberNotes,
  resetSavedPatternMemberNotesForTests,
} from "./savedPatternMemberNotes";

class FakeEl {
  tag = "el";
  textContent = "";
  value = "";
  hidden = false;
  disabled = false;
  readOnly = false;
  selectionStart = 0;
  selectionEnd = 0;
  open = false;
  style: { display: string } = { display: "" };
  dataset: Record<string, string> = {};
  attrs: Record<string, string> = {};
  listeners: Record<string, Array<(event?: { preventDefault: () => void }) => void>> = {};
  children: Record<string, FakeEl> = {};
  parent: FakeEl | null = null;

  setAttribute(name: string, value: string): void {
    this.attrs[name] = value;
    if (name === "open") this.open = true;
  }
  getAttribute(name: string): string | null {
    return this.attrs[name] ?? null;
  }
  addEventListener(type: string, fn: (event?: { preventDefault: () => void }) => void): void {
    (this.listeners[type] ??= []).push(fn);
  }
  emit(type: string, event?: { preventDefault: () => void }): void {
    for (const fn of this.listeners[type] ?? []) fn(event);
  }
  click(): void {
    this.emit("click");
  }
  focus(): void {
    focused = this;
  }
  setSelectionRange(start: number, end: number): void {
    this.selectionStart = start;
    this.selectionEnd = end;
  }
  querySelector(selector: string): FakeEl | null {
    return this.children[selector] ?? null;
  }
  closest(selector: string): FakeEl | null {
    if (this.attrs[selector] != null || this.children[selector]) return this;
    return this.parent?.closest(selector) ?? (this.parent?.attrs[selector] != null ? this.parent : null);
  }
  showModal(): void {
    this.open = true;
  }
  close(): void {
    this.open = false;
    this.emit("close");
  }
}

let focused: FakeEl | null = null;

function project(notes?: string) {
  return {
    ok: true as const,
    project: {
      id: "proj-1",
      name: "Sue's vest",
      family: "sleeveless" as const,
      source: "custom-build" as const,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      version: 2,
      pattern: { patternType: "sleeveless" },
      customOverrides: {},
      ...(notes ? { memberNotes: notes } : {}),
    },
  };
}

function mount(href: string) {
  const mark = new FakeEl();
  mark.hidden = true;
  const savedLabel = new FakeEl();
  savedLabel.hidden = true;
  const button = new FakeEl();
  button.hidden = true;
  button.children["[data-saved-pattern-member-notes-mark]"] = mark;
  button.children["[data-saved-pattern-member-notes-saved-label]"] = savedLabel;
  const nav = new FakeEl();
  nav.hidden = true;
  nav.attrs["[data-saved-pattern-sticky-nav]"] = "";
  button.parent = nav;
  const dialog = new FakeEl();
  const textarea = new FakeEl();
  const save = new FakeEl();
  const insertDate = new FakeEl();
  const cancel = new FakeEl();
  const status = new FakeEl();
  const form = new FakeEl();
  const printBody = { textContent: "" };
  const printSection = {
    hidden: true,
    querySelector() {
      return printBody;
    },
    removeAttribute() {
      this.hidden = false;
    },
    setAttribute() {
      this.hidden = true;
    },
  };
  const doc = {
    querySelector(selector: string) {
      const map: Record<string, FakeEl> = {
        "[data-saved-pattern-member-notes-open]": button,
        "[data-saved-pattern-member-notes-save]": save,
        "[data-saved-pattern-member-notes-insert-date]": insertDate,
        "[data-saved-pattern-member-notes-cancel]": cancel,
        "[data-saved-pattern-member-notes-status]": status,
        "[data-saved-pattern-member-notes-form]": form,
      };
      return map[selector] ?? null;
    },
    querySelectorAll(selector: string) {
      return selector === "[data-pattern-print-member-notes]" ? [printSection] : [];
    },
    getElementById(id: string) {
      if (id === "saved-pattern-member-notes-dialog") return dialog;
      if (id === "saved-pattern-member-notes-input") return textarea;
      return null;
    },
  };
  vi.stubGlobal("HTMLElement", FakeEl);
  vi.stubGlobal("HTMLButtonElement", FakeEl);
  vi.stubGlobal("HTMLTextAreaElement", FakeEl);
  vi.stubGlobal("HTMLDialogElement", FakeEl);
  vi.stubGlobal("HTMLFormElement", FakeEl);
  vi.stubGlobal("document", doc);
  vi.stubGlobal("window", { location: { href } });
  bindSavedPatternMemberNotes(doc as unknown as Document);
  return { button, dialog, textarea, save, insertDate, cancel, status, form, mark, savedLabel, nav, printBody, printSection };
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe("My Notes editor", () => {
  beforeEach(() => {
    stubLocalStorage();
    focused = null;
    resetSavedPatternMemberNotesForTests();
    vi.mocked(loadCustomPatternProject).mockReset();
    vi.mocked(patchCustomPatternProjectMemberNotes).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("stays hidden when the view is not a saved pattern", () => {
    const ui = mount("http://localhost/patterns/sleeveless/pattern/");
    expect(ui.button.hidden).toBe(true);
    expect(loadCustomPatternProject).not.toHaveBeenCalled();
  });

  it("loads notes, saves, clears, and keeps text when saving fails", async () => {
    vi.mocked(loadCustomPatternProject).mockResolvedValue(project("Blue yarn"));
    const ui = mount("http://localhost/patterns/sleeveless/pattern/?project=proj-1");
    await flush();
    expect(ui.button.hidden).toBe(false);
    expect(ui.button.style.display).toBe("inline-flex");
    expect(ui.mark.hidden).toBe(false);
    expect(ui.savedLabel.hidden).toBe(false);
    expect(ui.nav.hidden).toBe(false);

    ui.button.click();
    expect(ui.dialog.open).toBe(true);
    expect(ui.button.getAttribute("aria-expanded")).toBe("true");
    expect(ui.status.textContent).toBe("");
    await flush();
    expect(ui.textarea.value).toBe("Blue yarn");
    expect(ui.printBody.textContent).toBe("Blue yarn");
    expect(ui.printSection.hidden).toBe(false);
    expect(ui.textarea.readOnly).toBe(false);
    expect(ui.save.disabled).toBe(false);
    expect(focused).toBe(ui.textarea);

    ui.textarea.value = "Blue yarn and a lifeline";
    vi.mocked(patchCustomPatternProjectMemberNotes).mockResolvedValue({
      ok: false,
      error: "Failed to update project.",
    });
    ui.form.emit("submit", { preventDefault() {} });
    expect(ui.status.textContent).toBe("Saving…");
    await flush();
    expect(patchCustomPatternProjectMemberNotes).toHaveBeenCalledWith(
      "proj-1",
      "Blue yarn and a lifeline",
      "sleeveless",
    );
    expect(ui.textarea.value).toBe("Blue yarn and a lifeline");
    expect(ui.status.textContent).toMatch(/Your text is still here/);
    expect(ui.save.disabled).toBe(false);
    expect(ui.dialog.open).toBe(true);
    expect(focused).toBe(ui.textarea);
    expect(ui.mark.hidden).toBe(false);

    vi.mocked(patchCustomPatternProjectMemberNotes).mockResolvedValue({
      ok: true,
      project: { ...project().project, memberNotes: "Blue yarn and a lifeline" },
    });
    ui.form.emit("submit", { preventDefault() {} });
    await flush();
    expect(ui.dialog.open).toBe(false);
    expect(focused).toBe(ui.button);
    expect(ui.mark.hidden).toBe(false);
    expect(ui.savedLabel.hidden).toBe(false);

    ui.button.click();
    await flush();
    ui.textarea.value = "   ";
    vi.mocked(patchCustomPatternProjectMemberNotes).mockResolvedValue({
      ok: true,
      project: project().project,
    });
    ui.form.emit("submit", { preventDefault() {} });
    await flush();
    expect(ui.dialog.open).toBe(false);
    expect(focused).toBe(ui.button);
    expect(ui.mark.hidden).toBe(true);
    expect(ui.savedLabel.hidden).toBe(true);
    expect(ui.printBody.textContent).toBe("");
    expect(ui.printSection.hidden).toBe(true);
  });

  it("opens an empty editor for an older pattern without notes", async () => {
    vi.mocked(loadCustomPatternProject).mockResolvedValue(project());
    const ui = mount("http://localhost/patterns/set-in-sleeve/pattern/?project=proj-1");
    ui.button.click();
    await flush();
    expect(ui.textarea.value).toBe("");
    expect(ui.save.disabled).toBe(false);
    expect(ui.status.textContent).toBe("");
    expect(ui.mark.hidden).toBe(true);
  });

  it("inserts the local date at the cursor and does not save", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 29, 15, 4));
    vi.mocked(loadCustomPatternProject).mockResolvedValue(project("Yarn before. Yarn after."));
    const ui = mount("http://localhost/patterns/hat/pattern/?project=proj-1");
    ui.button.click();
    await flush();
    ui.textarea.selectionStart = 12;
    ui.textarea.selectionEnd = 12;
    ui.insertDate.click();
    expect(ui.textarea.value).toBe("Yarn before.Oct 29, 2026 Yarn after.");
    expect(ui.textarea.selectionStart).toBe("Yarn before.Oct 29, 2026".length);
    expect(ui.textarea.selectionEnd).toBe(ui.textarea.selectionStart);
    expect(focused).toBe(ui.textarea);
    expect(ui.dialog.open).toBe(true);
    expect(patchCustomPatternProjectMemberNotes).not.toHaveBeenCalled();

    ui.textarea.value = "x".repeat(8000);
    ui.textarea.selectionStart = 8000;
    ui.textarea.selectionEnd = 8000;
    ui.insertDate.click();
    expect(ui.textarea.value).toHaveLength(8000);
    expect(ui.status.textContent).toMatch(/8,000/);
    expect(patchCustomPatternProjectMemberNotes).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("cancels with Escape and returns focus without saving", async () => {
    vi.mocked(loadCustomPatternProject).mockResolvedValue(project("Blue yarn"));
    const ui = mount("http://localhost/patterns/hat/pattern/?project=proj-1");
    ui.button.click();
    await flush();
    ui.textarea.value = "Not saved";
    ui.dialog.emit("cancel");
    ui.dialog.close();
    await Promise.resolve();
    expect(patchCustomPatternProjectMemberNotes).not.toHaveBeenCalled();
    expect(ui.button.getAttribute("aria-expanded")).toBe("false");
    expect(focused).toBe(ui.button);
  });
});

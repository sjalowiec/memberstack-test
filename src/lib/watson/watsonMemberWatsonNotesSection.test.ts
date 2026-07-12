import { describe, expect, it, vi } from "vitest";

import {
  buildWatsonNoteItemApiUrl,
  buildWatsonNotesApiUrl,
  formatWatsonNoteDatePrefix,
  initWatsonNotesPanel,
  prefillWatsonNewNoteTextarea,
} from "./watsonMemberWatsonNotesSection";

type DomElement = {
  hidden: boolean;
  innerHTML: string;
  dataset: Record<string, string>;
  value?: string;
  selectionStart?: number;
  selectionEnd?: number;
  focused?: boolean;
  disabled: boolean;
  matches: (selector: string) => boolean;
  closest: (selector: string) => DomElement | null;
  querySelector: (selector: string) => DomElement | null;
  querySelectorAll: (selector: string) => DomElement[];
  setAttribute: (name: string, value: string) => void;
  removeAttribute: (name: string) => void;
  click: () => void;
  reset?: () => void;
  focus?: () => void;
  setSelectionRange?: (start: number, end: number) => void;
  addEventListener: (type: string, listener: (event?: { target?: DomElement; preventDefault?: () => void }) => void | Promise<void>) => void;
  dispatchEvent: () => Promise<void>;
};

function createTextarea(value = ""): DomElement {
  return {
    hidden: false,
    innerHTML: "",
    dataset: {},
    value,
    selectionStart: value.length,
    selectionEnd: value.length,
    focused: false,
    disabled: false,
    matches: () => false,
    closest: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    setAttribute: () => {},
    removeAttribute: () => {},
    click: () => {},
    focus() {
      this.focused = true;
    },
    setSelectionRange(start, end) {
      this.selectionStart = start;
      this.selectionEnd = end;
    },
    addEventListener: () => {},
    async dispatchEvent() {},
  };
}

function createButton(selector: string): DomElement {
  return {
    hidden: false,
    innerHTML: "",
    dataset: {},
    disabled: false,
    matches(sel) {
      return sel === selector;
    },
    closest(sel) {
      if (sel === "[data-watson-note-item]") {
        return item;
      }
      return null;
    },
    querySelector: () => null,
    querySelectorAll: () => [],
    setAttribute: () => {},
    removeAttribute: () => {},
    click: () => {},
    addEventListener: () => {},
    async dispatchEvent() {},
  };
}

let item: DomElement;
let editForm: DomElement;
let text: DomElement;
let actions: DomElement;
let addForm: DomElement;
let addTextarea: DomElement;
let root: DomElement;

function createRoot(): DomElement {
  addTextarea = createTextarea();
  editForm = {
    hidden: true,
    innerHTML: "",
    dataset: {},
    disabled: false,
    matches(sel) {
      return sel === "[data-watson-note-edit-form]";
    },
    closest: () => item,
    querySelector(sel) {
      if (sel === 'button[type="submit"]') {
        return createButton('button[type="submit"]');
      }
      return null;
    },
    querySelectorAll: () => [],
    setAttribute: () => {},
    removeAttribute: () => {},
    click: () => {},
    addEventListener(type, listener) {
      if (type === "submit") {
        this.dispatchEvent = async () => {
          await listener({ preventDefault: () => {}, target: editForm });
        };
      }
    },
    async dispatchEvent() {},
  };

  text = { ...createTextarea("Original note"), hidden: false };
  actions = { ...createTextarea(), hidden: false };

  item = {
    hidden: false,
    innerHTML: "",
    dataset: { noteId: "note-1" },
    disabled: false,
    matches: () => false,
    closest: () => null,
    querySelector(sel) {
      if (sel === "[data-watson-note-edit-form]") return editForm;
      if (sel === "[data-watson-note-text]") return text;
      if (sel === ".watson-watson-notes__item-actions") return actions;
      if (sel === "[data-watson-note-edit]") return createButton("[data-watson-note-edit]");
      if (sel === "[data-watson-note-delete]") return createButton("[data-watson-note-delete]");
      if (sel === 'button[type="submit"]') return createButton('button[type="submit"]');
      return null;
    },
    querySelectorAll: () => [],
    setAttribute: () => {},
    removeAttribute: () => {},
    click: () => {},
    addEventListener: () => {},
    async dispatchEvent() {},
  };

  addForm = {
    hidden: false,
    innerHTML: "",
    dataset: {},
    disabled: false,
    matches: () => false,
    closest: () => null,
    querySelector(sel) {
      if (sel === 'textarea[name="noteText"]') return addTextarea;
      if (sel === 'select[name="category"]') {
        return { value: "General" } as DomElement;
      }
      if (sel === 'button[type="submit"]') return createButton('button[type="submit"]');
      if (sel === "[data-watson-note-form-status]") {
        return {
          hidden: true,
          textContent: "",
          classList: { toggle: vi.fn() },
          dataset: {},
          innerHTML: "",
          disabled: false,
          matches: () => false,
          closest: () => null,
          querySelector: () => null,
          querySelectorAll: () => [],
          setAttribute: () => {},
          removeAttribute: () => {},
          click: () => {},
          addEventListener: () => {},
          async dispatchEvent() {},
        } as unknown as DomElement;
      }
      return null;
    },
    querySelectorAll: () => [],
    setAttribute: () => {},
    removeAttribute: () => {},
    click: () => {},
    reset: () => {
      addTextarea.value = "";
    },
    addEventListener(type, listener) {
      if (type === "submit") {
        this.dispatchEvent = async () => {
          await listener({ preventDefault: () => {} });
        };
      }
    },
    async dispatchEvent() {},
  };

  root = {
    hidden: false,
    innerHTML: "",
    dataset: { memberid: "member-1" },
    disabled: false,
    matches: () => false,
    closest: () => null,
    querySelector(sel) {
      if (sel === "[data-watson-note-add-form]") return addForm;
      if (sel === "[data-watson-note-item]") return item;
      if (sel === "[data-watson-note-edit]") return createButton("[data-watson-note-edit]");
      if (sel === "[data-watson-note-delete]") return createButton("[data-watson-note-delete]");
      if (sel === "[data-watson-note-form-status]") return addForm.querySelector("[data-watson-note-form-status]");
      return null;
    },
    querySelectorAll: () => [],
    setAttribute: () => {},
    removeAttribute: () => {},
    click: () => {},
    addEventListener(type, listener) {
      if (type === "click") {
        this.click = () => {
          const target = createButton("[data-watson-note-delete]");
          void listener({ target });
        };
      }
      if (type === "submit") {
        this.dispatchEvent = async () => {
          await listener({ target: editForm, preventDefault: () => {} });
        };
      }
    },
    async dispatchEvent() {},
  };

  return root;
}

describe("watsonMemberWatsonNotesSection", () => {
  const localLateNight = new Date(2026, 6, 12, 23, 45);

  it("formats today's local date with colon and trailing space", () => {
    expect(formatWatsonNoteDatePrefix(new Date(2026, 0, 5))).toBe("2026-01-05: ");
    expect(formatWatsonNoteDatePrefix(new Date(2026, 6, 12, 23, 59))).toBe("2026-07-12: ");
  });

  it("prefills the add-note textarea and places the cursor after the date", () => {
    const textarea = createTextarea();
    prefillWatsonNewNoteTextarea(textarea as unknown as HTMLTextAreaElement, localLateNight);

    expect(textarea.value).toBe("2026-07-12: ");
    expect(textarea.selectionStart).toBe("2026-07-12: ".length);
    expect(textarea.selectionEnd).toBe("2026-07-12: ".length);
    expect(textarea.focused).toBe(true);
  });

  it("prefills the add form on panel init", () => {
    const panel = createRoot();
    initWatsonNotesPanel(panel as unknown as HTMLElement, {
      getNow: () => localLateNight,
    });

    expect(addTextarea.value).toBe("2026-07-12: ");
    expect(addTextarea.selectionStart).toBe("2026-07-12: ".length);
    expect(text.value).toBe("Original note");
  });

  it("builds admin API URLs", () => {
    expect(buildWatsonNotesApiUrl("abc")).toBe("/api/watson/members/abc/notes");
    expect(buildWatsonNoteItemApiUrl("note-1")).toBe("/api/watson/notes/note-1");
  });

  it("posts a new note through the admin API", async () => {
    vi.stubGlobal(
      "FormData",
      class {
        get(name: string) {
          if (name === "noteText") return "2026-07-12:   New support note  ";
          if (name === "category") return "General";
          if (name === "createdBy") return "Sue";
          return "";
        }
      },
    );

    const panel = createRoot();
    const onNotesChanged = vi.fn();
    const fetchJson = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, note: { id: "note-2" } }),
    });

    initWatsonNotesPanel(panel as unknown as HTMLElement, {
      fetchJson,
      onNotesChanged,
      getNow: () => localLateNight,
    });

    addTextarea.value = "2026-07-12:   New support note  ";
    await addForm.dispatchEvent();

    expect(fetchJson).toHaveBeenCalledWith(
      "/api/watson/members/member-1/notes",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          noteText: "2026-07-12:   New support note  ",
          category: "General",
          createdBy: "Sue",
        }),
      }),
    );
    expect(onNotesChanged).toHaveBeenCalled();
    expect(addTextarea.value).toBe("2026-07-12: ");
    expect(addTextarea.selectionStart).toBe("2026-07-12: ".length);

    vi.unstubAllGlobals();
  });

  it("does not change edit textarea content on panel init", () => {
    const panel = createRoot();
    initWatsonNotesPanel(panel as unknown as HTMLElement, {
      getNow: () => localLateNight,
    });

    const editTextarea = editForm.querySelector('textarea[name="noteText"]');
    expect(editTextarea).toBeNull();
    expect(text.value).toBe("Original note");
  });

  it("confirms before deleting a note", async () => {
    const panel = createRoot();
    let clickListener: ((event: { target?: DomElement }) => void | Promise<void>) | null = null;
    panel.addEventListener = (type, listener) => {
      if (type === "click") {
        clickListener = listener;
      }
    };
    const confirmDelete = vi.fn().mockReturnValue(false);
    const fetchJson = vi.fn();

    initWatsonNotesPanel(panel as unknown as HTMLElement, {
      fetchJson,
      confirmDelete,
    });

    const deleteButton = createButton("[data-watson-note-delete]");
    await clickListener?.({ target: deleteButton });

    expect(confirmDelete).toHaveBeenCalledWith(
      "Delete this Watson note? This cannot be undone.",
    );
    expect(fetchJson).not.toHaveBeenCalled();
  });

  it("shows edit form when Edit is clicked", async () => {
    const panel = createRoot();
    let clickListener: ((event: { target?: DomElement }) => void | Promise<void>) | null = null;
    panel.addEventListener = (type, listener) => {
      if (type === "click") {
        clickListener = listener;
      }
    };

    initWatsonNotesPanel(panel as unknown as HTMLElement);

    const editButton = createButton("[data-watson-note-edit]");
    await clickListener?.({ target: editButton });

    expect(editForm.hidden).toBe(false);
    expect(text.hidden).toBe(true);
    expect(actions.hidden).toBe(true);
  });
});

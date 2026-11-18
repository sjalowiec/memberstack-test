export type CompactRichTextOptions = {
  /** Shared client/server sanitizer applied on seed, input, and paste. */
  sanitize: (html: string) => string;
  /** Enable the link toolbar button (billboard only). */
  enableLink?: boolean;
  /** Prompt for and validate a link URL when the link button is used. */
  promptLink?: () => string | null;
  /** Show an HTML source editor beside the visual editor. */
  htmlSource?: boolean;
  /**
   * Show a Visual / Edit HTML switch. The HTML view is a textarea.
   * Switching views keeps the current text. Stored text is not replaced
   * until the person edits.
   */
  labeledHtmlToggle?: boolean;
  /**
   * Show the stored value, but do not write it back until the person edits.
   * Plain text stays plain text. Existing Help Hub entries are not rewritten
   * just because the editor opened.
   */
  preserveUntilEdit?: boolean;
};

function valueLooksPlain(value: string): boolean {
  return value.trim() !== "" && !/<\/?[a-z][\s\S]*>/i.test(value);
}

/** Fill the visual editor from the hidden field. */
export function seedCompactRichText(wrap: ParentNode, options: CompactRichTextOptions): void {
  const editor = wrap.querySelector<HTMLElement>("[data-wn-rte-editor]");
  const hidden = wrap.querySelector<HTMLTextAreaElement>("[data-wn-rte-input]");
  const source = wrap.querySelector<HTMLTextAreaElement>("[data-wn-rte-source]");
  if (!editor || !hidden) return;
  const initial = hidden.value;
  if (source) {
    source.value = initial;
    delete source.dataset.dirty;
  }
  if (wrap instanceof HTMLElement) delete wrap.dataset.wnRteEdited;
  if (options.preserveUntilEdit && valueLooksPlain(initial)) {
    editor.textContent = initial;
    editor.style.whiteSpace = "pre-wrap";
    return;
  }
  editor.style.whiteSpace = "";
  editor.innerHTML = options.sanitize(initial) || "<p><br></p>";
  if (!options.preserveUntilEdit) {
    hidden.value = options.sanitize(editor.innerHTML);
  }
}

/** The HTML currently being edited: the source box when it is open, otherwise the visual editor. */
export function readCompactRichTextValue(wrap: ParentNode): string {
  const source = wrap.querySelector<HTMLTextAreaElement>("[data-wn-rte-source]");
  if (source?.dataset.active === "true") return source.value;
  return wrap.querySelector<HTMLElement>("[data-wn-rte-editor]")?.innerHTML ?? "";
}

/** Put sanitized HTML into the visual editor, the source box, and the submitted field. */
export function writeCompactRichTextValue(wrap: ParentNode, html: string): void {
  const editor = wrap.querySelector<HTMLElement>("[data-wn-rte-editor]");
  const hidden = wrap.querySelector<HTMLTextAreaElement>("[data-wn-rte-input]");
  const source = wrap.querySelector<HTMLTextAreaElement>("[data-wn-rte-source]");
  if (editor) editor.innerHTML = html || "<p><br></p>";
  if (hidden) hidden.value = html;
  if (source) source.value = html;
}

/** Sanitize whichever view is open and store that as the value that will be saved. */
export function syncCompactRichText(
  wrap: ParentNode,
  sanitize: (html: string) => string,
): string {
  const clean = sanitize(readCompactRichTextValue(wrap));
  const hidden = wrap.querySelector<HTMLTextAreaElement>("[data-wn-rte-input]");
  const source = wrap.querySelector<HTMLTextAreaElement>("[data-wn-rte-source]");
  if (hidden) hidden.value = clean;
  if (source?.dataset.active === "true") source.value = clean;
  return clean;
}

function exec(cmd: string, value?: string): void {
  try {
    document.execCommand(cmd, false, value);
  } catch {
    // Some browsers reject unsupported commands; ignore.
  }
}

function showSanitizedExplanation(editor: HTMLElement, html: string): void {
  if (valueLooksPlain(html)) {
    editor.textContent = html;
    editor.style.whiteSpace = "pre-wrap";
    return;
  }
  editor.style.whiteSpace = "";
  editor.innerHTML = html || "<p><br></p>";
}

/** Visual / Edit HTML switch. Opening a view does not rewrite the stored field. */
function wireLabeledHtmlToggle(
  wrap: HTMLElement,
  editor: HTMLElement,
  hidden: HTMLTextAreaElement,
  toolbar: HTMLElement,
  options: CompactRichTextOptions,
): void {
  const visualButton = wrap.querySelector<HTMLButtonElement>('[data-wn-rte-mode="visual"]');
  const htmlButton = wrap.querySelector<HTMLButtonElement>('[data-wn-rte-mode="html"]');
  const source = wrap.querySelector<HTMLTextAreaElement>("[data-wn-rte-source]");
  if (!visualButton || !htmlButton || !source) return;

  const setPressed = (htmlMode: boolean): void => {
    visualButton.setAttribute("aria-pressed", htmlMode ? "false" : "true");
    htmlButton.setAttribute("aria-pressed", htmlMode ? "true" : "false");
    visualButton.classList.toggle("is-active", !htmlMode);
    htmlButton.classList.toggle("is-active", htmlMode);
  };

  const showHtml = (): void => {
    if (source.dataset.active !== "true") {
      source.value = hidden.value;
      delete source.dataset.dirty;
    }
    source.dataset.active = "true";
    editor.hidden = true;
    source.hidden = false;
    toolbar.hidden = true;
    setPressed(true);
    source.focus();
  };

  const showVisual = (): void => {
    if (source.dataset.dirty === "true") {
      const clean = options.sanitize(source.value);
      showSanitizedExplanation(editor, clean);
      hidden.value = clean;
      source.value = clean;
      delete source.dataset.dirty;
      wrap.dataset.wnRteEdited = "1";
      hidden.dispatchEvent(new Event("input", { bubbles: true }));
    }
    source.dataset.active = "false";
    source.hidden = true;
    editor.hidden = false;
    toolbar.hidden = false;
    setPressed(false);
    editor.focus();
  };

  visualButton.addEventListener("click", (event) => {
    event.preventDefault();
    showVisual();
  });
  htmlButton.addEventListener("click", (event) => {
    event.preventDefault();
    showHtml();
  });
  source.addEventListener("input", () => {
    source.dataset.dirty = "true";
    hidden.value = source.value;
    hidden.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

/**
 * Wire a compact contenteditable rich-text editor backed by a hidden textarea.
 * Sanitizes on seed/paste/toolbar/Enter using the supplied sanitizer so the
 * submitted value can never carry disallowed markup.
 */
export function initCompactRichText(wrap: HTMLElement, options: CompactRichTextOptions): void {
  if (wrap.dataset.wired === "1") return;
  wrap.dataset.wired = "1";

  const editor = wrap.querySelector<HTMLElement>("[data-wn-rte-editor]");
  const hidden = wrap.querySelector<HTMLTextAreaElement>("[data-wn-rte-input]");
  const toolbar = wrap.querySelector<HTMLElement>("[data-wn-rte-toolbar]");
  if (!editor || !hidden || !toolbar) return;

  const sync = (): void => {
    editor.style.whiteSpace = "";
    hidden.value = options.sanitize(editor.innerHTML);
    wrap.dataset.wnRteEdited = "1";
  };

  seedCompactRichText(wrap, options);

  editor.addEventListener("input", sync);

  editor.addEventListener("paste", (event) => {
    event.preventDefault();
    const clipboard = event.clipboardData;
    const html = clipboard?.getData("text/html") || "";
    const text = clipboard?.getData("text/plain") || "";
    const cleaned = options.sanitize(html || text);
    if (!cleaned) return;
    exec("insertHTML", cleaned);
    sync();
    hidden.dispatchEvent(new Event("input", { bubbles: true }));
  });

  toolbar.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const btn = target.closest<HTMLButtonElement>("[data-wn-rte-cmd]");
    if (!btn) return;
    event.preventDefault();
    editor.focus();

    const cmd = btn.getAttribute("data-wn-rte-cmd");
    switch (cmd) {
      case "bold":
        exec("bold");
        break;
      case "italic":
        exec("italic");
        break;
      case "paragraph":
        exec("formatBlock", "p");
        break;
      case "ul":
        exec("insertUnorderedList");
        break;
      case "ol":
        exec("insertOrderedList");
        break;
      case "link": {
        if (!options.enableLink || !options.promptLink) break;
        const href = options.promptLink();
        if (!href) break;
        exec("createLink", href);
        break;
      }
      case "clear":
        exec("removeFormat");
        exec("unlink");
        break;
      default:
        break;
    }
    sync();
    hidden.dispatchEvent(new Event("input", { bubbles: true }));
  });

  // Keep Enter creating paragraphs in most browsers.
  editor.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    // Default contenteditable Enter behavior; sync after the browser mutates.
    queueMicrotask(sync);
  });

  if (options.labeledHtmlToggle) {
    wireLabeledHtmlToggle(wrap, editor, hidden, toolbar, options);
    return;
  }

  if (!options.htmlSource) return;

  const source = document.createElement("textarea");
  source.className = "watson-wn__rte-source";
  source.dataset.wnRteSource = "";
  source.hidden = true;
  source.spellcheck = false;
  source.setAttribute("aria-label", "HTML source");
  source.value = options.sanitize(hidden.value);
  editor.insertAdjacentElement("afterend", source);

  const note = document.createElement("p");
  note.className = "watson-wn__rte-source-note";
  note.hidden = true;
  note.textContent =
    'HTML source. Images, links, paragraphs, and lists are kept. Add class="center" to center an image, and width="202" to set its width in pixels. The width stays within the screen. Unsafe tags are removed when you return to the visual editor or save.';
  source.insertAdjacentElement("afterend", note);

  const htmlButton = document.createElement("button");
  htmlButton.type = "button";
  htmlButton.className = "watson-wn__rte-btn watson-wn__rte-btn--html";
  htmlButton.dataset.wnRteHtml = "";
  htmlButton.textContent = "Edit HTML";
  htmlButton.title = "Edit the message HTML";
  htmlButton.setAttribute("aria-pressed", "false");
  toolbar.append(htmlButton);

  const showVisual = (): void => {
    const clean = options.sanitize(source.value);
    editor.innerHTML = clean || "<p><br></p>";
    hidden.value = clean;
    source.value = clean;
    source.dataset.active = "false";
    source.hidden = true;
    note.hidden = true;
    editor.hidden = false;
    htmlButton.textContent = "Edit HTML";
    htmlButton.title = "Edit the message HTML";
    htmlButton.setAttribute("aria-pressed", "false");
    editor.focus();
  };

  const showSource = (): void => {
    const clean = options.sanitize(editor.innerHTML);
    source.value = clean;
    hidden.value = clean;
    source.dataset.active = "true";
    editor.hidden = true;
    source.hidden = false;
    note.hidden = false;
    htmlButton.textContent = "Visual editor";
    htmlButton.title = "Return to the visual editor";
    htmlButton.setAttribute("aria-pressed", "true");
    source.focus();
  };

  htmlButton.addEventListener("click", (event) => {
    event.preventDefault();
    if (source.dataset.active === "true") showVisual();
    else showSource();
  });

  source.addEventListener("input", () => {
    hidden.value = source.value;
  });
}

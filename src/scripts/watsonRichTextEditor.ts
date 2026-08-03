export type CompactRichTextOptions = {
  /** Shared client/server sanitizer applied on seed, input, and paste. */
  sanitize: (html: string) => string;
  /** Enable the link toolbar button (billboard only). */
  enableLink?: boolean;
  /** Prompt for and validate a link URL when the link button is used. */
  promptLink?: () => string | null;
};

function exec(cmd: string, value?: string): void {
  try {
    document.execCommand(cmd, false, value);
  } catch {
    // Some browsers reject unsupported commands; ignore.
  }
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
    hidden.value = options.sanitize(editor.innerHTML);
  };

  // Seed visual editor from stored value (plain text or prior HTML).
  editor.innerHTML = options.sanitize(hidden.value) || "<p><br></p>";
  sync();

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
  });

  // Keep Enter creating paragraphs in most browsers.
  editor.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    // Default contenteditable Enter behavior; sync after the browser mutates.
    queueMicrotask(sync);
  });
}

import { sanitizeBillboardHtml } from "../lib/whatsNew/sanitizeBillboardHtml";
import { normalizeWhatsNewDestinationUrl } from "../lib/whatsNew/destinationUrl";

function exec(cmd: string, value?: string): void {
  try {
    document.execCommand(cmd, false, value);
  } catch {
    // Some browsers reject unsupported commands; ignore.
  }
}

function syncHidden(editor: HTMLElement, hidden: HTMLTextAreaElement): void {
  hidden.value = sanitizeBillboardHtml(editor.innerHTML);
}

function promptLinkUrl(): string | null {
  const raw = window.prompt("Link URL (site path like /tools, or https://…)");
  if (raw == null) return null;
  const result = normalizeWhatsNewDestinationUrl(raw);
  if (!result.ok || !result.value) {
    window.alert(result.ok ? "Enter a site path or https:// URL." : result.error);
    return null;
  }
  return result.value;
}

/**
 * Compact contenteditable billboard message editor for Watson What's New.
 * Sanitizes on sync/paste; toolbar covers bold, italic, paragraph, lists, link, clear.
 */
export function initWatsonBillboardRichText(root: ParentNode = document): void {
  const wrap = root.querySelector<HTMLElement>("[data-wn-rte]");
  if (!wrap || wrap.dataset.wired === "1") return;
  wrap.dataset.wired = "1";

  const editor = wrap.querySelector<HTMLElement>("[data-wn-rte-editor]");
  const hidden = wrap.querySelector<HTMLTextAreaElement>("[data-wn-rte-input]");
  const toolbar = wrap.querySelector<HTMLElement>("[data-wn-rte-toolbar]");
  if (!editor || !hidden || !toolbar) return;

  // Seed visual editor from stored value (plain text or prior HTML).
  editor.innerHTML = sanitizeBillboardHtml(hidden.value) || "<p><br></p>";
  syncHidden(editor, hidden);

  editor.addEventListener("input", () => {
    syncHidden(editor, hidden);
  });

  editor.addEventListener("paste", (event) => {
    event.preventDefault();
    const clipboard = event.clipboardData;
    const html = clipboard?.getData("text/html") || "";
    const text = clipboard?.getData("text/plain") || "";
    const cleaned = sanitizeBillboardHtml(html || text);
    if (!cleaned) return;
    exec("insertHTML", cleaned);
    syncHidden(editor, hidden);
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
        const href = promptLinkUrl();
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
    syncHidden(editor, hidden);
  });

  // Keep Enter creating paragraphs in most browsers.
  editor.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    // Default contenteditable Enter behavior; sync after the browser mutates.
    queueMicrotask(() => syncHidden(editor, hidden));
  });
}

/**
 * Client wiring for the admin HTML helper toolbars (see
 * components/admin/HtmlHelperToolbar.astro). Each `.am__htmltoolbar` has a
 * `data-target` pointing at a <textarea>; its buttons insert/wrap HTML at the
 * caret. Shared by both the Short and Long Description fields so the behavior
 * lives in one place.
 */
export type HtmlHelperCmd =
  | "bold"
  | "italic"
  | "link"
  | "ul"
  | "ol"
  | "p"
  | "br"
  | "h3";

type Insert = { text: string; caretStart: number; caretEnd: number };

/**
 * Build the text to insert plus caret offsets (relative to the insertion start).
 * With a selection, the chosen tag wraps it; empty, a template is inserted with
 * the caret placed where the user can immediately type.
 */
function buildInsert(cmd: HtmlHelperCmd, sel: string): Insert {
  const wrap = (open: string, close: string): Insert => {
    const text = `${open}${sel}${close}`;
    // Selection ? caret after the wrapped block; empty ? caret between tags.
    const caret = sel ? text.length : open.length;
    return { text, caretStart: caret, caretEnd: caret };
  };

  switch (cmd) {
    case "bold":
      return wrap("<strong>", "</strong>");
    case "italic":
      return wrap("<em>", "</em>");
    case "p":
      return wrap("<p>", "</p>");
    case "h3":
      return wrap("<h3>", "</h3>");
    case "link": {
      // Wrap selection as the link text (or empty), caret inside the href="".
      const text = `<a href="">${sel}</a>`;
      const caret = '<a href="'.length; // between the href quotes
      return { text, caretStart: caret, caretEnd: caret };
    }
    case "ul":
    case "ol": {
      const lead = `<${cmd}>\n  <li>`;
      const tail = `</li>\n</${cmd}>`;
      const text = `${lead}${sel}${tail}`;
      const caret = lead.length + sel.length; // inside the first <li>, after any selection
      return { text, caretStart: caret, caretEnd: caret };
    }
    case "br": {
      const text = "<br>\n";
      return { text, caretStart: text.length, caretEnd: text.length };
    }
    default:
      return { text: "", caretStart: 0, caretEnd: 0 };
  }
}

function applyCmd(ta: HTMLTextAreaElement, cmd: HtmlHelperCmd): void {
  const start = ta.selectionStart ?? ta.value.length;
  const end = ta.selectionEnd ?? start;
  const sel = ta.value.slice(start, end);
  const { text, caretStart, caretEnd } = buildInsert(cmd, sel);

  ta.value = ta.value.slice(0, start) + text + ta.value.slice(end);
  ta.focus();
  ta.setSelectionRange(start + caretStart, start + caretEnd);
  // Notify any listeners (e.g. the admin JSON preview) that the value changed.
  ta.dispatchEvent(new Event("input", { bubbles: true }));
}

/** Wire every HTML helper toolbar found under `root` (idempotent per toolbar). */
export function initHtmlHelperToolbars(root: ParentNode = document): void {
  root.querySelectorAll(".am__htmltoolbar").forEach((tb) => {
    if (!(tb instanceof HTMLElement) || tb.dataset.wired === "1") return;
    tb.dataset.wired = "1";
    const targetId = tb.getAttribute("data-target");
    if (!targetId) return;

    tb.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const btn = target.closest("[data-cmd]");
      if (!(btn instanceof HTMLElement)) return;
      const cmd = btn.getAttribute("data-cmd") as HtmlHelperCmd;
      const ta = document.getElementById(targetId);
      if (ta instanceof HTMLTextAreaElement) applyCmd(ta, cmd);
    });
  });
}

import { COURSE_HTML_SNIPPETS } from "../data/courseHtmlSnippets";

let showToast: ((message: string) => void) | null = null;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function setCourseHtmlSnippetsToast(fn: (message: string) => void) {
  showToast = fn;
}

/** Enable Insert when the edit form is visible (field focus is checked at click time). */
export function refreshSnippetInsertButtons() {
  const editForm = document.getElementById("course-editor-edit-form");
  const canInsert = Boolean(editForm && !editForm.hidden);
  document.querySelectorAll("[data-snippet-insert]").forEach((btn) => {
    if (!(btn instanceof HTMLButtonElement)) return;
    btn.disabled = !canInsert;
    btn.title = canInsert
      ? "Insert at cursor in the focused text/HTML field below"
      : "Select a lesson item to edit first";
  });
}

function insertIntoFocusedEditorField(html: string): boolean {
  const editFields = document.getElementById("course-editor-edit-fields");
  const active = document.activeElement;
  if (!editFields || !active || !editFields.contains(active)) return false;

  if (active instanceof HTMLTextAreaElement) {
    const start = active.selectionStart ?? active.value.length;
    const end = active.selectionEnd ?? start;
    active.value = `${active.value.slice(0, start)}${html}${active.value.slice(end)}`;
    const cursor = start + html.length;
    active.setSelectionRange(cursor, cursor);
    active.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  }

  if (active instanceof HTMLElement && active.isContentEditable) {
    if (typeof document.queryCommandSupported === "function" && document.queryCommandSupported("insertHTML")) {
      document.execCommand("insertHTML", false, html);
    } else {
      active.innerHTML = `${active.innerHTML}${html}`;
    }
    active.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  }

  return false;
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

export function initCourseHtmlSnippetsPanel() {
  const list = document.getElementById("course-editor-snippets-list");
  if (!list) return;

  list.innerHTML = COURSE_HTML_SNIPPETS.map(
    (snippet) => `
      <article class="course-editor__snippet" data-snippet-id="${escapeHtml(snippet.id)}">
        <div class="course-editor__snippet-head">
          <h4 class="course-editor__snippet-name">${escapeHtml(snippet.name)}</h4>
          ${
            snippet.category
              ? `<span class="course-editor__snippet-category">${escapeHtml(snippet.category)}</span>`
              : ""
          }
        </div>
        <pre class="course-editor__snippet-code"><code>${escapeHtml(snippet.html)}</code></pre>
        <div class="course-editor__snippet-actions">
          <button type="button" class="course-editor__snippet-btn" data-snippet-copy="${escapeHtml(snippet.id)}">
            Copy
          </button>
          <button type="button" class="course-editor__snippet-btn" data-snippet-insert="${escapeHtml(snippet.id)}" disabled>
            Insert
          </button>
        </div>
      </article>
    `,
  ).join("");

  list.querySelectorAll("[data-snippet-copy]").forEach((btn) => {
    btn.addEventListener("click", async (event) => {
      event.stopPropagation();
      const id = btn.getAttribute("data-snippet-copy");
      const snippet = COURSE_HTML_SNIPPETS.find((item) => item.id === id);
      if (!snippet) return;
      try {
        await copyText(snippet.html);
        showToast?.(`Copied “${snippet.name}”`);
      } catch {
        showToast?.("Copy failed");
      }
    });
  });

  list.querySelectorAll("[data-snippet-insert]").forEach((btn) => {
    // Keep editor field focused when clicking Insert (otherwise activeElement is this button).
    btn.addEventListener("mousedown", (event) => {
      event.preventDefault();
    });
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      const id = btn.getAttribute("data-snippet-insert");
      const snippet = COURSE_HTML_SNIPPETS.find((item) => item.id === id);
      if (!snippet) return;
      if (insertIntoFocusedEditorField(snippet.html)) {
        showToast?.("Inserted snippet");
      } else {
        showToast?.("Click inside a text or HTML field first, then Insert");
      }
    });
  });

  refreshSnippetInsertButtons();
}

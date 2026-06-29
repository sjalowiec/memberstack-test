import { COURSE_HTML_SNIPPETS } from "../data/courseHtmlSnippets";
import {
  buildGlossaryLinkHtml,
  buildGlossaryPickerCatalog,
  filterGlossaryPickerRows,
  type GlossaryPickerRow,
} from "../lib/glossary/glossaryPickerCatalog";

const GLOSSARY_SNIPPET_ID = "glossary-entry";
const GLOSSARY_API_URL = "/api/admin/glossary";

let showToast: ((message: string) => void) | null = null;
let glossaryPickerRows: GlossaryPickerRow[] | null = null;
let glossaryPickerLoadPromise: Promise<GlossaryPickerRow[]> | null = null;

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

function canInsertIntoEditorField(): boolean {
  const editForm = document.getElementById("course-editor-edit-form");
  return Boolean(editForm && !editForm.hidden);
}

/** Enable Insert when the edit form is visible (field focus is checked at click time). */
export function refreshSnippetInsertButtons() {
  const canInsert = canInsertIntoEditorField();
  document.querySelectorAll("[data-snippet-insert]").forEach((btn) => {
    if (!(btn instanceof HTMLButtonElement)) return;
    btn.disabled = !canInsert;
    btn.title = canInsert
      ? "Insert at cursor in the focused text/HTML field below"
      : "Select a lesson item to edit first";
  });

  document.querySelectorAll("[data-glossary-insert]").forEach((btn) => {
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

async function copyGlossaryLink(slug: string, term: string) {
  const html = buildGlossaryLinkHtml(slug, term);
  try {
    await copyText(html);
    showToast?.(`Copied link for “${term}”`);
  } catch {
    showToast?.("Copy failed");
  }
}

function insertGlossaryLink(slug: string, term: string) {
  const html = buildGlossaryLinkHtml(slug, term);
  if (insertIntoFocusedEditorField(html)) {
    showToast?.(`Inserted “${term}”`);
    return;
  }
  showToast?.("Click inside a text or HTML field first, then Insert");
}

async function loadGlossaryPickerRows(): Promise<GlossaryPickerRow[]> {
  if (glossaryPickerRows) return glossaryPickerRows;
  if (glossaryPickerLoadPromise) return glossaryPickerLoadPromise;

  glossaryPickerLoadPromise = (async () => {
    const res = await fetch(GLOSSARY_API_URL);
    if (!res.ok) throw new Error("Could not load glossary.");
    const payload = (await res.json()) as unknown;
    glossaryPickerRows = buildGlossaryPickerCatalog(payload);
    return glossaryPickerRows;
  })();

  try {
    return await glossaryPickerLoadPromise;
  } catch (err) {
    glossaryPickerLoadPromise = null;
    throw err;
  }
}

function wireGlossaryPickerRowActions(listEl: HTMLElement) {
  listEl.querySelectorAll("[data-glossary-copy]").forEach((btn) => {
    btn.addEventListener("mousedown", (event) => {
      event.preventDefault();
    });
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      const slug = btn.getAttribute("data-glossary-slug") ?? "";
      const term = btn.getAttribute("data-glossary-term") ?? "";
      if (!slug || !term) return;
      void copyGlossaryLink(slug, term);
    });
  });

  listEl.querySelectorAll("[data-glossary-insert]").forEach((btn) => {
    btn.addEventListener("mousedown", (event) => {
      event.preventDefault();
    });
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      const slug = btn.getAttribute("data-glossary-slug") ?? "";
      const term = btn.getAttribute("data-glossary-term") ?? "";
      if (!slug || !term) return;
      insertGlossaryLink(slug, term);
    });
  });

  refreshSnippetInsertButtons();
}

function renderGlossaryPickerList(
  listEl: HTMLElement,
  statusEl: HTMLElement | null,
  rows: GlossaryPickerRow[],
  query: string,
) {
  const matches = filterGlossaryPickerRows(rows, query);
  if (matches.length === 0) {
    listEl.innerHTML = "";
    if (statusEl) {
      statusEl.textContent = query.trim()
        ? "No glossary terms match your search."
        : "No glossary terms found.";
    }
    return;
  }

  listEl.innerHTML = matches
    .map(
      (row) => `
        <li class="course-editor__glossary-picker-row">
          <div class="course-editor__glossary-picker-meta">
            <span class="course-editor__glossary-picker-term">${escapeHtml(row.term)}</span>
            <span class="course-editor__glossary-picker-slug">/glossary/${escapeHtml(row.slug)}</span>
            ${row.active ? "" : `<span class="course-editor__glossary-picker-inactive">inactive</span>`}
          </div>
          <div class="course-editor__glossary-picker-actions">
            <button
              type="button"
              class="course-editor__glossary-picker-btn"
              data-glossary-copy
              data-glossary-slug="${escapeHtml(row.slug)}"
              data-glossary-term="${escapeHtml(row.term)}"
            >
              Copy
            </button>
            <button
              type="button"
              class="course-editor__glossary-picker-btn"
              data-glossary-insert
              data-glossary-slug="${escapeHtml(row.slug)}"
              data-glossary-term="${escapeHtml(row.term)}"
              disabled
            >
              Insert
            </button>
          </div>
        </li>
      `,
    )
    .join("");

  if (statusEl) {
    const total = rows.length;
    const shown = matches.length;
    const suffix = query.trim() ? ` matching “${query.trim()}”` : "";
    statusEl.textContent =
      shown < total
        ? `Showing ${shown} of ${total} terms${suffix}. Copy or insert the ready-made link.`
        : `${total} terms — scroll the list or search to narrow. Copy or insert a link.`;
  }

  wireGlossaryPickerRowActions(listEl);
}

function initGlossaryPicker(article: HTMLElement) {
  const searchInput = article.querySelector("[data-glossary-picker-search]");
  const listEl = article.querySelector("[data-glossary-picker-list]");
  const statusEl = article.querySelector("[data-glossary-picker-status]");
  if (!(searchInput instanceof HTMLInputElement) || !(listEl instanceof HTMLElement)) return;

  let loadedRows: GlossaryPickerRow[] | null = null;

  const refresh = () => {
    if (!loadedRows) return;
    renderGlossaryPickerList(listEl, statusEl instanceof HTMLElement ? statusEl : null, loadedRows, searchInput.value);
  };

  const ensureLoaded = async () => {
    if (loadedRows) {
      refresh();
      return;
    }
    if (statusEl instanceof HTMLElement) statusEl.textContent = "Loading glossary…";
    try {
      loadedRows = await loadGlossaryPickerRows();
      refresh();
    } catch {
      if (statusEl instanceof HTMLElement) {
        statusEl.textContent = "Could not load glossary. Try again in a moment.";
      }
    }
  };

  searchInput.addEventListener("focus", () => {
    void ensureLoaded();
  });
  searchInput.addEventListener("input", () => {
    if (loadedRows) refresh();
    else void ensureLoaded();
  });

  void ensureLoaded();
}

function renderSnippetArticle(snippet: (typeof COURSE_HTML_SNIPPETS)[number]) {
  if (snippet.id === GLOSSARY_SNIPPET_ID) {
    return `
      <article class="course-editor__snippet course-editor__snippet--glossary" data-snippet-id="${escapeHtml(snippet.id)}">
        <div class="course-editor__snippet-head">
          <h4 class="course-editor__snippet-name">${escapeHtml(snippet.name)}</h4>
          ${
            snippet.category
              ? `<span class="course-editor__snippet-category">${escapeHtml(snippet.category)}</span>`
              : ""
          }
        </div>
        <p class="course-editor__glossary-picker-intro">
          Search for a term, then copy or insert a link. In lesson preview, the link opens the glossary in a popup.
        </p>
        <div class="course-editor__glossary-picker">
          <label class="course-editor__glossary-picker-label">
            <span>Search glossary</span>
            <input
              type="search"
              class="course-editor__glossary-picker-search"
              data-glossary-picker-search
              placeholder="Search glossary terms…"
              autocomplete="off"
            />
          </label>
          <p class="course-editor__glossary-picker-status" data-glossary-picker-status>
            Loading glossary…
          </p>
          <ul class="course-editor__glossary-picker-list" data-glossary-picker-list aria-live="polite"></ul>
        </div>
      </article>
    `;
  }

  return `
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
  `;
}

export function initCourseHtmlSnippetsPanel() {
  const list = document.getElementById("course-editor-snippets-list");
  if (!list) return;

  list.innerHTML = COURSE_HTML_SNIPPETS.map((snippet) => renderSnippetArticle(snippet)).join("");

  list.querySelectorAll("[data-snippet-id]").forEach((article) => {
    if (!(article instanceof HTMLElement)) return;
    if (article.getAttribute("data-snippet-id") === GLOSSARY_SNIPPET_ID) {
      initGlossaryPicker(article);
    }
  });

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

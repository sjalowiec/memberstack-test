import type { HelpHubAdminBrowser } from "./adminEditorClient";
import { isHelpHubCategoryRetired, type HelpHubManagedCategory } from "./categoryTypes";

export type HelpHubCategoryAdminRow = HelpHubManagedCategory & { usageCount: number };

type CategoryAdminApi = Pick<HelpHubAdminBrowser, "request" | "promptSignIn" | "saveSucceeded">;

function admin(): CategoryAdminApi | null {
  return window.kbmHelpHubAdmin ?? null;
}

function setStatus(el: HTMLElement | null, message: string, kind: "ok" | "err" | "") {
  if (!el) return;
  el.textContent = message;
  el.dataset.kind = kind;
}

export function replacementOptionsFor(
  categories: HelpHubCategoryAdminRow[],
  retiringId: number,
): HelpHubCategoryAdminRow[] {
  return categories.filter((category) => !isHelpHubCategoryRetired(category) && category.id !== retiringId);
}

async function requestCategories(
  api: CategoryAdminApi,
  path: string,
  method: "GET" | "POST" | "PUT" | "DELETE",
  body?: unknown,
) {
  const result = await api.request(path, { method, body });
  if (result.status === 401) {
    await api.promptSignIn();
  }
  return result;
}

export function bootHelpHubCategoryAdmin(root: ParentNode = document): void {
  const panel = root.querySelector("[data-help-hub-categories]");
  if (!(panel instanceof HTMLElement)) return;
  const toggle = root.querySelector("[data-help-hub-categories-toggle]");
  const list = panel.querySelector("[data-help-hub-categories-list]");
  const addForm = panel.querySelector("[data-help-hub-categories-add]");
  const statusEl = panel.querySelector("[data-help-hub-categories-status]");
  const retireDialog = panel.querySelector("[data-help-hub-categories-retire]");
  if (!(list instanceof HTMLElement) || !(statusEl instanceof HTMLElement)) return;

  let categories: HelpHubCategoryAdminRow[] = [];
  let retiring: HelpHubCategoryAdminRow | null = null;

  function render() {
    list.innerHTML = categories
      .map((category) => {
        const retired = isHelpHubCategoryRetired(category);
        return `<li class="help-hub-cats__row" data-category-id="${category.id}">
          <div class="help-hub-cats__copy">
            <input class="help-hub-cats__label" data-cat-label value="${escapeAttr(category.label)}" ${retired ? "disabled" : ""} />
            <p class="help-hub-cats__meta">
              key <code>${escapeHtml(category.key)}</code>
              · ${category.usageCount} ${category.usageCount === 1 ? "entry" : "entries"}
              ${retired ? " · retired" : ""}
            </p>
          </div>
          <div class="help-hub-cats__actions">
            <button type="button" class="kbm-btn kbm-btn-outline" data-cat-up ${retired ? "disabled" : ""}>Up</button>
            <button type="button" class="kbm-btn kbm-btn-outline" data-cat-down ${retired ? "disabled" : ""}>Down</button>
            <button type="button" class="kbm-btn kbm-btn-outline" data-cat-save ${retired ? "disabled" : ""}>Save name</button>
            ${
              retired || category.usageCount === 0
                ? `<button type="button" class="kbm-btn kbm-btn-outline" data-cat-delete>Delete</button>`
                : `<button type="button" class="kbm-btn kbm-btn-outline" data-cat-retire>Retire</button>`
            }
          </div>
        </li>`;
      })
      .join("");
  }

  async function refresh() {
    const api = admin();
    if (!api) {
      setStatus(statusEl, "Help Hub admin is still loading.", "err");
      return;
    }
    const result = await requestCategories(api, "/api/admin/help-hub/categories", "GET");
    if (!api.saveSucceeded(result) || !result.data || typeof result.data !== "object") {
      setStatus(statusEl, result.error || "Could not load categories.", "err");
      return;
    }
    const rows = (result.data as { categories?: HelpHubCategoryAdminRow[] }).categories;
    categories = Array.isArray(rows) ? rows : [];
    render();
    setStatus(statusEl, "", "");
  }

  toggle?.addEventListener("click", () => {
    const open = panel.hasAttribute("hidden") === false;
    if (open) {
      panel.hidden = true;
      return;
    }
    panel.hidden = false;
    void refresh();
  });

  addForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const api = admin();
    if (!api || !(addForm instanceof HTMLFormElement)) return;
    const input = addForm.querySelector("[name='label']");
    const label = input instanceof HTMLInputElement ? input.value.trim() : "";
    const result = await requestCategories(api, "/api/admin/help-hub/categories", "POST", { label });
    if (!api.saveSucceeded(result)) {
      setStatus(statusEl, result.error || "Could not add category.", "err");
      return;
    }
    if (input instanceof HTMLInputElement) input.value = "";
    await refresh();
    setStatus(statusEl, "Category added.", "ok");
  });

  list.addEventListener("click", async (event) => {
    const api = admin();
    if (!api) return;
    const button = event.target instanceof Element ? event.target.closest("button") : null;
    if (!button) return;
    const row = button.closest("[data-category-id]");
    const id = row instanceof HTMLElement ? Number(row.dataset.categoryId) : NaN;
    const category = categories.find((item) => item.id === id);
    if (!category) return;

    if (button.hasAttribute("data-cat-save")) {
      const input = row?.querySelector("[data-cat-label]");
      const label = input instanceof HTMLInputElement ? input.value.trim() : "";
      const result = await requestCategories(api, `/api/admin/help-hub/categories/${id}`, "PUT", { label });
      if (!api.saveSucceeded(result)) {
        setStatus(statusEl, result.error || "Could not rename category.", "err");
        return;
      }
      await refresh();
      setStatus(statusEl, "Display name saved. Stored key is unchanged.", "ok");
      return;
    }

    if (button.hasAttribute("data-cat-up") || button.hasAttribute("data-cat-down")) {
      const ids = categories.map((item) => item.id);
      const index = ids.indexOf(id);
      const swapWith = button.hasAttribute("data-cat-up") ? index - 1 : index + 1;
      if (swapWith < 0 || swapWith >= ids.length) return;
      const next = [...ids];
      const currentId = next[index];
      const otherId = next[swapWith];
      if (currentId == null || otherId == null) return;
      next[index] = otherId;
      next[swapWith] = currentId;
      const result = await requestCategories(api, "/api/admin/help-hub/categories/reorder", "PUT", { ids: next });
      if (!api.saveSucceeded(result)) {
        setStatus(statusEl, result.error || "Could not reorder categories.", "err");
        return;
      }
      await refresh();
      return;
    }

    if (button.hasAttribute("data-cat-delete")) {
      if (category.usageCount > 0) {
        setStatus(statusEl, "This category still has entries. Retire it and reassign them first.", "err");
        return;
      }
      if (!window.confirm(`Delete “${category.label}”? This cannot be undone.`)) return;
      const result = await requestCategories(api, `/api/admin/help-hub/categories/${id}`, "DELETE");
      if (!api.saveSucceeded(result)) {
        setStatus(statusEl, result.error || "Could not delete category.", "err");
        return;
      }
      await refresh();
      setStatus(statusEl, "Category deleted.", "ok");
      return;
    }

    if (button.hasAttribute("data-cat-retire") && retireDialog instanceof HTMLElement) {
      retiring = category;
      const select = retireDialog.querySelector("[data-cat-replacement]");
      const count = retireDialog.querySelector("[data-cat-retire-count]");
      if (count) count.textContent = String(category.usageCount);
      if (select instanceof HTMLSelectElement) {
        select.innerHTML = replacementOptionsFor(categories, category.id)
          .map((item) => `<option value="${escapeAttr(item.key)}">${escapeHtml(item.label)}</option>`)
          .join("");
      }
      retireDialog.hidden = false;
    }
  });

  retireDialog?.querySelector("[data-cat-retire-cancel]")?.addEventListener("click", () => {
    retiring = null;
    if (retireDialog instanceof HTMLElement) retireDialog.hidden = true;
  });

  retireDialog?.querySelector("[data-cat-retire-confirm]")?.addEventListener("click", async () => {
    const api = admin();
    if (!api || !retiring) return;
    const select = retireDialog.querySelector("[data-cat-replacement]");
    const replacementKey = select instanceof HTMLSelectElement ? select.value : "";
    if (
      !window.confirm(
        `Reassign ${retiring.usageCount} ${retiring.usageCount === 1 ? "entry" : "entries"} from “${retiring.label}” to the selected category? URLs and content will not change.`,
      )
    ) {
      return;
    }
    const result = await requestCategories(
      api,
      `/api/admin/help-hub/categories/${retiring.id}/retire`,
      "POST",
      { replacementKey, confirm: true },
    );
    if (!api.saveSucceeded(result)) {
      setStatus(statusEl, result.error || "Could not retire category.", "err");
      return;
    }
    retiring = null;
    if (retireDialog instanceof HTMLElement) retireDialog.hidden = true;
    await refresh();
    setStatus(statusEl, "Entries reassigned and category retired.", "ok");
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value: string): string {
  return escapeHtml(value);
}

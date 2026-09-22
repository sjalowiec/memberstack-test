export type WatsonCustomerEbooksPanelOptions = {
  onChanged?: () => void | Promise<void>;
  fetchJson?: typeof fetch;
  confirmRevoke?: (message: string) => boolean;
};

function setStatus(root: HTMLElement, message: string, isError = false): void {
  const status = root.querySelector<HTMLElement>("[data-watson-ebooks-status]");
  if (!status) return;
  status.hidden = !message;
  status.textContent = message;
  status.classList.toggle("watson__status--error", isError);
}

function listUrl(root: HTMLElement): string {
  return root.dataset.listUrl?.trim() ?? "";
}

async function postJson(
  url: string,
  body: Record<string, unknown>,
  fetchJson: typeof fetch,
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const response = await fetchJson(url, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as Record<string, unknown>;
  return { ok: response.ok, status: response.status, data };
}

export function filterEbookSelectOptions(
  select: HTMLSelectElement,
  query: string,
): void {
  const needle = query.trim().toLowerCase();
  for (const option of Array.from(select.options)) {
    if (!option.value) {
      option.hidden = false;
      continue;
    }
    const haystack = `${option.value} ${option.textContent ?? ""}`.toLowerCase();
    option.hidden = needle ? !haystack.includes(needle) : false;
  }
}

export function initWatsonCustomerEbooksPanel(
  root: HTMLElement,
  options: WatsonCustomerEbooksPanelOptions = {},
): void {
  if (root.dataset.watsonEbooksInitialized === "true") {
    return;
  }
  root.dataset.watsonEbooksInitialized = "true";

  const fetchJson = options.fetchJson ?? fetch;
  const confirmRevoke =
    options.confirmRevoke ?? ((message) => window.confirm(message));
  const form = root.querySelector<HTMLFormElement>("[data-watson-ebook-grant-form]");
  const search = root.querySelector<HTMLInputElement>("[data-watson-ebook-search]");
  const select = root.querySelector<HTMLSelectElement>("[data-watson-ebook-select]");

  if (search && select) {
    search.addEventListener("input", () => {
      filterEbookSelectOptions(select, search.value);
    });
  }

  if (form) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const url = listUrl(root);
      if (!url) {
        setStatus(root, "This customer profile cannot grant ebooks.", true);
        return;
      }
      if (root.dataset.canGrant !== "true") {
        setStatus(
          root,
          "This customer does not have a usable login identity for My Downloads.",
          true,
        );
        return;
      }

      const formData = new FormData(form);
      const itemId = String(formData.get("itemId") ?? "").trim();
      const reason = String(formData.get("reason") ?? "").trim();
      if (!itemId || !reason) {
        setStatus(root, "Select an ebook and a reason.", true);
        return;
      }

      const submitButton = form.querySelector<HTMLButtonElement>('button[type="submit"]');
      if (submitButton) submitButton.disabled = true;

      try {
        const result = await postJson(
          url,
          {
            itemId,
            reason,
            note: String(formData.get("note") ?? ""),
            sourceStoreTransactionId: String(formData.get("sourceStoreTransactionId") ?? ""),
            grantedBy: String(formData.get("grantedBy") ?? ""),
          },
          fetchJson,
        );
        if (!result.ok) {
          const error =
            typeof result.data.error === "string"
              ? result.data.error
              : "Unable to assign ebook.";
          setStatus(root, error, true);
          return;
        }
        setStatus(root, "Ebook assigned.");
        await options.onChanged?.();
      } catch {
        setStatus(root, "Unable to assign ebook.", true);
      } finally {
        if (submitButton) submitButton.disabled = false;
      }
    });
  }

  root.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const button = target.closest<HTMLButtonElement>("[data-watson-ebook-revoke]");
    if (!button) return;
    const grantId = button.dataset.grantId?.trim();
    if (!grantId) return;
    if (
      !confirmRevoke(
        "Revoke this manual ebook grant? Purchase history is not changed.",
      )
    ) {
      return;
    }

    button.disabled = true;
    try {
      const result = await postJson(
        `/api/watson/ebook-entitlements/${encodeURIComponent(grantId)}/revoke`,
        { revokedBy: "Sue" },
        fetchJson,
      );
      if (!result.ok) {
        const error =
          typeof result.data.error === "string"
            ? result.data.error
            : "Unable to revoke grant.";
        setStatus(root, error, true);
        return;
      }
      setStatus(root, "Manual grant revoked.");
      await options.onChanged?.();
    } catch {
      setStatus(root, "Unable to revoke grant.", true);
    } finally {
      button.disabled = false;
    }
  });
}

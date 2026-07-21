import { formatStoreFulfillmentTodayDate } from "./storeFulfillments";

export type StoreFulfillmentPanelOptions = {
  onFulfillmentsChanged?: () => void | Promise<void>;
  fetchJson?: typeof fetch;
  confirmDelete?: (message: string) => boolean;
  getNow?: () => Date;
  copyText?: (value: string) => Promise<void>;
};

function setFormStatus(root: HTMLElement, message: string, isError = false): void {
  const status = root.querySelector<HTMLElement>("[data-watson-fulfillment-form-status]");
  if (!status) {
    return;
  }
  status.hidden = !message;
  status.textContent = message;
  status.classList.toggle("watson__status--error", isError);
}

function getMemberid(root: HTMLElement): string {
  return root.dataset.memberid?.trim() ?? "";
}

function buildFulfillmentsApiUrl(memberid: string): string {
  return `/api/watson/members/${encodeURIComponent(memberid)}/fulfillments`;
}

function buildFulfillmentApiUrl(fulfillmentId: string): string {
  return `/api/watson/fulfillments/${encodeURIComponent(fulfillmentId)}`;
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

async function patchJson(
  url: string,
  body: Record<string, unknown>,
  fetchJson: typeof fetch,
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const response = await fetchJson(url, {
    method: "PATCH",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as Record<string, unknown>;
  return { ok: response.ok, status: response.status, data };
}

async function deleteJson(
  url: string,
  fetchJson: typeof fetch,
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const response = await fetchJson(url, {
    method: "DELETE",
    credentials: "same-origin",
  });
  const data = (await response.json()) as Record<string, unknown>;
  return { ok: response.ok, status: response.status, data };
}

function isInteractiveElement(target: unknown): target is HTMLElement {
  return (
    typeof target === "object" &&
    target !== null &&
    "matches" in target &&
    typeof (target as HTMLElement).matches === "function"
  );
}

function readFulfillmentFormFields(form: HTMLFormElement): Record<string, unknown> {
  const formData = new FormData(form);
  return {
    shopifyOrderNumber: String(formData.get("shopifyOrderNumber") ?? ""),
    productDescription: String(formData.get("productDescription") ?? ""),
    productVariantId: String(formData.get("productVariantId") ?? ""),
    supplierOption: String(formData.get("supplierOption") ?? ""),
    supplierOther: String(formData.get("supplierOther") ?? ""),
    carrier: String(formData.get("carrier") ?? ""),
    trackingNumber: String(formData.get("trackingNumber") ?? ""),
    actualShippingCost: String(formData.get("actualShippingCost") ?? ""),
    customerShippingCharge: String(formData.get("customerShippingCharge") ?? ""),
    boxCount: String(formData.get("boxCount") ?? ""),
    shipDate: String(formData.get("shipDate") ?? ""),
    supplierInvoiceNumber: String(formData.get("supplierInvoiceNumber") ?? ""),
    destinationState: String(formData.get("destinationState") ?? ""),
    destinationPostal: String(formData.get("destinationPostal") ?? ""),
    internalNotes: String(formData.get("internalNotes") ?? ""),
  };
}

function syncSupplierOtherVisibility(form: HTMLFormElement): void {
  const supplierSelect = form.querySelector<HTMLSelectElement>('select[name="supplierOption"]');
  const otherField = form.querySelector<HTMLElement>("[data-watson-fulfillment-supplier-other]");
  const otherInput = form.querySelector<HTMLInputElement>('input[name="supplierOther"]');
  if (!supplierSelect || !otherField) {
    return;
  }
  const showOther = supplierSelect.value === "Other";
  otherField.hidden = !showOther;
  if (otherInput) {
    otherInput.required = showOther;
    if (!showOther) {
      otherInput.value = "";
    }
  }
}

function resetAddForm(form: HTMLFormElement, now: Date): void {
  const destinationState = form.dataset.destinationState ?? "";
  const destinationPostal = form.dataset.destinationPostal ?? "";
  form.reset();

  const boxes = form.querySelector<HTMLInputElement>('input[name="boxCount"]');
  if (boxes) {
    boxes.value = "1";
  }
  const shipDate = form.querySelector<HTMLInputElement>('input[name="shipDate"]');
  if (shipDate) {
    shipDate.value = formatStoreFulfillmentTodayDate(now);
  }
  const stateInput = form.querySelector<HTMLInputElement>('input[name="destinationState"]');
  if (stateInput) {
    stateInput.value = destinationState;
  }
  const postalInput = form.querySelector<HTMLInputElement>('input[name="destinationPostal"]');
  if (postalInput) {
    postalInput.value = destinationPostal;
  }
  const supplierSelect = form.querySelector<HTMLSelectElement>('select[name="supplierOption"]');
  if (supplierSelect) {
    supplierSelect.value = "Silver Reed";
  }
  const carrierSelect = form.querySelector<HTMLSelectElement>('select[name="carrier"]');
  if (carrierSelect) {
    carrierSelect.value = "UPS";
  }
  syncSupplierOtherVisibility(form);
}

async function defaultCopyText(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "absolute";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

export function initStoreFulfillmentPanel(
  root: HTMLElement,
  options: StoreFulfillmentPanelOptions = {},
): void {
  if (root.dataset.watsonFulfillmentsInitialized === "true") {
    return;
  }
  root.dataset.watsonFulfillmentsInitialized = "true";

  const fetchJson = options.fetchJson ?? fetch;
  const confirmDelete =
    options.confirmDelete ?? ((message) => window.confirm(message));
  const getNow = options.getNow ?? (() => new Date());
  const copyText = options.copyText ?? defaultCopyText;
  const memberid = getMemberid(root);

  for (const form of root.querySelectorAll<HTMLFormElement>(
    "[data-watson-fulfillment-add-form], [data-watson-fulfillment-edit-form]",
  )) {
    syncSupplierOtherVisibility(form);
    const supplierSelect = form.querySelector<HTMLSelectElement>('select[name="supplierOption"]');
    supplierSelect?.addEventListener("change", () => {
      syncSupplierOtherVisibility(form);
    });
  }

  const addForm = root.querySelector<HTMLFormElement>("[data-watson-fulfillment-add-form]");
  if (addForm) {
    resetAddForm(addForm, getNow());

    addForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!memberid) {
        setFormStatus(root, "Member ID is missing.", true);
        return;
      }

      const submitButton = addForm.querySelector<HTMLButtonElement>('button[type="submit"]');
      if (submitButton) {
        submitButton.disabled = true;
      }

      try {
        const result = await postJson(
          buildFulfillmentsApiUrl(memberid),
          readFulfillmentFormFields(addForm),
          fetchJson,
        );
        if (!result.ok) {
          const error =
            typeof result.data.error === "string"
              ? result.data.error
              : "Unable to add fulfillment record.";
          setFormStatus(root, error, true);
          return;
        }

        resetAddForm(addForm, getNow());
        setFormStatus(root, "Fulfillment record added.");
        await options.onFulfillmentsChanged?.();
      } catch {
        setFormStatus(root, "Unable to add fulfillment record.", true);
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
        }
      }
    });
  }

  root.addEventListener("click", async (event) => {
    const target = event.target;
    if (!isInteractiveElement(target)) {
      return;
    }

    if (target.matches("[data-watson-fulfillment-copy-tracking]")) {
      const tracking = target.getAttribute("data-tracking")?.trim() ?? "";
      if (!tracking) {
        return;
      }
      try {
        await copyText(tracking);
        setFormStatus(root, "Tracking number copied.");
      } catch {
        setFormStatus(root, "Unable to copy tracking number.", true);
      }
      return;
    }

    const item = target.closest<HTMLElement>("[data-watson-fulfillment-item]");
    if (!item) {
      return;
    }

    const fulfillmentId = item.dataset.fulfillmentId?.trim();
    if (!fulfillmentId) {
      return;
    }

    if (target.matches("[data-watson-fulfillment-edit]")) {
      const editForm = item.querySelector<HTMLElement>("[data-watson-fulfillment-edit-form]");
      const details = item.querySelector<HTMLElement>("[data-watson-fulfillment-details]");
      const actions = item.querySelector<HTMLElement>(".watson-store-fulfillment__item-actions");
      if (editForm && details && actions) {
        editForm.hidden = false;
        details.hidden = true;
        actions.hidden = true;
        syncSupplierOtherVisibility(editForm as HTMLFormElement);
      }
      return;
    }

    if (target.matches("[data-watson-fulfillment-cancel]")) {
      const editForm = item.querySelector<HTMLElement>("[data-watson-fulfillment-edit-form]");
      const details = item.querySelector<HTMLElement>("[data-watson-fulfillment-details]");
      const actions = item.querySelector<HTMLElement>(".watson-store-fulfillment__item-actions");
      if (editForm && details && actions) {
        editForm.hidden = true;
        details.hidden = false;
        actions.hidden = false;
      }
      return;
    }

    if (target.matches("[data-watson-fulfillment-delete]")) {
      if (
        !confirmDelete(
          "Delete this store fulfillment record? This cannot be undone.",
        )
      ) {
        return;
      }

      target.setAttribute("disabled", "true");
      try {
        const result = await deleteJson(buildFulfillmentApiUrl(fulfillmentId), fetchJson);
        if (!result.ok) {
          const error =
            typeof result.data.error === "string"
              ? result.data.error
              : "Unable to delete fulfillment record.";
          setFormStatus(root, error, true);
          return;
        }
        await options.onFulfillmentsChanged?.();
      } catch {
        setFormStatus(root, "Unable to delete fulfillment record.", true);
      } finally {
        target.removeAttribute("disabled");
      }
    }
  });

  root.addEventListener("submit", async (event) => {
    const target = event.target;
    if (
      !isInteractiveElement(target) ||
      !target.matches("[data-watson-fulfillment-edit-form]")
    ) {
      return;
    }
    event.preventDefault();

    const item = target.closest<HTMLElement>("[data-watson-fulfillment-item]");
    const fulfillmentId = item?.dataset.fulfillmentId?.trim();
    if (!fulfillmentId) {
      return;
    }

    const submitButton = target.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (submitButton) {
      submitButton.disabled = true;
    }

    try {
      const result = await patchJson(
        buildFulfillmentApiUrl(fulfillmentId),
        readFulfillmentFormFields(target),
        fetchJson,
      );
      if (!result.ok) {
        const error =
          typeof result.data.error === "string"
            ? result.data.error
            : "Unable to save fulfillment record.";
        setFormStatus(root, error, true);
        return;
      }
      setFormStatus(root, "Fulfillment record updated.");
      await options.onFulfillmentsChanged?.();
    } catch {
      setFormStatus(root, "Unable to save fulfillment record.", true);
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
      }
    }
  });
}

export function buildStoreFulfillmentsApiUrl(memberid: string): string {
  return buildFulfillmentsApiUrl(memberid);
}

export function buildStoreFulfillmentItemApiUrl(fulfillmentId: string): string {
  return buildFulfillmentApiUrl(fulfillmentId);
}

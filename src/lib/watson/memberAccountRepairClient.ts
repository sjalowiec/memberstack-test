/**
 * Client actions for the Member Account Repair form.
 * Copy / preview / clear / restore only — no network writes.
 */

import {
  buildMemberAccountRepairReport,
  emptyMemberAccountRepairValues,
  sanitizeRepairValues,
  type MemberAccountRepairValues,
} from "./memberAccountRepair";

export type RepairFormField = {
  name: string;
  value: string;
};

export type RepairFormLike = {
  querySelectorAll: (selector: string) => ArrayLike<RepairFormField>;
  addEventListener?: (
    type: string,
    listener: (event: { preventDefault: () => void }) => void,
  ) => void;
  getAttribute?: (name: string) => string | null;
};

const FIELD_SELECTOR = "input[name], select[name], textarea[name]";

function fieldList(form: RepairFormLike): RepairFormField[] {
  return Array.from(form.querySelectorAll(FIELD_SELECTOR));
}

export function collectMemberAccountRepairValues(form: RepairFormLike): MemberAccountRepairValues {
  const values = emptyMemberAccountRepairValues();
  for (const field of fieldList(form)) {
    if (field.name in values) {
      values[field.name as keyof MemberAccountRepairValues] = String(field.value ?? "");
    }
  }
  return values;
}

export function fillMemberAccountRepairForm(
  form: RepairFormLike,
  values: Partial<MemberAccountRepairValues> | null | undefined,
): void {
  const next = sanitizeRepairValues(values);
  for (const field of fieldList(form)) {
    if (field.name in next) {
      field.value = next[field.name as keyof MemberAccountRepairValues];
    }
  }
}

export function clearMemberAccountRepairForm(form: RepairFormLike): void {
  fillMemberAccountRepairForm(form, emptyMemberAccountRepairValues());
}

export function restoreMemberAccountRepairForm(
  form: RepairFormLike,
  original: Partial<MemberAccountRepairValues> | null | undefined,
): void {
  fillMemberAccountRepairForm(form, original);
}

export function parseMemberAccountRepairPrefillJson(
  raw: string | null | undefined,
): MemberAccountRepairValues | null {
  const text = String(raw ?? "").trim();
  if (!text) {
    return null;
  }
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return sanitizeRepairValues(parsed as Record<string, unknown>);
  } catch {
    return null;
  }
}

function copyText(text: string): Promise<boolean> {
  const value = String(text || "");
  if (!value) return Promise.resolve(false);

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    return navigator.clipboard
      .writeText(value)
      .then(() => true)
      .catch(() => fallbackCopy(value));
  }
  return Promise.resolve(fallbackCopy(value));
}

function fallbackCopy(text: string): boolean {
  try {
    if (typeof document === "undefined") return false;
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function initWatsonMemberAccountRepair(root: ParentNode = document): void {
  const form = root.querySelector<HTMLFormElement>("[data-watson-member-account-repair]");
  if (!form) return;

  const output = root.querySelector<HTMLTextAreaElement>("[data-repair-output]");
  const status = root.querySelector<HTMLElement>("[data-repair-status]");
  const copyBtn = root.querySelector<HTMLButtonElement>("[data-repair-copy]");
  const previewBtn = root.querySelector<HTMLButtonElement>("[data-repair-preview]");
  const clearBtn = root.querySelector<HTMLButtonElement>("[data-repair-clear]");
  const restoreBtn = root.querySelector<HTMLButtonElement>("[data-repair-restore]");
  const original = parseMemberAccountRepairPrefillJson(form.getAttribute("data-repair-prefill"));

  const setStatus = (message: string) => {
    if (!status) return;
    status.textContent = message;
  };

  const showOutput = (text: string, visible: boolean) => {
    if (!output) return;
    output.value = text;
    output.hidden = !visible;
    if (visible) {
      output.style.display = "block";
    } else {
      output.style.display = "none";
    }
  };

  form.setAttribute("autocomplete", "off");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
  });

  copyBtn?.addEventListener("click", async () => {
    const text = buildMemberAccountRepairReport(collectMemberAccountRepairValues(form));
    showOutput(text, true);
    const copied = await copyText(text);
    setStatus(copied ? "Copied. Paste it wherever you need it." : "Report ready to copy below.");
  });

  previewBtn?.addEventListener("click", () => {
    const text = buildMemberAccountRepairReport(collectMemberAccountRepairValues(form));
    showOutput(text, true);
    setStatus("Report ready to review");
  });

  clearBtn?.addEventListener("click", () => {
    clearMemberAccountRepairForm(form);
    showOutput("", false);
    setStatus(
      original
        ? "Form cleared. Restore Watson data to put the original values back."
        : "Form cleared",
    );
  });

  restoreBtn?.addEventListener("click", () => {
    if (!original) return;
    restoreMemberAccountRepairForm(form, original);
    showOutput("", false);
    setStatus("Original Watson data restored");
  });
}

/**
 * Tip of the Week admin save helpers (browser + tests).
 * Keeps Save from failing silently when HTML5 validation or non-JSON errors occur.
 */
import { sanitizeBillboardHtml } from "../whatsNew/sanitizeBillboardHtml";

export const TIP_ADMIN_FLASH_KEY = "watson-totw-flash";

export type TipAdminFlashKind = "ok" | "error" | "warn";

export type TipAdminFlash = {
  message: string;
  kind: TipAdminFlashKind;
};

export type TipAdminFieldError = {
  field: string;
  error: string;
};

export type TipAdminSaveResult =
  | { ok: true; tip: unknown; warning?: string }
  | { ok: false; error: string; field?: string };

export function htmlLooksEmpty(raw: unknown): boolean {
  if (raw == null) return true;
  if (typeof raw !== "string") return true;
  const html = sanitizeBillboardHtml(raw);
  return !html;
}

export function clientTipAdminFieldErrors(
  payload: Record<string, unknown>,
): TipAdminFieldError[] {
  const errors: TipAdminFieldError[] = [];
  const str = (key: string) =>
    typeof payload[key] === "string" ? payload[key].trim() : "";

  if (!str("tipId")) {
    errors.push({ field: "tipId", error: "Tip ID is required." });
  } else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(str("tipId"))) {
    errors.push({
      field: "tipId",
      error: "Tip ID must be a slug (letters, numbers, hyphens).",
    });
  }

  if (!str("title")) {
    errors.push({ field: "title", error: "Title is required." });
  }

  if (htmlLooksEmpty(payload.intro)) {
    errors.push({ field: "intro", error: "Introduction is required." });
  }

  const video = str("videoContentId");
  if (!video) {
    errors.push({
      field: "videoContentId",
      error: "Learning Library content ID is required.",
    });
  } else if (!/^\d{1,12}$/.test(video)) {
    errors.push({
      field: "videoContentId",
      error: "Learning Library content ID must be a numeric catalog id.",
    });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(str("availableFrom"))) {
    errors.push({
      field: "availableFrom",
      error: "Available from must be a date (YYYY-MM-DD).",
    });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str("availableThrough"))) {
    errors.push({
      field: "availableThrough",
      error: "Available through must be a date (YYYY-MM-DD).",
    });
  }

  const footer = str("availabilityFooterTemplate");
  if (footer && !footer.includes("{date}")) {
    errors.push({
      field: "availabilityFooterTemplate",
      error: 'Availability footer must include the "{date}" placeholder.',
    });
  }

  const ctaText = str("ctaText");
  const ctaUrl = str("ctaUrl");
  if (ctaText && !ctaUrl) {
    errors.push({
      field: "ctaUrl",
      error: "CTA URL is required when CTA text is set.",
    });
  }
  if (!ctaText && ctaUrl) {
    errors.push({
      field: "ctaText",
      error: "CTA text is required when CTA URL is set.",
    });
  }

  return errors;
}

export function parseTipAdminSaveJson(
  httpOk: boolean,
  data: unknown,
): TipAdminSaveResult {
  if (data == null || typeof data !== "object" || Array.isArray(data)) {
    return {
      ok: false,
      error: "Save failed — the server did not return a usable response.",
    };
  }
  const rec = data as Record<string, unknown>;
  if (!httpOk || rec.ok !== true) {
    const error =
      typeof rec.error === "string" && rec.error.trim()
        ? rec.error.trim()
        : "Unable to save tip.";
    const field =
      typeof rec.field === "string" && rec.field.trim() ? rec.field.trim() : undefined;
    return { ok: false, error, field };
  }
  return {
    ok: true,
    tip: rec.tip,
    warning:
      typeof rec.warning === "string" && rec.warning.trim() ? rec.warning.trim() : undefined,
  };
}

export function queueTipAdminFlash(flash: TipAdminFlash): void {
  try {
    window.sessionStorage.setItem(TIP_ADMIN_FLASH_KEY, JSON.stringify(flash));
  } catch {
    // sessionStorage may be unavailable; the save still completed.
  }
}

export function readTipAdminFlash(): TipAdminFlash | null {
  try {
    const raw = window.sessionStorage.getItem(TIP_ADMIN_FLASH_KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(TIP_ADMIN_FLASH_KEY);
    const parsed = JSON.parse(raw) as TipAdminFlash;
    if (!parsed || typeof parsed.message !== "string" || !parsed.message.trim()) {
      return null;
    }
    const kind: TipAdminFlashKind =
      parsed.kind === "error" || parsed.kind === "warn" ? parsed.kind : "ok";
    return { message: parsed.message, kind };
  } catch {
    return null;
  }
}

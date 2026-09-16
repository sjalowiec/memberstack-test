import { HelpHubCategoryError } from "./categoryTypes";

export { HelpHubCategoryError };

export const HELP_HUB_CATEGORY_UPDATE_FAILED_MESSAGE =
  "We couldn’t update that category. Nothing was changed.";

export function isRawDatabaseErrorMessage(message: string): boolean {
  return /duplicate key|unique constraint|_pkey|_key\b|violates|postgres|pg_|sqlstate|23505/i.test(
    message,
  );
}

export function helpHubCategoryAdminErrorMessage(message: string | undefined | null): string {
  const text = (message ?? "").trim();
  if (!text || isRawDatabaseErrorMessage(text)) {
    return HELP_HUB_CATEGORY_UPDATE_FAILED_MESSAGE;
  }
  return text;
}

export function logHelpHubCategoryError(error: unknown): void {
  console.error("[help-hub-categories]", error);
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export function helpHubCategoryErrorResponse(error: unknown): Response {
  if (error instanceof HelpHubCategoryError) {
    const status = error.code === "NOT_FOUND" ? 404 : 400;
    return jsonResponse({ ok: false, error: error.message, code: error.code }, status);
  }
  logHelpHubCategoryError(error);
  return jsonResponse({ ok: false, error: HELP_HUB_CATEGORY_UPDATE_FAILED_MESSAGE }, 500);
}

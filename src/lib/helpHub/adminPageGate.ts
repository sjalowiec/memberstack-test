export type HelpHubAdminGateAuth =
  | { ok: true }
  | { ok: false; status: number; error: string };

export type HelpHubAdminEditorData = {
  entry: Record<string, unknown> | null;
  picker: {
    lessons: unknown[];
    library: unknown[];
    allLessons: unknown[];
  };
};

export type HelpHubAdminClientPayload = {
  authorized: boolean;
  needsSignIn: boolean;
  forbidden: boolean;
  error: string;
} & HelpHubAdminEditorData;

/**
 * Help Hub GET pages (`/admin/help-hub`, `/admin/help-hub-edit`) use the same site
 * admin gate as `/admin` and `/admin/lessons`: Netlify Basic Auth on `/admin/*`.
 * They must not call `requireAdminForRequest`, which is a Memberstack email/JWT
 * check used by save, preview, and delete APIs.
 */
export const HELP_HUB_ADMIN_PAGE_AUTH = "site-admin-basic" as const;

export function emptyHelpHubAdminEditorData(): HelpHubAdminEditorData {
  return { entry: null, picker: { lessons: [], library: [], allLessons: [] } };
}

/** Editor JSON for a visitor who already passed the `/admin/*` site admin gate. */
export function helpHubAdminEditorPayload(options: {
  entry?: Record<string, unknown> | null;
  lessons?: unknown[];
  library?: unknown[];
  allLessons?: unknown[];
}): HelpHubAdminEditorData {
  return {
    entry: options.entry ?? null,
    picker: {
      lessons: options.lessons ?? [],
      library: options.library ?? [],
      allLessons: options.allLessons ?? [],
    },
  };
}

/**
 * Defensive payload helper: if a Memberstack API-style auth result is not ok,
 * omit draft documents and picker catalogs. GET pages do not use this as a gate.
 */
export function helpHubAdminClientPayload(options: {
  auth: HelpHubAdminGateAuth;
  entry?: Record<string, unknown> | null;
  lessons?: unknown[];
  library?: unknown[];
  allLessons?: unknown[];
}): HelpHubAdminClientPayload {
  if (!options.auth.ok) {
    const status = options.auth.status;
    return {
      authorized: false,
      needsSignIn: status === 401,
      forbidden: status === 403,
      error: options.auth.error,
      ...emptyHelpHubAdminEditorData(),
    };
  }
  return {
    authorized: true,
    needsSignIn: false,
    forbidden: false,
    error: "",
    ...helpHubAdminEditorPayload(options),
  };
}

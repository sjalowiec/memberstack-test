export type HelpHubAdminGateAuth =
  | { ok: true }
  | { ok: false; status: number; error: string };

export type HelpHubAdminClientPayload = {
  authorized: boolean;
  needsSignIn: boolean;
  forbidden: boolean;
  error: string;
  entry: Record<string, unknown> | null;
  picker: {
    lessons: unknown[];
    library: unknown[];
    allLessons: unknown[];
  };
};

/**
 * Decide what the Help Hub admin HTML may include.
 * Unauthorized visitors get no draft documents and no picker catalogs.
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
      entry: null,
      picker: { lessons: [], library: [], allLessons: [] },
    };
  }
  return {
    authorized: true,
    needsSignIn: false,
    forbidden: false,
    error: "",
    entry: options.entry ?? null,
    picker: {
      lessons: options.lessons ?? [],
      library: options.library ?? [],
      allLessons: options.allLessons ?? [],
    },
  };
}

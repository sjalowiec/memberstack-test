/** Memberstack `kin_access`: allow unless normalized value is "false". */
export function hasKinVideoAccess(rawKinAccess: unknown): boolean {
  const normalized = String(rawKinAccess ?? "").trim().toLowerCase();
  return normalized !== "false";
}

/** Temporary: console debug for kin_access gating (remove after verification). */
export function logKinVideoAccessDebug(
  context: string,
  opts: {
    member: unknown;
    rawKinAccess: unknown;
    finalHasVideoAccess: boolean;
  },
): void {
  const { member, rawKinAccess, finalHasVideoAccess } = opts;
  const customFields = (member as { customFields?: unknown } | null)?.customFields;
  console.log("[KBM video access debug]", context, {
    memberExists: Boolean(member),
    memberCustomFields: customFields,
    rawKinAccess,
    typeofRawKinAccess: typeof rawKinAccess,
    normalizedKinAccess: String(rawKinAccess ?? "").trim().toLowerCase(),
    finalHasVideoAccess,
  });
}

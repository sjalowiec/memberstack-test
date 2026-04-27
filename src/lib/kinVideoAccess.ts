/** Memberstack `kin_access`: allow unless value is false or "false". */
export function hasKinVideoAccess(rawKinAccess: unknown): boolean {
  return rawKinAccess !== false && rawKinAccess !== "false";
}

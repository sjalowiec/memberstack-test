export type PreviewMemberState = "member" | "nonmember" | "default";

export function getPreviewMember(url?: URL): PreviewMemberState {
  // Only allow preview override in development
  if (!import.meta.env.DEV) return "default";

  const value = url?.searchParams.get("previewMember");

  if (value === "member") return "member";
  if (value === "nonmember") return "nonmember";

  return "default";
}

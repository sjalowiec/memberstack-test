/** Show developer-only skill builder views when ?debug=1 or ?dev=1 is in the URL. */
export function isSkillBuilderDebugMode(
  search: string = typeof window !== "undefined" ? window.location.search : "",
): boolean {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return params.get("debug") === "1" || params.get("dev") === "1";
}

/**
 * LESSONS_STORE=json is a local rollback switch only.
 * Hosted Netlify environments always use Postgres.
 */
export function useLessonsJsonStore(): boolean {
  if (process.env.LESSONS_STORE !== "json") return false;
  const isViteDev =
    typeof import.meta !== "undefined" && Boolean((import.meta as { env?: { DEV?: boolean } }).env?.DEV);
  return isViteDev || process.env.NODE_ENV === "test";
}

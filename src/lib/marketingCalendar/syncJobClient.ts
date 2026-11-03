export const MARKETING_CALENDAR_SYNCING_MESSAGE = "Syncing your calendar...";

export function marketingCalendarSyncMessage(job: {
  status?: string;
  created?: number;
  updated?: number;
  skipped?: number;
  error?: string | null;
}): string {
  if (job.status === "running") return MARKETING_CALENDAR_SYNCING_MESSAGE;
  if (job.status === "failed") return job.error?.trim() || "Marketing calendar sync failed.";
  return `Added ${job.created ?? 0}, updated ${job.updated ?? 0}, skipped ${job.skipped ?? 0}.`;
}

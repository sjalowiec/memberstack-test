/**
 * Read-only preview adapter for the legacy renewal reminder job.
 *
 * The Watson preview page and the scheduled/manual reminder function MUST make
 * identical eligibility decisions. To guarantee that, this module never
 * reimplements any selection, filtering, or SQL logic - it simply calls the one
 * shared `runLegacyRenewalReminders` entry point in DRY-RUN mode and reshapes
 * its results for display.
 *
 * Safety: `dryRun: true` is forced here and cannot be overridden by callers, so
 * the preview can never send emails, apply tags, create contacts, or write to
 * ActiveCampaign / Memberstack / the database.
 */
import {
  buildReminderPreviewCards,
  buildReminderPreviewRows,
} from "./legacyRenewalReminderPreviewView";
import { loadEnvFile } from "./env";
import {
  runLegacyRenewalReminders,
  type LegacyRenewalReminderResult,
  type ReminderTotals,
  type RunLegacyRenewalRemindersOptions,
} from "./legacyRenewalReminders";
import type {
  ReminderPreviewCard,
  ReminderPreviewRow,
} from "./legacyRenewalReminderPreviewView";

export type { ReminderPreviewCard, ReminderPreviewRow } from "./legacyRenewalReminderPreviewView";
export {
  buildReminderPreviewCards,
  buildReminderPreviewRows,
  REMINDER_STATUS_LABELS,
  reminderStatusModifier,
} from "./legacyRenewalReminderPreviewView";

export interface LegacyRenewalReminderPreview {
  ok: boolean;
  /** ISO timestamp of when the shared job finished (null on failure). */
  generatedAt: string | null;
  /** The America/Los_Angeles calendar day the preview evaluated. */
  todayLosAngeles: string;
  errorMessage: string | null;
  cards: ReminderPreviewCard[];
  rows: ReminderPreviewRow[];
  totals: ReminderTotals;
}

/** Injectable shared runner (tests). Defaults to the real reminder job. */
export type RunReminders = (
  options: RunLegacyRenewalRemindersOptions,
) => Promise<LegacyRenewalReminderResult>;

export interface LoadReminderPreviewOptions {
  /** Injected shared runner (tests). Defaults to `runLegacyRenewalReminders`. */
  run?: RunReminders;
  /**
   * Extra shared options forwarded to the runner (tests inject fakes here).
   * `dryRun` is intentionally omitted: the preview is always a dry run.
   */
  overrides?: Omit<RunLegacyRenewalRemindersOptions, "dryRun">;
}

/**
 * Run the shared reminder selection in dry-run mode and shape it for the Watson
 * preview page. This is the single source of truth for what the preview shows.
 */
export async function loadLegacyRenewalReminderPreview(
  options: LoadReminderPreviewOptions = {},
): Promise<LegacyRenewalReminderPreview> {
  const run = options.run ?? runLegacyRenewalReminders;

  // The preview runs inside the Astro SSR runtime. Vite only exposes `.env`
  // values on `import.meta.env`, not `process.env`, so - exactly like the Watson
  // DB layer (`db.ts`) - we copy `.env` into `process.env` first. This makes
  // `ACTIVECAMPAIGN_KIN_LIST_ID` (and the other AC vars) resolvable via
  // `process.env` in local dev, while deployed Netlify already populates them.
  loadEnvFile();
  const env = options.overrides?.env ?? process.env;

  // Spread caller overrides first, then FORCE the read-only invariants last so
  // nothing a caller (or the UI) passes can turn the preview into a live run.
  const result = await run({
    ...options.overrides,
    env,
    triggerSource: "manual",
    dryRun: true,
  });

  return {
    ok: result.ok,
    generatedAt: result.completedAt,
    todayLosAngeles: result.todayLosAngeles,
    errorMessage: result.errorMessage,
    cards: buildReminderPreviewCards(result.totals),
    rows: buildReminderPreviewRows(result.details),
    totals: result.totals,
  };
}

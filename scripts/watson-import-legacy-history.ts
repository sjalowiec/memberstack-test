/**
 * Cleaned legacy customer/history CLI.
 * Default mode is DRY RUN (no writes). Writes require an explicit --apply flag.
 * Never truncates or writes legacy_* dump tables.
 */
import path from "node:path";

import { getWatsonDatabaseUrl, loadEnvFile, formatDatabaseTarget } from "../src/lib/watson/env";
import {
  applyWatsonLegacyHistory,
  dryRunWatsonLegacyHistory,
  formatWatsonLegacyHistoryApplyReport,
  formatWatsonLegacyHistoryDryRunReport,
} from "../src/lib/watson/legacyHistoryImport";

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match?.slice(prefix.length);
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function defaultCleanedDir(): string {
  return path.resolve("legacy-data/cleaned");
}

async function main(): Promise<number> {
  loadEnvFile();

  if (hasFlag("import")) {
    console.error(
      "[watson:import-legacy-history] --import is not accepted. Dry-run is the default; writes require --apply.",
    );
    return 1;
  }

  const cleanedDir = readArg("dir") ?? defaultCleanedDir();
  const customersPath = path.resolve(
    readArg("customers") ?? path.join(cleanedDir, "legacy_customers_2026-08-26.csv"),
  );
  const historyPath = path.resolve(
    readArg("history") ?? path.join(cleanedDir, "legacy_history_final_V3_2026-08-26.csv"),
  );

  if (!hasFlag("apply")) {
    console.log("[watson:import-legacy-history] DRY RUN — no database connection, no writes.");
    console.log(`[watson:import-legacy-history] Customers: ${customersPath}`);
    console.log(`[watson:import-legacy-history] History: ${historyPath}`);

    const report = dryRunWatsonLegacyHistory({
      customersPath,
      historyPath,
    });
    console.log(formatWatsonLegacyHistoryDryRunReport(report));
    return report.rejectedRowCount > 0 ? 1 : 0;
  }

  const databaseUrl = getWatsonDatabaseUrl();
  const databaseTarget = formatDatabaseTarget(databaseUrl);
  console.log(
    `[watson:import-legacy-history] APPLY — writing to Watson Postgres: ${databaseTarget}`,
  );
  console.log("[watson:import-legacy-history] Tables: watson_legacy_customers, watson_legacy_history");
  console.log("[watson:import-legacy-history] Does not truncate or write legacy_* dump tables.");
  console.log(`[watson:import-legacy-history] Customers: ${customersPath}`);
  console.log(`[watson:import-legacy-history] History: ${historyPath}`);

  const report = await applyWatsonLegacyHistory({
    customersPath,
    historyPath,
    databaseUrl,
    onProgress: (message) => {
      console.log(`[watson:import-legacy-history] ${message}`);
    },
  });
  console.log(formatWatsonLegacyHistoryApplyReport(report));
  return report.status === "completed" ? 0 : 1;
}

const exitPromise = main()
  .then((exitCode) => {
    process.exitCode = exitCode;
    return exitCode;
  })
  .catch((error) => {
    console.error(
      `[watson:import-legacy-history] ERROR: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
    return 1;
  });

await exitPromise;
process.exit(process.exitCode ?? 0);

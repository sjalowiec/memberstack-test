/**
 * Cleaned legacy garment-title lookup CLI.
 * Default mode is DRY RUN (no writes). Writes require an explicit --apply flag.
 * Never truncates or writes legacy_* dump tables.
 */
import path from "node:path";

import { getWatsonDatabaseUrl, loadEnvFile, formatDatabaseTarget } from "../src/lib/watson/env";
import {
  applyWatsonLegacyGarments,
  dryRunWatsonLegacyGarments,
  formatWatsonLegacyGarmentsApplyReport,
  formatWatsonLegacyGarmentsDryRunReport,
  resolveLegacyGarmentsCsvPath,
} from "../src/lib/watson/legacyGarmentsImport";

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match?.slice(prefix.length);
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function main(): Promise<number> {
  loadEnvFile();

  if (hasFlag("import")) {
    console.error(
      "[watson:import-legacy-garments] --import is not accepted. Dry-run is the default; writes require --apply.",
    );
    return 1;
  }

  const garmentsPath = resolveLegacyGarmentsCsvPath({
    filePath: readArg("file") ?? readArg("garments"),
    dir: readArg("dir") ?? path.resolve("legacy-data/cleaned"),
  });

  if (!hasFlag("apply")) {
    console.log("[watson:import-legacy-garments] DRY RUN — no database connection, no writes.");
    console.log(`[watson:import-legacy-garments] Garments: ${garmentsPath}`);
    console.log("[watson:import-legacy-garments] Table: watson_legacy_garments");

    const report = dryRunWatsonLegacyGarments({
      garmentsPath,
    });
    console.log(formatWatsonLegacyGarmentsDryRunReport(report));
    return report.rejectedRowCount > 0 ? 1 : 0;
  }

  const databaseUrl = getWatsonDatabaseUrl();
  const databaseTarget = formatDatabaseTarget(databaseUrl);
  console.log(
    `[watson:import-legacy-garments] APPLY — writing to Watson Postgres: ${databaseTarget}`,
  );
  console.log("[watson:import-legacy-garments] Table: watson_legacy_garments");
  console.log("[watson:import-legacy-garments] Does not truncate or write legacy_* dump tables.");
  console.log(`[watson:import-legacy-garments] Garments: ${garmentsPath}`);

  const report = await applyWatsonLegacyGarments({
    garmentsPath,
    databaseUrl,
    onProgress: (message) => {
      console.log(`[watson:import-legacy-garments] ${message}`);
    },
  });
  console.log(formatWatsonLegacyGarmentsApplyReport(report));
  return report.status === "completed" ? 0 : 1;
}

const exitPromise = main()
  .then((exitCode) => {
    process.exitCode = exitCode;
    return exitCode;
  })
  .catch((error) => {
    console.error(
      `[watson:import-legacy-garments] ERROR: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
    return 1;
  });

await exitPromise;
process.exit(process.exitCode ?? 0);

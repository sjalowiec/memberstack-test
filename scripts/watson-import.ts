import path from "path";

import {
  formatDatabaseTarget,
  getWatsonDatabaseUrl,
  loadEnvFile,
} from "../src/lib/watson/env";
import {
  formatImportReport,
  importLegacyBatch,
} from "../src/lib/watson/importBatch";

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match?.slice(prefix.length);
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function log(message: string): void {
  console.log(`[watson:import] ${message}`);
}

async function main(): Promise<number> {
  loadEnvFile();
  log("Environment loaded.");

  const positional = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
  const exportDir =
    readArg("dir") ?? positional[0] ?? "legacy-data/exports/2026-07-11";

  const resolvedDir = path.resolve(exportDir);
  const batchId = readArg("batch");
  const dryRun = hasFlag("dry-run");
  const schemaOnly = hasFlag("schema-only");

  log(`Export directory: ${resolvedDir}`);
  if (batchId) {
    log(`Batch ID override: ${batchId}`);
  }

  if (dryRun) {
    log("Dry-run mode: skipping database connection.");
    const report = await importLegacyBatch("", {
      exportDir: resolvedDir,
      batchId,
      dryRun: true,
      onProgress: log,
    });
    console.log(formatImportReport(report));
    return report.missingRequired.length > 0 ? 1 : 0;
  }

  log("Resolving database URL...");
  const databaseUrl = getWatsonDatabaseUrl();
  log(`Database target: ${formatDatabaseTarget(databaseUrl)}`);

  if (schemaOnly) {
    log("Schema-only mode: creating tables and indexes without importing data.");
  }

  const report = await importLegacyBatch(databaseUrl, {
    exportDir: resolvedDir,
    batchId,
    dryRun: false,
    schemaOnly,
    onProgress: log,
  });

  console.log(formatImportReport(report));
  return report.status === "completed" ? 0 : 1;
}

const exitPromise = main()
  .then((exitCode) => {
    process.exitCode = exitCode;
    return exitCode;
  })
  .catch((error) => {
    console.error(
      `[watson:import] ERROR: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
    return 1;
  });

await exitPromise;
process.exit(process.exitCode ?? 0);

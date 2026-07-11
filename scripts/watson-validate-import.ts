import path from "path";

import { loadEnvFile } from "../src/lib/watson/env";
import {
  formatValidateReport,
  validateLegacyImport,
} from "../src/lib/watson/validateImport";

loadEnvFile();

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match?.slice(prefix.length);
}

async function main(): Promise<void> {
  const exportDir = readArg("dir") ?? "legacy-data/exports/2026-07-11";
  const resolvedDir = path.resolve(exportDir);
  const batchId = readArg("batch");

  const report = await validateLegacyImport({
    exportDir: resolvedDir,
    batchId,
  });

  console.log(formatValidateReport(report));
  process.exit(report.ok ? 0 : 1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

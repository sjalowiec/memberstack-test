import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import {
  formatDatabaseTarget,
  getWatsonAdminDatabaseUrl,
  loadEnvFile,
} from "../src/lib/watson/env";
import { importHelpHubDocuments } from "../src/lib/helpHub/importFromJson";
import type { HelpHubTipDocument } from "../src/lib/helpHub/types";
import type { WatsonQueryFn } from "../src/lib/watson/memberSearch";

loadEnvFile();

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const jsonPath = join(root, "src", "data", "help-hub.json");

async function main() {
  const raw = readFileSync(jsonPath, "utf8");
  const data = JSON.parse(raw) as unknown;
  if (!Array.isArray(data)) {
    throw new Error("help-hub.json must be an array.");
  }
  const docs = data.filter(
    (row): row is HelpHubTipDocument => row !== null && typeof row === "object",
  );

  const databaseUrl = getWatsonAdminDatabaseUrl();
  console.log(`[help-hub:import] Writing to Watson Postgres: ${formatDatabaseTarget(databaseUrl)}`);
  console.log("[help-hub:import] Table: help_hub_tips");
  console.log("[help-hub:import] Source: src/data/help-hub.json");

  const pool = new pg.Pool({ connectionString: databaseUrl });
  const queryFn: WatsonQueryFn = async (sql, params = []) => {
    const result = await pool.query(sql, params);
    return result.rows;
  };

  try {
    const report = await importHelpHubDocuments(docs, queryFn, {
      email: "help-hub-json-import",
    });
    console.log(JSON.stringify(report, null, 2));
    if (report.roundTripFailures.length) {
      process.exitCode = 1;
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

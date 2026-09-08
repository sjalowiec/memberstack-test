import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import {
  formatDatabaseTarget,
  getWatsonAdminDatabaseUrl,
  loadEnvFile,
} from "../src/lib/watson/env";
import { importLessonDocuments } from "../src/lib/lessons/importFromJson";
import type { LessonDocument } from "../src/lib/lessons/types";
import type { WatsonQueryFn } from "../src/lib/watson/memberSearch";

loadEnvFile();

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const jsonPath = join(root, "src", "data", "lessons.json");

async function main() {
  const raw = readFileSync(jsonPath, "utf8");
  const data = JSON.parse(raw) as unknown;
  if (!Array.isArray(data)) {
    throw new Error("lessons.json must be an array.");
  }
  const docs = data.filter(
    (row): row is LessonDocument => row !== null && typeof row === "object" && !Array.isArray(row),
  );

  if (docs.some((row) => row.id === 5004)) {
    throw new Error("Refusing to import unfinished lesson 5004.");
  }

  const databaseUrl = getWatsonAdminDatabaseUrl();
  console.log(`[lessons:import] Writing to Watson Postgres: ${formatDatabaseTarget(databaseUrl)}`);
  console.log("[lessons:import] Table: member_lessons");
  console.log("[lessons:import] Source: src/data/lessons.json");

  const pool = new pg.Pool({ connectionString: databaseUrl });
  const queryFn: WatsonQueryFn = async (sql, params = []) => {
    const result = await pool.query(sql, params);
    return result.rows;
  };

  try {
    const report = await importLessonDocuments(docs, queryFn, {
      email: "lessons-json-import",
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

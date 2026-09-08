import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import {
  formatDatabaseTarget,
  getWatsonAdminDatabaseUrl,
  loadEnvFile,
} from "../src/lib/watson/env";

loadEnvFile();

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sqlPath = join(root, "scripts", "sql", "member-lessons.sql");

async function main() {
  const databaseUrl = getWatsonAdminDatabaseUrl();
  console.log(`[lessons:migrate] Watson Postgres: ${formatDatabaseTarget(databaseUrl)}`);

  const pool = new pg.Pool({ connectionString: databaseUrl });
  try {
    const existing = await pool.query<{ exists: string | null }>(
      "SELECT to_regclass('public.member_lessons') AS exists",
    );
    if (existing.rows[0]?.exists) {
      console.log("[lessons:migrate] member_lessons already exists; skipping CREATE.");
      return;
    }
    const sql = readFileSync(sqlPath, "utf8");
    await pool.query(sql);
    console.log("[lessons:migrate] Created member_lessons with RLS enabled.");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

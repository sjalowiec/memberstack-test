import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import {
  legacyImportStatement,
  readLegacyReviewExport,
  summarizeLegacyReviews,
} from "../src/lib/testimonials/legacyReviewImport";
import { resolveLegacyImportDestination } from "../src/lib/testimonials/legacyImportTarget";
import { getWatsonAdminDatabaseUrl, loadEnvFile } from "../src/lib/watson/env";

loadEnvFile();

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const csvPath = join(root, "legacy-data", "private", "reviews", "legacy-reviews.csv");
const migrationPath = join(root, "supabase", "migrations", "20261105103000_testimonials.sql");
const deletedLegacyIdsPath = join(
  root,
  "supabase",
  "migrations",
  "20261105160000_testimonial_deleted_legacy_ids.sql",
);
const apply = process.argv.includes("--apply");
const targetIndex = process.argv.indexOf("--target");
const target = targetIndex >= 0 ? process.argv[targetIndex + 1] ?? "" : null;

async function main() {
  const rows = readLegacyReviewExport(csvPath);
  const summary = summarizeLegacyReviews(rows);
  console.log("Legacy testimonial dry run");
  console.log(JSON.stringify(summary, null, 2));
  console.log("Every inserted row starts inactive. Legacy Show is stored and does not publish.");
  console.log("Repeat imports refresh historical fields only. Activation and display edits stay.");
  console.log("A deleted legacy rating id is not imported again.");

  const plan = resolveLegacyImportDestination({
    apply,
    target,
    localUrl: process.env.TESTIMONIALS_DATABASE_URL?.trim() || "",
    watsonUrl: target === "configured-watson" ? getWatsonAdminDatabaseUrl() : "",
  });
  if (!plan.ok) {
    console.error(plan.reason);
    process.exitCode = 1;
    return;
  }
  console.log(plan.description);
  if (!plan.write) {
    console.log("Dry run only. No schema change and no import.");
    return;
  }

  const pool = new pg.Pool({ connectionString: plan.url });
  try {
    const migration = readFileSync(migrationPath, "utf8");
    const deletedLegacyIds = readFileSync(deletedLegacyIdsPath, "utf8");
    const statement = legacyImportStatement();
    await pool.query("BEGIN");
    await pool.query(migration);
    await pool.query(deletedLegacyIds);
    for (const row of rows) {
      await pool.query(statement, [
        row.legacyRatingId,
        row.quote,
        row.attribution,
        row.reviewDate,
        row.rating,
        row.legacyMemberId,
        row.legacyShow,
        row.legacyViewed,
        row.legacyUseInEmail,
      ]);
    }
    await pool.query("COMMIT");
    console.log(`Imported ${rows.length} testimonials. ${plan.description} All new rows are inactive.`);
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

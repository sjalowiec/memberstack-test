/**
 * Read-only production impact audit for LEGACY_EBOOK_WATSON_LOOKUP.
 *
 * SELECT only. Does not grant ebooks, write Watson rows, or set the production flag.
 *
 *   npx vite-node scripts/audit-legacy-ebook-watson-lookup-impact.ts
 */
import { closeWatsonPool } from "../src/lib/watson/db";
import { formatDatabaseTarget, loadEnvFile } from "../src/lib/watson/env";
import { loadLegacyEbookWatsonLookupImpact } from "../src/lib/legacy/legacyEbookWatsonLookupImpact";

loadEnvFile();

async function main(): Promise<void> {
  const databaseUrl = process.env.WATSON_DATABASE_URL?.trim();
  if (!databaseUrl) {
    console.error("WATSON_DATABASE_URL is not set. Cannot run the read-only impact audit.");
    process.exit(1);
  }

  console.log("Read-only LEGACY_EBOOK_WATSON_LOOKUP impact audit");
  console.log(`Watson target: ${formatDatabaseTarget(databaseUrl)}`);
  console.log("No writes. Production flag is not changed.");

  const summary = await loadLegacyEbookWatsonLookupImpact();
  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeWatsonPool();
  });

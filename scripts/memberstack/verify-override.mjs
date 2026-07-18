/**
 * Password-safe check that the Celine override landed in the import CSV.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, "../../tmp/memberstack-import/output");

function parseCsvLine(line) {
  const fields = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQuotes = false;
      } else cur += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") {
        fields.push(cur);
        cur = "";
      } else cur += c;
    }
  }
  fields.push(cur);
  return fields;
}

function splitCsvRows(text) {
  const rows = [];
  let row = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      inQuotes = !inQuotes;
      row += c;
    } else if ((c === "\n" || (c === "\r" && text[i + 1] !== "\n")) && !inQuotes) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      if (row.length) rows.push(row);
      row = "";
    } else row += c;
  }
  if (row.length) rows.push(row);
  return rows;
}

const importPath = path.join(outDir, "memberstack-monthly-import.csv");
const rows = splitCsvRows(fs.readFileSync(importPath, "utf8"));
const headers = parseCsvLine(rows[0]);
const idx = Object.fromEntries(headers.map((h, i) => [h, i]));

const TARGET_SUB = "sub_1TetOVCW7QxJHpQOQlxXX7c0";
const TARGET_LEGACY = "C3667397-B4E2-0B5B-2D88-F1E2D4BDF128";

let found = null;
for (const line of rows.slice(1)) {
  const f = parseCsvLine(line);
  if (f[idx["Member Stripe Subscription ID"]] === TARGET_SUB) {
    found = {
      email: f[idx.Email],
      customerId: f[idx["Member Stripe Customer ID"]],
      subscriptionId: f[idx["Member Stripe Subscription ID"]],
      legacyMemberID: f[idx.legacyMemberID],
      firstNamePresent: Boolean(String(f[idx["first-name"]] || "").trim()),
      lastNamePresent: Boolean(String(f[idx["last-name"]] || "").trim()),
      dateJoinedPresent: Boolean(String(f[idx["date-joined"]] || "").trim()),
      passwordPresent: Boolean(String(f[idx.Password] || "").trim()),
    };
    break;
  }
}

const unmatched = fs.readFileSync(path.join(outDir, "unmatched-stripe-members.csv"), "utf8").trim().split(/\r?\n/);
const overrides = fs.readFileSync(path.join(outDir, "memberid-overrides-applied.csv"), "utf8").trim().split(/\r?\n/);
const report = JSON.parse(fs.readFileSync(path.join(outDir, "migration-report.json"), "utf8"));

console.log(
  JSON.stringify(
    {
      importRowFound: Boolean(found),
      importRow: found,
      legacyIdMatches: found?.legacyMemberID === TARGET_LEGACY,
      unmatchedDataRows: Math.max(0, unmatched.length - 1),
      overrideAppliedRows: Math.max(0, overrides.length - 1),
      counts: {
        importRows: report.importRowCount,
        unmatched: report.step4.totalUnmatchedStripeSubscriptions,
        overrides: report.step4.totalOverrideMatches,
        matchedSubscriptionRows: report.step4.totalMatchedLegacyMembers,
        uniqueImportCandidates: report.step4.totalUniqueMatchedMembersForImport,
        emailMismatches: report.step4.totalEmailMismatches,
      },
    },
    null,
    2,
  ),
);

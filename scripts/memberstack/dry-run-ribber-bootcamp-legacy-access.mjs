/**
 * Dry run only. Maps verified Home Study 26 purchasers to player 66 and
 * classifies Memberstack accounts. Never creates members, grants plans,
 * patches fields, or sends email. Challenge 26 (Dragon Shawl) is not used.
 *
 * Credit rows are classified with the Home Study rule: TransactionType
 * "Home Study Courses", a positive dollar amount, or a NULL amount that has
 * both AthorizeID and transactionguid.
 *
 * Memberstack GET /members/{email} returns HTTP 200 and `{ "data": null }`
 * when no account exists. That is a missing account, not an ambiguous match.
 */
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
const PRIVATE_DIR = resolve(ROOT, "legacy-data/private/course-66");
const REPORT_CSV = resolve(PRIVATE_DIR, "ribber-bootcamp-dry-run.csv");
const SUMMARY_JSON = resolve(PRIVATE_DIR, "ribber-bootcamp-dry-run-summary.json");

if (process.argv.slice(2).some((arg) => arg !== "--dry-run")) {
  console.error("This script is dry-run only. It does not create accounts, grant plans, or send email.");
  process.exit(1);
}

function readEnvKey() {
  const envText = readFileSync(resolve(ROOT, ".env"), "utf8");
  const line = envText.split(/\r?\n/).find((row) => row.startsWith("MEMBERSTACK_SECRET_KEY="));
  if (!line) throw new Error("MEMBERSTACK_SECRET_KEY is missing.");
  let value = line.slice("MEMBERSTACK_SECRET_KEY=".length).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  if (!value.startsWith("sk_")) throw new Error("MEMBERSTACK_SECRET_KEY is not an Admin key.");
  if (value.startsWith("sk_sb_")) throw new Error("Refusing the Memberstack sandbox key.");
  return value;
}

function queryOwners() {
  const sql = `
SET NOCOUNT ON;
SELECT (
  SELECT
    CONVERT(varchar(36), owners.memberid) AS memberid,
    ISNULL(m.Fristname, '') AS firstName,
    ISNULL(m.Lastname, '') AS lastName,
    LOWER(LTRIM(RTRIM(ISNULL(m.Email, '')))) AS email,
    owners.records AS creditRows,
    owners.classifications,
    owners.minAmount,
    owners.maxAmount
  FROM (
    SELECT
      l.memberid_fk AS memberid,
      COUNT(*) AS records,
      MIN(CASE
        WHEN c.dollaramount > 0 THEN 'verified_positive_amount'
        ELSE 'verified_null_amount_with_payment_ids'
      END) AS classifications,
      MIN(c.dollaramount) AS minAmount,
      MAX(c.dollaramount) AS maxAmount
    FROM HomeStudy_Course_member_library AS l
    INNER JOIN credt_history AS c ON l.Credit_id_fk = c.Credit_id
    WHERE l.HomeStudy_courseid_fk = 26
      AND l.Subscriberfree = 0
      AND LTRIM(RTRIM(c.TransactionType)) = 'Home Study Courses'
      AND (
        c.dollaramount > 0
        OR (
          c.dollaramount IS NULL
          AND NULLIF(LTRIM(RTRIM(CONVERT(varchar(100), c.AthorizeID))), '') IS NOT NULL
          AND NULLIF(LTRIM(RTRIM(CONVERT(varchar(100), c.transactionguid))), '') IS NOT NULL
        )
      )
    GROUP BY l.memberid_fk
  ) owners
  LEFT JOIN Members AS m ON m.memberid = owners.memberid
  ORDER BY owners.memberid
  FOR JSON PATH
) AS payload;
`;
  const sqlPath = resolve(PRIVATE_DIR, "ribber-bootcamp-owners.sql");
  mkdirSync(PRIVATE_DIR, { recursive: true });
  writeFileSync(sqlPath, sql, "utf8");
  const result = spawnSync(
    "sqlcmd",
    ["-C", "-S", "localhost", "-E", "-d", "patternengine", "-y", "0", "-w", "65535", "-i", sqlPath],
    { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 },
  );
  unlinkSync(sqlPath);
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Legacy owner query failed: ${(result.stderr || result.stdout || result.status).toString().slice(0, 500)}`);
  }
  const joined = (result.stdout ?? "").split(/\r?\n/).map((line) => line.trimEnd()).join("").trim();
  const start = joined.indexOf("[");
  const end = joined.lastIndexOf("]");
  if (start < 0 || end < start) throw new Error("Legacy owner query did not return JSON.");
  return JSON.parse(joined.slice(start, end + 1));
}

function requestMemberstack(apiKey, url) {
  const result = spawnSync(
    "curl.exe",
    [
      "-sS",
      "-w",
      "\n%{http_code}",
      "-X",
      "GET",
      "-H",
      `X-API-KEY: ${apiKey}`,
      "-H",
      "Accept: application/json",
      url,
    ],
    { encoding: "utf8" },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Memberstack GET failed: ${result.stderr || result.status}`);
  const output = result.stdout ?? "";
  const splitAt = output.lastIndexOf("\n");
  const responseBody = splitAt >= 0 ? output.slice(0, splitAt) : output;
  const status = Number(splitAt >= 0 ? output.slice(splitAt + 1).trim() : "0");
  let parsed = null;
  try {
    parsed = JSON.parse(responseBody);
  } catch {
    parsed = null;
  }
  return { status, member: parsed?.data ?? null };
}

function memberEmail(member) {
  const auth = member?.auth && typeof member.auth === "object" ? member.auth : {};
  const email = auth.email ?? member?.email ?? "";
  return String(email).trim().toLowerCase();
}

function sameMailbox(left, right) {
  const normalize = (value) => {
    const email = String(value ?? "").trim().toLowerCase();
    const at = email.lastIndexOf("@");
    if (at <= 0) return email;
    const local = email.slice(0, at);
    const domain = email.slice(at + 1);
    if (domain === "googlemail.com") return `${local}@gmail.com`;
    return email;
  };
  return normalize(left) === normalize(right);
}

function csvCell(value) {
  const text = value == null ? "" : String(value);
  if (/[",\r\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function writeCsv(path, headers, rows) {
  const lines = [headers.join(",")];
  for (const row of rows) lines.push(headers.map((header) => csvCell(row[header])).join(","));
  writeFileSync(path, `\uFEFF${lines.join("\r\n")}\r\n`, "utf8");
}

const apiKey = readEnvKey();
const authProbe = requestMemberstack(
  apiKey,
  "https://admin.memberstack.com/members/ribber-dry-run-missing@example.invalid",
);
if (authProbe.status === 401 || authProbe.status === 403) {
  throw new Error("Memberstack Admin API rejected the live key.");
}

const owners = queryOwners();
if (owners.length !== 223) {
  throw new Error(`Expected 223 deduped owners, found ${owners.length}.`);
}

const reports = [];
const summary = {
  creditRows: 0,
  owners: owners.length,
  existingMemberstackMatches: 0,
  missingAccounts: 0,
  ambiguousRecords: 0,
  nameDifferencesOnMatchedAccounts: 0,
  blankEmail: 0,
  duplicateCreditOwners: 0,
  lookupErrors: 0,
  plansGranted: 0,
  accountsCreated: 0,
};

for (const owner of owners) {
  summary.creditRows += Number(owner.creditRows) || 0;
  if (Number(owner.creditRows) > 1) summary.duplicateCreditOwners += 1;
  const email = String(owner.email ?? "").trim().toLowerCase();
  let outcome = "ambiguous";
  let memberstackId = "";
  let note = "";
  if (!email) {
    summary.blankEmail += 1;
    summary.ambiguousRecords += 1;
    note = "legacy_member_has_no_email";
  } else {
    const lookup = requestMemberstack(
      apiKey,
      `https://admin.memberstack.com/members/${encodeURIComponent(email)}`,
    );
    const member = lookup.member;
    const foundId = typeof member?.id === "string" ? member.id.trim() : "";
    if (member && foundId && sameMailbox(memberEmail(member), email)) {
      outcome = "existing_memberstack_match";
      memberstackId = foundId;
      summary.existingMemberstackMatches += 1;
      const auth = member.auth && typeof member.auth === "object" ? member.auth : {};
      const custom = member.customFields && typeof member.customFields === "object" ? member.customFields : {};
      const first = String(custom["first-name"] ?? auth.firstName ?? member.firstName ?? "").trim();
      const last = String(custom["last-name"] ?? auth.lastName ?? member.lastName ?? "").trim();
      const legacyFirst = String(owner.firstName ?? "").trim();
      const legacyLast = String(owner.lastName ?? "").trim();
      const differs =
        (first && legacyFirst && first.toLowerCase() !== legacyFirst.toLowerCase()) ||
        (last && legacyLast && last.toLowerCase() !== legacyLast.toLowerCase());
      if (differs) {
        summary.nameDifferencesOnMatchedAccounts += 1;
        note = "matched_account_name_differs";
      }
    } else if ((lookup.status === 404 || lookup.status === 200) && !member) {
      outcome = "missing_account";
      summary.missingAccounts += 1;
    } else {
      summary.ambiguousRecords += 1;
      summary.lookupErrors += 1;
      note = `memberstack_status_${lookup.status}`;
    }
  }
  reports.push({
    legacy_member_id: owner.memberid,
    email,
    first_name: owner.firstName ?? "",
    last_name: owner.lastName ?? "",
    credit_rows: owner.creditRows,
    classifications: owner.classifications,
    min_amount: owner.minAmount ?? "",
    max_amount: owner.maxAmount ?? "",
    memberstack_outcome: outcome,
    memberstack_member_id: memberstackId,
    notes: note,
  });
}

if (summary.creditRows !== 226) {
  throw new Error(`Expected 226 verified credit rows, found ${summary.creditRows}.`);
}
if (
  summary.existingMemberstackMatches + summary.missingAccounts + summary.ambiguousRecords !==
  summary.owners
) {
  throw new Error("Owner outcomes do not add up to the deduped owner count.");
}

mkdirSync(PRIVATE_DIR, { recursive: true });
writeCsv(
  REPORT_CSV,
  [
    "legacy_member_id",
    "email",
    "first_name",
    "last_name",
    "credit_rows",
    "classifications",
    "min_amount",
    "max_amount",
    "memberstack_outcome",
    "memberstack_member_id",
    "notes",
  ],
  reports,
);
writeFileSync(SUMMARY_JSON, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
console.log(JSON.stringify(summary));

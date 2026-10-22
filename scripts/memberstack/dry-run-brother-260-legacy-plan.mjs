/**
 * Dry run only. Proposes Memberstack add-plan actions for verified Course 87
 * owners who already have accounts. Never calls add-plan.
 *
 * Input: legacy-data/private/course-87/course-87-existing-accounts.csv
 * The 29 owners without accounts and the 7 uncertain records are excluded.
 */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const PLAN_ID = "pln_course-brother-260-legacy-m2vb0y2r";
const ROOT = resolve(import.meta.dirname, "../..");
const PRIVATE_DIR = resolve(ROOT, "legacy-data/private/course-87");
const EXISTING_CSV = resolve(PRIVATE_DIR, "course-87-existing-accounts.csv");
const NEED_ACCOUNT_CSV = resolve(PRIVATE_DIR, "course-87-need-account.csv");
const UNCERTAIN_CSV = resolve(PRIVATE_DIR, "course-87-uncertain.csv");

if (process.argv.slice(2).some((arg) => arg !== "--dry-run")) {
  console.error("This script is dry-run only. It does not grant plans.");
  process.exit(1);
}

function readEnvKey() {
  const envText = readFileSync(resolve(ROOT, ".env"), "utf8");
  const line = envText.split(/\r?\n/).find((row) => row.startsWith("MEMBERSTACK_SECRET_KEY="));
  const key = line?.slice("MEMBERSTACK_SECRET_KEY=".length).trim().replace(/^["']|["']$/g, "");
  if (!key || key.startsWith("sk_sb_")) {
    throw new Error("Live MEMBERSTACK_SECRET_KEY is required. Sandbox keys are refused.");
  }
  return key;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  const source = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((cells) => cells.some((cell) => cell.trim()));
}

function emailsFrom(path) {
  const rows = parseCsv(readFileSync(path, "utf8"));
  const header = rows[0]?.map((cell) => cell.trim());
  const emailIndex = header?.indexOf("email") ?? -1;
  if (emailIndex < 0) throw new Error(`No email column in ${path}`);
  return rows.slice(1).map((cells) => cells[emailIndex].trim().toLowerCase());
}

function memberEmail(member) {
  const auth = member?.auth && typeof member.auth === "object" ? member.auth : {};
  const email = auth.email ?? member?.email ?? "";
  return String(email).trim().toLowerCase();
}

function planIdOf(connection) {
  if (!connection || typeof connection !== "object") return "";
  if (typeof connection.planId === "string" && connection.planId.trim()) return connection.planId.trim();
  if (typeof connection.plan === "string" && connection.plan.trim()) return connection.plan.trim();
  if (connection.plan && typeof connection.plan.id === "string") return connection.plan.id.trim();
  return "";
}

function connectionState(connection) {
  if (connection?.active === false) return "inactive";
  const status = String(connection?.status ?? "").trim().toUpperCase();
  if (!status) return "active";
  if (status === "ACTIVE" || status === "TRIALING") return "active";
  return status.toLowerCase();
}

function getMember(apiKey, idOrEmail) {
  const url = `https://admin.memberstack.com/members/${encodeURIComponent(idOrEmail)}`;
  const result = spawnSync(
    "curl.exe",
    ["-sS", "-w", "\n%{http_code}", "-H", `X-API-KEY: ${apiKey}`, "-H", "Accept: application/json", url],
    { encoding: "utf8" },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Memberstack lookup failed for ${idOrEmail}: ${result.stderr || result.status}`);
  }
  const output = result.stdout ?? "";
  const splitAt = output.lastIndexOf("\n");
  const body = splitAt >= 0 ? output.slice(0, splitAt) : output;
  const status = Number(splitAt >= 0 ? output.slice(splitAt + 1).trim() : "0");
  let parsed = null;
  try {
    parsed = JSON.parse(body);
  } catch {
    parsed = null;
  }
  return { status, member: parsed?.data ?? null, body };
}

const apiKey = readEnvKey();
const existing = emailsFrom(EXISTING_CSV);
const needAccount = new Set(emailsFrom(NEED_ACCOUNT_CSV));
const uncertain = new Set(emailsFrom(UNCERTAIN_CSV));
const overlap = existing.filter((email) => needAccount.has(email) || uncertain.has(email));

if (existing.length !== 17) {
  throw new Error(`Expected 17 existing accounts, found ${existing.length}.`);
}
if (needAccount.size !== 29) {
  throw new Error(`Expected 29 owners without accounts, found ${needAccount.size}.`);
}
if (uncertain.size !== 7) {
  throw new Error(`Expected 7 uncertain records, found ${uncertain.size}.`);
}
if (overlap.length) {
  throw new Error(`Existing-account list overlaps excluded records: ${overlap.join(", ")}`);
}

const results = [];
for (const email of existing) {
  const byEmail = getMember(apiKey, email);
  const emailMember = byEmail.member;
  const emailMemberId = typeof emailMember?.id === "string" ? emailMember.id.trim() : "";
  if (byEmail.status !== 200 || !emailMember || !emailMemberId) {
    results.push({
      email,
      memberId: emailMemberId || null,
      action: "mismatch",
      reason: "member_not_found",
      httpStatus: byEmail.status,
    });
    continue;
  }

  const byId = getMember(apiKey, emailMemberId);
  const idMember = byId.member;
  const idEmail = memberEmail(idMember);
  if (byId.status !== 200 || !idMember || memberEmail(idMember) !== email || idEmail !== memberEmail(emailMember)) {
    results.push({
      email,
      memberId: emailMemberId,
      action: "mismatch",
      reason: "member_id_email_mismatch",
      idEmail: idEmail || null,
      httpStatus: byId.status,
    });
    continue;
  }

  const connections = Array.isArray(idMember.planConnections) ? idMember.planConnections : [];
  const matches = connections
    .map((connection) => ({ planId: planIdOf(connection), state: connectionState(connection) }))
    .filter((connection) => connection.planId === PLAN_ID);
  const active = matches.find((connection) => connection.state === "active");
  if (active) {
    results.push({
      email,
      memberId: emailMemberId,
      action: "already_has_plan",
      planId: PLAN_ID,
    });
  } else if (matches.length) {
    results.push({
      email,
      memberId: emailMemberId,
      action: "mismatch",
      reason: "plan_present_but_not_active",
      states: matches.map((connection) => connection.state),
    });
  } else {
    results.push({
      email,
      memberId: emailMemberId,
      action: "would_add_plan",
      planId: PLAN_ID,
    });
  }
}

const summary = {
  planId: PLAN_ID,
  dryRun: true,
  granted: false,
  existingAccounts: existing.length,
  excludedWithoutAccount: needAccount.size,
  excludedUncertain: uncertain.size,
  wouldAdd: results.filter((row) => row.action === "would_add_plan").length,
  alreadyHasPlan: results.filter((row) => row.action === "already_has_plan").length,
  mismatches: results.filter((row) => row.action === "mismatch").length,
  results,
};

console.log(JSON.stringify(summary, null, 2));
if (summary.mismatches) process.exitCode = 2;

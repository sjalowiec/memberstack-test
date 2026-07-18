/**
 * Monthly Memberstack migration runner (46 update + 285 create; skip 20 review).
 *
 * Default is dry-run (no Memberstack writes). Paid Premium is attached by Stripe
 * Customer + Subscription IDs via Memberstack CSV import (Admin API cannot assign
 * paid plans). This script:
 *   1) Updates/creates members via Admin API when --execute is passed
 *   2) Always writes ready-to-upload Stripe-attach CSVs
 *   3) Writes detailed logs under tmp/memberstack-import/output/
 *
 * Usage:
 *   node scripts/memberstack/run-monthly-migration.mjs
 *   node scripts/memberstack/run-monthly-migration.mjs --dry-run
 *   node scripts/memberstack/run-monthly-migration.mjs --preflight-only
 *   node scripts/memberstack/run-monthly-migration.mjs --execute --i-understand-this-writes-to-memberstack
 *   node scripts/memberstack/run-monthly-migration.mjs --verify
 *
 * IMPORTANT: Dry-run and verify call the LIVE Memberstack Admin API (GET only).
 * They do not create/update/delete members, but they do require network/TLS access
 * to https://admin.memberstack.com. Offline simulation is intentionally not used so
 * duplicate protection (GET-by-email / GET-by-id) stays accurate.
 *
 * Local TLS: if Node fails with UNABLE_TO_VERIFY_LEAF_SIGNATURE (common behind SSL
 * inspection), set MEMBERSTACK_TLS_INSECURE=1 in .env or the shell before running.
 *
 * See scripts/memberstack/MONTHLY_MIGRATION.md
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  createMemberstackAdminClient,
  describeSecretKeyEnvironment,
  MEMBERSTACK_ADMIN_BASE_URL,
  summarizeFetchCause,
} from "../../netlify/functions/lib/memberstack-admin.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const IMPORT_DIR = path.join(REPO_ROOT, "tmp", "memberstack-import");
const OUTPUT_DIR = path.join(IMPORT_DIR, "output");

const EXISTING_CSV = path.join(OUTPUT_DIR, "monthly-members-existing-memberstack.csv");
const NEW_CSV = path.join(OUTPUT_DIR, "monthly-members-new-memberstack.csv");
const REVIEW_CSV = path.join(OUTPUT_DIR, "monthly-members-manual-review.csv");
const FULL_IMPORT_CSV = path.join(OUTPUT_DIR, "memberstack-monthly-import.csv");

const PREMIUM_PLAN_ID = "pln_kin-membership-annual-premium-tn5b0cxj";
const PREMIUM_MONTHLY_PRICE_ID = "prc_monthly-subscription-to-knititnow-webw0nzy";
/** Memberstack Admin API rejects passwords shorter than 8 characters. */
const MIN_PASSWORD_LENGTH = 8;

const EXPECTED = { existing: 46, neu: 285, review: 20 };

const IMPORT_HEADERS = [
  "Member ID",
  "Email",
  "Password",
  "Member Metadata",
  "Member JSON",
  "Member Login Redirect",
  "Member Stripe Customer ID",
  "Member Stripe Subscription ID",
  "Member Hashed Password",
  "Free Plans",
  "first-name",
  "last-name",
  "birthday",
  "date-joined",
  "legacyMemberID",
];

const LOG_HEADERS = [
  "action",
  "cohort",
  "email",
  "legacyMemberID",
  "memberstackMemberId",
  "stripeCustomerId",
  "stripeSubscriptionId",
  "hadLegacyMemberID",
  "hadPremiumPlan",
  "existingPlanIds",
  "notes",
];

// ---------------------------------------------------------------------------
// Env / CSV helpers
// ---------------------------------------------------------------------------

function loadEnv() {
  const envPath = path.join(REPO_ROOT, ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

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
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      fields.push(cur);
      cur = "";
    } else cur += c;
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

function readCsvFile(filePath) {
  const buf = fs.readFileSync(filePath);
  const text =
    buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf
      ? buf.slice(3).toString("utf8")
      : buf.toString("utf8");
  const raw = splitCsvRows(text);
  if (!raw.length) return [];
  const headers = parseCsvLine(raw[0]).map((h) => h.trim());
  const rows = [];
  for (let i = 1; i < raw.length; i++) {
    if (!raw[i].trim()) continue;
    const fields = parseCsvLine(raw[i]);
    if (fields.length !== headers.length) {
      throw new Error(
        `${path.basename(filePath)} row ${i + 1}: expected ${headers.length} cols, got ${fields.length}`,
      );
    }
    const obj = {};
    for (let c = 0; c < headers.length; c++) obj[headers[c]] = fields[c] ?? "";
    rows.push(obj);
  }
  return rows;
}

function escapeCsvField(value) {
  const s = value == null ? "" : String(value);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function writeCsv(filePath, headers, rows) {
  const lines = [headers.map(escapeCsvField).join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escapeCsvField(row[h] ?? "")).join(","));
  }
  fs.writeFileSync(filePath, lines.join("\n") + "\n", "utf8");
}

function normEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normId(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function cleanField(value) {
  let s = String(value ?? "").replace(/\r/g, "").trim();
  if (!s || /^null$/i.test(s)) return "";
  return s;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function planIds(member) {
  return (member?.planConnections || [])
    .map((p) => p?.planId || p?.plan)
    .filter(Boolean)
    .map(String);
}

function hasActivePremium(member) {
  const connections = member?.planConnections || [];
  return connections.some((p) => {
    const id = String(p?.planId || p?.plan || "");
    if (id !== PREMIUM_PLAN_ID) return false;
    const status = String(p?.status || "").toUpperCase();
    const active = p?.active;
    if (active === false) return false;
    if (status && status !== "ACTIVE") return false;
    return true;
  });
}

function currentLegacyMemberID(member) {
  const cf = member?.customFields || {};
  return cleanField(cf.legacyMemberID || cf.legacyMemberId || "");
}

function printHelp() {
  console.log(`Monthly Memberstack migration (46 update + 285 create; skip 20 review).

Usage:
  node scripts/memberstack/run-monthly-migration.mjs
  node scripts/memberstack/run-monthly-migration.mjs --dry-run
  node scripts/memberstack/run-monthly-migration.mjs --preflight-only
  node scripts/memberstack/run-monthly-migration.mjs --execute --i-understand-this-writes-to-memberstack
  node scripts/memberstack/run-monthly-migration.mjs --verify
  node scripts/memberstack/run-monthly-migration.mjs --help

Default is dry-run: GET-only against LIVE Memberstack (no writes). Docs:
scripts/memberstack/MONTHLY_MIGRATION.md

If TLS fails with UNABLE_TO_VERIFY_LEAF_SIGNATURE on this machine:
  set MEMBERSTACK_TLS_INSECURE=1
  then re-run (PowerShell: $env:MEMBERSTACK_TLS_INSECURE="1")

After --execute, upload tmp/memberstack-import/output/memberstack-stripe-attach.csv
in Memberstack Import Members to sync KIN Membership - Premium (plan
pln_kin-membership-annual-premium-tn5b0cxj) via Stripe. Free Plans stay blank
so existing Beta/DAK connections are preserved.`);
}

function parseArgs(argv) {
  const args = new Set(argv.slice(2));
  if (args.has("--help") || args.has("-h")) {
    return {
      help: true,
      execute: false,
      verify: false,
      preflightOnly: false,
      confirmed: false,
      dryRun: true,
      mode: "help",
    };
  }
  const execute = args.has("--execute");
  const verify = args.has("--verify");
  const preflightOnly = args.has("--preflight-only");
  const confirmed = args.has("--i-understand-this-writes-to-memberstack");
  return {
    help: false,
    execute,
    verify,
    preflightOnly,
    confirmed,
    dryRun: execute || verify ? false : true,
    mode: execute
      ? "execute"
      : verify
        ? "verify"
        : preflightOnly
          ? "preflight-only"
          : "dry-run",
  };
}

function envFlagEnabled(name) {
  const v = String(process.env[name] ?? "")
    .trim()
    .toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/**
 * Opt-in local workaround for SSL-inspection / incomplete cert chains.
 * Never enabled by default. Does not print secret values.
 */
function applyLocalTlsInsecureIfRequested() {
  const allowInsecure =
    envFlagEnabled("MEMBERSTACK_TLS_INSECURE") ||
    process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0";
  if (!allowInsecure) return { applied: false };
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  console.warn(
    "[TLS] Certificate verification disabled for this process (MEMBERSTACK_TLS_INSECURE / NODE_TLS_REJECT_UNAUTHORIZED=0). Use only on trusted local networks.",
  );
  return { applied: true };
}

/** Presence report for required env vars  never prints secret values. */
function describeEnvPresence() {
  const secret = (process.env.MEMBERSTACK_SECRET_KEY || "").trim();
  const keyEnv = describeSecretKeyEnvironment();
  return {
    MEMBERSTACK_SECRET_KEY: secret
      ? `present (${keyEnv.mode}, ${secret.length} chars, hint ${keyEnv.keyHint})`
      : "MISSING",
    MEMBERSTACK_TLS_INSECURE: process.env.MEMBERSTACK_TLS_INSECURE
      ? `present (value=${envFlagEnabled("MEMBERSTACK_TLS_INSECURE") ? "enabled" : "set-but-not-truthy"})`
      : "not set",
    NODE_TLS_REJECT_UNAUTHORIZED: process.env.NODE_TLS_REJECT_UNAUTHORIZED
      ? `present (value=${process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0" ? "0/insecure" : "set"})`
      : "not set",
    MEMBERSTACK_ADMIN_BASE_URL,
  };
}

/**
 * Read-only preflight: required files, env presence, one harmless listMembers GET.
 * Stops the run before cohort processing when it fails.
 */
async function runPreflight(client) {
  const errors = [];
  const requiredFiles = [EXISTING_CSV, NEW_CSV, REVIEW_CSV, FULL_IMPORT_CSV];
  for (const filePath of requiredFiles) {
    if (!fs.existsSync(filePath)) {
      errors.push(`missing file: ${path.relative(REPO_ROOT, filePath)}`);
    }
  }

  const envPresence = describeEnvPresence();
  if (envPresence.MEMBERSTACK_SECRET_KEY === "MISSING") {
    errors.push("MEMBERSTACK_SECRET_KEY is missing after loading .env");
  }

  console.log("[preflight] environment:", JSON.stringify(envPresence, null, 2));
  console.log(
    "[preflight] Note: dry-run/verify/preflight call LIVE Memberstack Admin API (GET only).",
  );

  if (errors.length) {
    return { ok: false, errors, envPresence, api: null };
  }

  try {
    const page = await client.listMembers({ limit: 1, order: "ASC" });
    const total = page?.totalCount;
    const sampleId =
      Array.isArray(page?.data) && page.data[0] && typeof page.data[0] === "object"
        ? /** @type {any} */ (page.data[0]).id || null
        : null;
    console.log(
      `[preflight] Memberstack GET ${MEMBERSTACK_ADMIN_BASE_URL}/members?limit=1 OK` +
        ` (totalCount=${total ?? "?"}, sampleId=${sampleId ?? "none"})`,
    );
    return {
      ok: true,
      errors: [],
      envPresence,
      api: { totalCount: total ?? null, sampleId },
    };
  } catch (err) {
    const cause = summarizeFetchCause(err);
    const endpoint = /** @type {any} */ (err).endpoint || `GET ${MEMBERSTACK_ADMIN_BASE_URL}/members`;
    const httpStatus = /** @type {any} */ (err).httpStatus;
    const responseBody = /** @type {any} */ (err).responseBody;
    const msg = [
      `Memberstack preflight read failed: ${endpoint}`,
      httpStatus != null ? `HTTP ${httpStatus}` : "no HTTP response",
      responseBody ? `body: ${responseBody}` : null,
      `cause: ${cause}`,
      cause.includes("UNABLE_TO_VERIFY_LEAF_SIGNATURE")
        ? "Hint: set MEMBERSTACK_TLS_INSECURE=1 and re-run (local SSL inspection / incomplete cert chain)."
        : null,
    ]
      .filter(Boolean)
      .join(" | ");
    errors.push(msg);
    return { ok: false, errors, envPresence, api: null };
  }
}

// ---------------------------------------------------------------------------
// Load worksets
// ---------------------------------------------------------------------------

function loadWorksets() {
  for (const p of [EXISTING_CSV, NEW_CSV, REVIEW_CSV, FULL_IMPORT_CSV]) {
    if (!fs.existsSync(p)) {
      throw new Error(`Missing required input: ${path.relative(REPO_ROOT, p)}`);
    }
  }

  const existing = readCsvFile(EXISTING_CSV);
  const neu = readCsvFile(NEW_CSV);
  const review = readCsvFile(REVIEW_CSV);
  const full = readCsvFile(FULL_IMPORT_CSV);

  if (existing.length !== EXPECTED.existing) {
    throw new Error(`Expected ${EXPECTED.existing} existing rows, found ${existing.length}`);
  }
  if (neu.length !== EXPECTED.neu) {
    throw new Error(`Expected ${EXPECTED.neu} new rows, found ${neu.length}`);
  }
  if (review.length !== EXPECTED.review) {
    throw new Error(`Expected ${EXPECTED.review} review rows, found ${review.length}`);
  }

  const fullByLegacy = new Map();
  for (const row of full) {
    const key = normId(row.legacyMemberID);
    if (key) fullByLegacy.set(key, row);
  }

  const reviewLegacy = new Set(review.map((r) => normId(r.legacyMemberID)).filter(Boolean));
  const reviewEmails = new Set(
    review
      .flatMap((r) => [r.Email, r.stripeCustomerEmail, r.memberstackEmail])
      .map(normEmail)
      .filter(Boolean),
  );

  // Guard: new/existing must not include review records
  for (const row of neu) {
    if (reviewLegacy.has(normId(row.legacyMemberID)) || reviewEmails.has(normEmail(row.Email))) {
      throw new Error(`New-member CSV incorrectly includes review email ${row.Email}`);
    }
  }
  for (const row of existing) {
    if (
      reviewLegacy.has(normId(row.legacyMemberID)) ||
      reviewEmails.has(normEmail(row.candidateLegacyEmail))
    ) {
      throw new Error(
        `Existing CSV incorrectly includes review member ${row.candidateLegacyEmail}`,
      );
    }
  }

  return { existing, neu, review, fullByLegacy };
}

function importRowFromNew(row) {
  return {
    "Member ID": "",
    Email: cleanField(row.Email),
    Password: row.Password ?? "",
    "Member Metadata": "",
    "Member JSON": "",
    "Member Login Redirect": "",
    "Member Stripe Customer ID": cleanField(row["Member Stripe Customer ID"]),
    "Member Stripe Subscription ID": cleanField(row["Member Stripe Subscription ID"]),
    "Member Hashed Password": "",
    "Free Plans": "",
    "first-name": cleanField(row["first-name"]),
    "last-name": cleanField(row["last-name"]),
    birthday: cleanField(row.birthday),
    "date-joined": cleanField(row["date-joined"]),
    legacyMemberID: cleanField(row.legacyMemberID),
  };
}

function importRowForExisting(existingRow, fullRow, memberId) {
  return {
    "Member ID": memberId || cleanField(existingRow.memberstackMemberId),
    Email: cleanField(existingRow.memberstackEmail || existingRow.candidateLegacyEmail),
    Password: "",
    "Member Metadata": "",
    "Member JSON": "",
    "Member Login Redirect": "",
    "Member Stripe Customer ID": cleanField(existingRow.stripeCustomerId),
    "Member Stripe Subscription ID": cleanField(existingRow.stripeSubscriptionId),
    "Member Hashed Password": "",
    "Free Plans": "",
    "first-name": cleanField(fullRow?.["first-name"]),
    "last-name": cleanField(fullRow?.["last-name"]),
    birthday: cleanField(fullRow?.birthday),
    "date-joined": cleanField(fullRow?.["date-joined"]),
    legacyMemberID: cleanField(existingRow.legacyMemberID),
  };
}

function logRow(partial) {
  const row = {};
  for (const h of LOG_HEADERS) row[h] = partial[h] ?? "";
  return row;
}

// ---------------------------------------------------------------------------
// Migration steps
// ---------------------------------------------------------------------------

async function processReview(review, logs) {
  for (const row of review) {
    logs.skipped.push(
      logRow({
        action: "skipped_manual_review",
        cohort: "manual_review",
        email: cleanField(row.Email || row.stripeCustomerEmail || row.memberstackEmail),
        legacyMemberID: cleanField(row.legacyMemberID),
        memberstackMemberId: cleanField(row.memberstackMemberId),
        stripeCustomerId: cleanField(row["Member Stripe Customer ID"]),
        stripeSubscriptionId: cleanField(row["Member Stripe Subscription ID"]),
        notes: cleanField(row.reason || row.recommendedImportTreatment),
      }),
    );
  }
}

async function processExisting({ existing, fullByLegacy, client, execute, logs, stripeAttachRows }) {
  for (const row of existing) {
    const memberId = cleanField(row.memberstackMemberId);
    const email = cleanField(row.memberstackEmail || row.candidateLegacyEmail);
    const legacyId = cleanField(row.legacyMemberID);
    const fullRow = fullByLegacy.get(normId(legacyId));
    const stripeCustomerId = cleanField(row.stripeCustomerId);
    const stripeSubscriptionId = cleanField(row.stripeSubscriptionId);

    try {
      if (!memberId) {
        logs.skipped.push(
          logRow({
            action: "skipped_missing_memberstack_id",
            cohort: "existing",
            email,
            legacyMemberID: legacyId,
            stripeCustomerId,
            stripeSubscriptionId,
            notes: "existing cohort row missing memberstackMemberId",
          }),
        );
        continue;
      }

      const member = await client.getMember(memberId);
      await sleep(45);

      if (!member) {
        logs.skipped.push(
          logRow({
            action: "skipped_member_not_found",
            cohort: "existing",
            email,
            legacyMemberID: legacyId,
            memberstackMemberId: memberId,
            stripeCustomerId,
            stripeSubscriptionId,
            notes: "GET member returned null",
          }),
        );
        continue;
      }

      const plans = planIds(member);
      const hadLegacy = Boolean(currentLegacyMemberID(member));
      const hadPremium = hasActivePremium(member);
      const notes = [];

      if (!hadLegacy && legacyId) {
        if (execute) {
          await client.updateMember(memberId, {
            customFields: { legacyMemberID: legacyId },
          });
          await sleep(45);
          notes.push("patched_legacyMemberID");
        } else {
          notes.push("would_patch_legacyMemberID");
        }
      } else if (hadLegacy) {
        notes.push("legacyMemberID_already_set");
      }

      if (hadPremium) {
        notes.push("premium_already_active_skip_stripe_attach");
      } else {
        stripeAttachRows.push(importRowForExisting(row, fullRow, memberId));
        notes.push(execute ? "stripe_attach_csv_queued" : "would_queue_stripe_attach_csv");
      }

      // Existing plans are never removed by this migration.
      notes.push(`preserved_plans=${plans.length}`);

      logs.updated.push(
        logRow({
          action: execute ? "updated_existing" : "would_update_existing",
          cohort: "existing",
          email: member.auth?.email || email,
          legacyMemberID: legacyId,
          memberstackMemberId: memberId,
          stripeCustomerId,
          stripeSubscriptionId,
          hadLegacyMemberID: hadLegacy ? "yes" : "no",
          hadPremiumPlan: hadPremium ? "yes" : "no",
          existingPlanIds: plans.join(" | "),
          notes: notes.join("; "),
        }),
      );
    } catch (err) {
      const cause = summarizeFetchCause(err);
      logs.skipped.push(
        logRow({
          action: "skipped_row_error",
          cohort: "existing",
          email,
          legacyMemberID: legacyId,
          memberstackMemberId: memberId,
          stripeCustomerId,
          stripeSubscriptionId,
          notes: `error=${err?.message || cause}; continued_batch`,
        }),
      );
      console.error(
        `[processExisting] ${memberId || email || "(unknown)"} failed; continuing. ${err?.message || cause}`,
      );
    }
  }
}

async function processNew({ neu, client, execute, logs, stripeAttachRows }) {
  for (let rowIndex = 0; rowIndex < neu.length; rowIndex++) {
    const row = neu[rowIndex];
    const email = cleanField(row.Email);
    const legacyId = cleanField(row.legacyMemberID);
    const password = row.Password ?? "";
    const passwordLength = String(password).length;
    const customFields = {
      "first-name": cleanField(row["first-name"]),
      "last-name": cleanField(row["last-name"]),
      birthday: cleanField(row.birthday),
      "date-joined": cleanField(row["date-joined"]),
      legacyMemberID: legacyId,
    };
    const stripeCustomerId = cleanField(row["Member Stripe Customer ID"]);
    const stripeSubscriptionId = cleanField(row["Member Stripe Subscription ID"]);

    try {
      if (!email) {
        logs.skipped.push(
          logRow({
            action: "skipped_missing_email",
            cohort: "new",
            email,
            legacyMemberID: legacyId,
            stripeCustomerId,
            stripeSubscriptionId,
            notes: `row=${rowIndex + 1}; missing_email`,
          }),
        );
        continue;
      }

      // Lookup must use lowercase  Memberstack stores emails lowercased and GET is case-sensitive.
      const { member: existing } = await getMemberByEmailNormalized(client, email);
      await sleep(45);
      if (email !== normEmail(email)) await sleep(45);

      if (existing?.id) {
        const memberId = String(existing.id);
        const plans = planIds(existing);
        const hadLegacy = Boolean(currentLegacyMemberID(existing));
        const hadPremium = hasActivePremium(existing);
        const notes = ["idempotent_email_exists_no_duplicate_create"];

        if (!hadLegacy && legacyId) {
          if (execute) {
            await client.updateMember(memberId, {
              customFields: { legacyMemberID: legacyId },
            });
            await sleep(45);
            notes.push("patched_legacyMemberID");
          } else {
            notes.push("would_patch_legacyMemberID");
          }
        } else if (hadLegacy) {
          notes.push("legacyMemberID_already_set");
        }

        if (!hadPremium) {
          const attach = importRowFromNew(row);
          attach["Member ID"] = memberId;
          attach.Password = "";
          stripeAttachRows.push(attach);
          notes.push(execute ? "stripe_attach_csv_queued" : "would_queue_stripe_attach_csv");
        } else {
          notes.push("premium_already_active_skip_stripe_attach");
        }

        logs.updated.push(
          logRow({
            action: execute
              ? "updated_existing_from_new_cohort"
              : "would_update_existing_from_new_cohort",
            cohort: "new",
            email,
            legacyMemberID: legacyId,
            memberstackMemberId: memberId,
            stripeCustomerId,
            stripeSubscriptionId,
            hadLegacyMemberID: hadLegacy ? "yes" : "no",
            hadPremiumPlan: hadPremium ? "yes" : "no",
            existingPlanIds: plans.join(" | "),
            notes: notes.join("; "),
          }),
        );
        continue;
      }

      // Validate password BEFORE any create write.
      if (passwordLength < MIN_PASSWORD_LENGTH) {
        logs.skipped.push(
          logRow({
            action: "skipped_password_too_short",
            cohort: "new",
            email,
            legacyMemberID: legacyId,
            stripeCustomerId,
            stripeSubscriptionId,
            notes: `row=${rowIndex + 1}; passwordLength=${passwordLength}; minRequired=${MIN_PASSWORD_LENGTH}; manual_review_required`,
          }),
        );
        continue;
      }

      let memberId = "";
      const notes = [`passwordLength=${passwordLength}`];

      if (execute) {
        const created = await client.createMember({
          email,
          password,
          customFields,
        });
        await sleep(45);
        memberId = String(created.id || "");
        notes.push("created_member_via_admin_api");
        // Ensure legacyMemberID stuck (create may omit unknown/empty custom fields).
        if (legacyId && memberId) {
          await client.updateMember(memberId, {
            customFields: { legacyMemberID: legacyId },
          });
          await sleep(45);
          notes.push("patched_legacyMemberID_after_create");
        }
      } else {
        notes.push("would_create_member_via_admin_api");
      }

      const attach = importRowFromNew(row);
      if (memberId) attach["Member ID"] = memberId;
      stripeAttachRows.push(attach);
      notes.push(execute ? "stripe_attach_csv_queued" : "would_queue_stripe_attach_csv");

      logs.created.push(
        logRow({
          action: execute ? "created_member" : "would_create_member",
          cohort: "new",
          email,
          legacyMemberID: legacyId,
          memberstackMemberId: memberId,
          stripeCustomerId,
          stripeSubscriptionId,
          hadLegacyMemberID: "no",
          hadPremiumPlan: "no",
          existingPlanIds: "",
          notes: notes.join("; "),
        }),
      );
    } catch (err) {
      const cause = summarizeFetchCause(err);
      const endpoint = /** @type {any} */ (err).endpoint || "";
      const httpStatus = /** @type {any} */ (err).httpStatus;
      logs.skipped.push(
        logRow({
          action: "skipped_row_error",
          cohort: "new",
          email,
          legacyMemberID: legacyId,
          stripeCustomerId,
          stripeSubscriptionId,
          notes: [
            `row=${rowIndex + 1}`,
            endpoint ? `endpoint=${endpoint}` : null,
            httpStatus != null ? `http=${httpStatus}` : null,
            `error=${err?.message || cause}`,
            "continued_batch",
          ]
            .filter(Boolean)
            .join("; "),
        }),
      );
      console.error(
        `[processNew] row ${rowIndex + 1} ${email || "(no-email)"} failed; continuing. ${err?.message || cause}`,
      );
    }
  }
}

/**
 * Resolve a member by email with lowercase-normalized lookup.
 * Memberstack stores auth.email lowercased; GET /members/:email is case-sensitive,
 * so mixed-case CSV emails must be looked up via normEmail().
 */
async function getMemberByEmailNormalized(client, email) {
  const raw = cleanField(email);
  if (!raw) return { member: null, lookupEmail: "", matchedVia: "none" };
  const lower = normEmail(raw);
  const member = await client.getMember(lower);
  if (member?.id) {
    return {
      member,
      lookupEmail: lower,
      matchedVia: raw === lower ? "exact_lower" : "normalized_lower",
    };
  }
  // Fallback: try original casing (rare if store is always lower).
  if (raw !== lower) {
    const exact = await client.getMember(raw);
    if (exact?.id) {
      return { member: exact, lookupEmail: raw, matchedVia: "exact_original_case" };
    }
  }
  return { member: null, lookupEmail: lower, matchedVia: "not_found" };
}

function loadExecutionLogIndex() {
  const createdPath = path.join(OUTPUT_DIR, "created-members.csv");
  const updatedPath = path.join(OUTPUT_DIR, "updated-members.csv");
  const skippedPath = path.join(OUTPUT_DIR, "skipped-members.csv");
  const byEmail = new Map();
  for (const filePath of [createdPath, updatedPath, skippedPath]) {
    if (!fs.existsSync(filePath)) continue;
    for (const row of readCsvFile(filePath)) {
      const key = normEmail(row.email);
      if (!key) continue;
      // Prefer the newest/most specific action if duplicates appear.
      byEmail.set(key, {
        action: row.action || "",
        memberstackMemberId: row.memberstackMemberId || "",
        notes: row.notes || "",
        sourceFile: path.basename(filePath),
      });
    }
  }
  return byEmail;
}

function loadStripeAttachEmailSet() {
  const p = path.join(OUTPUT_DIR, "memberstack-stripe-attach.csv");
  const set = new Set();
  if (!fs.existsSync(p)) return set;
  for (const row of readCsvFile(p)) {
    const key = normEmail(row.Email);
    if (key) set.add(key);
  }
  return set;
}

/** Betty Mac duplicate-email case from the new cohort (index 10). */
function isBettyDuplicateEmail(email) {
  return normEmail(email) === "bettymac@comcast.net";
}

async function verifyState({ existing, neu, client }) {
  const execLog = loadExecutionLogIndex();
  const stripeEmails = loadStripeAttachEmailSet();
  const MISSING_DISPLAY_LIMIT = 25;

  const report = {
    existingChecked: 0,
    existingWithLegacy: 0,
    existingWithPremium: 0,
    newChecked: 0,
    newFound: 0,
    newWithLegacy: 0,
    newWithPremium: 0,
    newFoundViaCaseNormalization: 0,
    expectedAbsentShortPassword: 0,
    expectedAbsentShortPasswordFoundUnexpectedly: 0,
    betty: null,
    unexpectedMissing: [],
    expectedAbsent: [],
    missingNewDisplay: [],
    missingNewDisplayTruncated: false,
    missingNewDisplayLimit: MISSING_DISPLAY_LIMIT,
    missingNewTotal: 0,
    arithmetic: {},
    ok: true,
  };

  for (const row of existing) {
    const m = await client.getMember(cleanField(row.memberstackMemberId));
    await sleep(45);
    report.existingChecked++;
    if (!m) continue;
    if (currentLegacyMemberID(m)) report.existingWithLegacy++;
    if (hasActivePremium(m)) report.existingWithPremium++;
  }

  for (let i = 0; i < neu.length; i++) {
    const row = neu[i];
    const emailRaw = cleanField(row.Email);
    const emailNorm = normEmail(emailRaw);
    const passwordLength = String(row.Password ?? "").length;
    const shortPassword = passwordLength < MIN_PASSWORD_LENGTH;
    const betty = isBettyDuplicateEmail(emailRaw);
    const log = execLog.get(emailNorm) || null;

    const { member, matchedVia } = await getMemberByEmailNormalized(client, emailRaw);
    await sleep(45);
    // Extra sleep only when we also tried original case inside helper  helper may do 12 GETs.
    if (emailRaw !== emailNorm) await sleep(45);

    report.newChecked++;

    if (matchedVia === "normalized_lower") report.newFoundViaCaseNormalization++;

    if (member?.id) {
      report.newFound++;
      if (currentLegacyMemberID(member)) report.newWithLegacy++;
      if (hasActivePremium(member)) report.newWithPremium++;

      if (betty) {
        report.betty = {
          classification: "existing_duplicate_or_prior_create",
          email: emailRaw,
          normalizedEmail: emailNorm,
          memberstackMemberId: member.id,
          storedEmail: member.auth?.email || null,
          matchedVia,
          hasLegacyMemberID: Boolean(currentLegacyMemberID(member)),
          executionLog: log,
          inStripeAttachCsv: stripeEmails.has(emailNorm),
        };
      }
      if (shortPassword) {
        report.expectedAbsentShortPasswordFoundUnexpectedly++;
      }
      continue;
    }

    // Not found
    report.missingNewTotal++;
    const detail = {
      index: i + 1,
      email: emailRaw,
      normalizedEmail: emailNorm,
      passwordLength,
      cohortReason: betty
        ? "betty_duplicate_email_expected_existing"
        : shortPassword
          ? "expected_absent_short_password"
          : "unexpected_missing_safe_create",
      executionLogAction: log?.action || "(no log row)",
      executionLogNotes: log?.notes || "",
      postSucceeded: Boolean(
        log &&
          (log.action === "created_member" ||
            String(log.notes || "").includes("created_member_via_admin_api")),
      ),
      foundByNormalizedEmail: false,
      inStripeAttachCsv: stripeEmails.has(emailNorm),
    };

    if (betty) {
      // Betty was expected to exist; not found even with normalization is unexpected.
      detail.cohortReason = "betty_expected_existing_but_not_found";
      report.betty = detail;
      report.unexpectedMissing.push(detail);
    } else if (shortPassword) {
      report.expectedAbsentShortPassword++;
      report.expectedAbsent.push(detail);
    } else {
      report.unexpectedMissing.push(detail);
    }

    if (report.missingNewDisplay.length < MISSING_DISPLAY_LIMIT) {
      report.missingNewDisplay.push(
        `${emailRaw} [${detail.cohortReason}]`,
      );
    } else {
      report.missingNewDisplayTruncated = true;
    }
  }

  // Backward-compatible alias used by older summary formatting.
  report.missingNew = report.missingNewDisplay;

  const notFound = report.newChecked - report.newFound;
  const sumParts =
    report.newFound +
    report.expectedAbsentShortPassword +
    report.unexpectedMissing.length;
  report.arithmetic = {
    newChecked: report.newChecked,
    newFound: report.newFound,
    notFound,
    expectedAbsentShortPassword: report.expectedAbsentShortPassword,
    unexpectedMissing: report.unexpectedMissing.length,
    bettyFound: Boolean(report.betty?.memberstackMemberId),
    formula: "newChecked === newFound + expectedAbsentShortPassword + unexpectedMissing",
    sumParts,
    reconcile: sumParts === report.newChecked,
    note: "Betty is included in newFound when present. Short-password absences are expectedAbsent, not unexpectedMissing. missingNewDisplay may be truncated.",
  };

  // Betty found counts in newFound; short-password absences are expected; only unexpectedMissing fails.
  report.ok =
    report.unexpectedMissing.length === 0 &&
    report.expectedAbsentShortPasswordFoundUnexpectedly === 0 &&
    Boolean(report.betty?.memberstackMemberId);

  return report;
}

function writeSummary({
  mode,
  existingCount,
  newCount,
  reviewCount,
  logs,
  stripeAttachPath,
  updateImportPath,
  createImportPath,
  verifyReport,
}) {
  const lines = [
    `# Monthly Memberstack migration summary`,
    ``,
    `- Generated: ${new Date().toISOString()}`,
    `- Mode: **${mode}**`,
    `- Target Premium plan: \`${PREMIUM_PLAN_ID}\``,
    `- Target Premium monthly price: \`${PREMIUM_MONTHLY_PRICE_ID}\``,
    ``,
    `## Input cohorts`,
    ``,
    `| Cohort | Count |`,
    `|---|---:|`,
    `| Existing updates | ${existingCount} |`,
    `| New creates | ${newCount} |`,
    `| Manual review (skipped) | ${reviewCount} |`,
    ``,
    `## Actions this run`,
    ``,
    `| Log | Rows |`,
    `|---|---:|`,
    `| updated-members.csv | ${logs.updated.length} |`,
    `| created-members.csv | ${logs.created.length} |`,
    `| skipped-members.csv | ${logs.skipped.length} |`,
    ``,
    `## Idempotency`,
    ``,
    `- Existing members are loaded by Memberstack member ID; plans are never removed.`,
    `- \`legacyMemberID\` is patched only when missing (shallow customFields merge).`,
    `- New creates first GET-by-email; if the member already exists, the script updates instead of creating a duplicate.`,
    `- Premium is not added via \`add-plan\` (paid plan). Stripe Customer + Subscription IDs are queued for Memberstack CSV import; re-import of the same subscription should not create a second membership.`,
    ``,
    `## Stripe / Premium attach artifacts`,
    ``,
    `- Update-shaped import (46, Member ID filled): \`${path.relative(REPO_ROOT, updateImportPath)}\``,
    `- Create-shaped import (285, Member ID blank): \`${path.relative(REPO_ROOT, createImportPath)}\``,
    `- Combined Stripe-attach queue: \`${path.relative(REPO_ROOT, stripeAttachPath)}\` (${logs.updated.length + logs.created.length} log rows; CSV may be smaller when Premium already active)`,
    ``,
    `Paid Premium association requires uploading a Stripe-ID CSV in the Memberstack dashboard (Import Members). Admin API cannot assign paid plans.`,
    ``,
    `## Exact commands`,
    ``,
    "```bash",
    `# Dry-run (default) - validate + write logs/CSVs, no Memberstack writes`,
    `node scripts/memberstack/run-monthly-migration.mjs`,
    ``,
    `# Execute API create/update (still requires CSV upload for Premium Stripe sync)`,
    `node scripts/memberstack/run-monthly-migration.mjs --execute --i-understand-this-writes-to-memberstack`,
    ``,
    `# After CSV import: verify Premium + legacyMemberID coverage`,
    `node scripts/memberstack/run-monthly-migration.mjs --verify`,
    "```",
    ``,
  ];

  if (mode === "dry-run") {
    lines.push(
      `## Dry-run note`,
      ``,
      `No Memberstack members were created or updated. Review the log CSVs, then run with \`--execute\` after final approval. Upload the Stripe-attach CSV (or the update/create import CSVs) in Memberstack to connect Premium monthly subscriptions.`,
      ``,
    );
  }

  if (verifyReport) {
    lines.push(
      `## Verify report`,
      ``,
      `- OK: **${verifyReport.ok ? "yes" : "NO"}**`,
      `- Existing checked: ${verifyReport.existingChecked} (legacyMemberID ${verifyReport.existingWithLegacy}, Premium ${verifyReport.existingWithPremium})`,
      `- New checked: ${verifyReport.newChecked}`,
      `- New found (case-normalized GET): ${verifyReport.newFound} (legacyMemberID ${verifyReport.newWithLegacy}, Premium ${verifyReport.newWithPremium})`,
      `- Found only after lowercasing email: ${verifyReport.newFoundViaCaseNormalization ?? 0}`,
      `- Expected absent (short password): ${verifyReport.expectedAbsentShortPassword ?? 0}`,
      `- Unexpected missing: ${(verifyReport.unexpectedMissing || []).length}`,
      `- Betty: ${
        verifyReport.betty?.memberstackMemberId
          ? `found ${verifyReport.betty.memberstackMemberId} (${verifyReport.betty.classification || "existing"})`
          : "NOT FOUND"
      }`,
      `- Not-found total: ${verifyReport.missingNewTotal ?? 0}` +
        (verifyReport.missingNewDisplayTruncated
          ? ` (display truncated to first ${verifyReport.missingNewDisplayLimit}; full list in verify-report.json)`
          : ""),
      ``,
    );
    if ((verifyReport.missingNewDisplay || []).length) {
      lines.push(`Display list: ${verifyReport.missingNewDisplay.join(", ")}`, ``);
    }
    if ((verifyReport.unexpectedMissing || []).length) {
      lines.push(
        `### Unexpected missing`,
        ``,
        ...(verifyReport.unexpectedMissing || []).map(
          (u) =>
            `- ${u.email} | ${u.cohortReason} | log=${u.executionLogAction} | stripeCsv=${u.inStripeAttachCsv}`,
        ),
        ``,
      );
    }
  }

  const out = path.join(OUTPUT_DIR, "migration-summary.md");
  fs.writeFileSync(out, lines.join("\n"), "utf8");
  return out;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const opts = parseArgs(process.argv);
  if (opts.help) {
    printHelp();
    return;
  }
  if (opts.execute && !opts.confirmed) {
    console.error(
      "Refusing to execute: pass --i-understand-this-writes-to-memberstack with --execute.",
    );
    process.exit(1);
  }

  loadEnv();
  applyLocalTlsInsecureIfRequested();

  const secret = (process.env.MEMBERSTACK_SECRET_KEY || "").trim();
  if (!secret) {
    console.error("[preflight] environment:", JSON.stringify(describeEnvPresence(), null, 2));
    throw new Error("MEMBERSTACK_SECRET_KEY is required in .env");
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const client = createMemberstackAdminClient({ secretKey: secret });

  console.log(`Mode: ${opts.mode}`);
  const preflight = await runPreflight(client);
  if (!preflight.ok) {
    console.error("[preflight] FAILED - stopping before cohort processing.");
    for (const e of preflight.errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log("[preflight] OK");

  if (opts.preflightOnly) {
    console.log(
      JSON.stringify(
        {
          mode: "preflight-only",
          memberstackWrites: false,
          api: preflight.api,
        },
        null,
        2,
      ),
    );
    return;
  }

  const { existing, neu, review, fullByLegacy } = loadWorksets();
  const logs = { updated: [], created: [], skipped: [] };
  const stripeAttachRows = [];

  console.log(
    `Cohorts: existing=${existing.length}, new=${neu.length}, review=${review.length}`,
  );

  await processReview(review, logs);

  if (opts.verify) {
    const verifyReport = await verifyState({ existing, neu, client });
    const updateImportPath = path.join(OUTPUT_DIR, "memberstack-import-existing-updates.csv");
    const createImportPath = path.join(OUTPUT_DIR, "memberstack-import-new-members.csv");
    const stripeAttachPath = path.join(OUTPUT_DIR, "memberstack-stripe-attach.csv");
    const verifyReportPath = path.join(OUTPUT_DIR, "verify-report.json");
    // Do not clobber execution skipped-members.csv  verify only refreshes summary + verify-report.
    fs.writeFileSync(verifyReportPath, JSON.stringify(verifyReport, null, 2), "utf8");
    const summaryPath = writeSummary({
      mode: "verify",
      existingCount: existing.length,
      newCount: neu.length,
      reviewCount: review.length,
      logs: {
        updated: fs.existsSync(path.join(OUTPUT_DIR, "updated-members.csv"))
          ? readCsvFile(path.join(OUTPUT_DIR, "updated-members.csv"))
          : [],
        created: fs.existsSync(path.join(OUTPUT_DIR, "created-members.csv"))
          ? readCsvFile(path.join(OUTPUT_DIR, "created-members.csv"))
          : [],
        skipped: fs.existsSync(path.join(OUTPUT_DIR, "skipped-members.csv"))
          ? readCsvFile(path.join(OUTPUT_DIR, "skipped-members.csv"))
          : logs.skipped,
      },
      stripeAttachPath,
      updateImportPath,
      createImportPath,
      verifyReport,
    });
    console.log(
      JSON.stringify(
        {
          ok: verifyReport.ok,
          existingChecked: verifyReport.existingChecked,
          existingWithLegacy: verifyReport.existingWithLegacy,
          newChecked: verifyReport.newChecked,
          newFound: verifyReport.newFound,
          newWithLegacy: verifyReport.newWithLegacy,
          newFoundViaCaseNormalization: verifyReport.newFoundViaCaseNormalization,
          expectedAbsentShortPassword: verifyReport.expectedAbsentShortPassword,
          unexpectedMissingCount: verifyReport.unexpectedMissing.length,
          betty: verifyReport.betty,
          missingNewTotal: verifyReport.missingNewTotal,
          missingNewDisplayTruncated: verifyReport.missingNewDisplayTruncated,
          missingNewDisplay: verifyReport.missingNewDisplay,
          arithmetic: verifyReport.arithmetic,
          unexpectedMissing: verifyReport.unexpectedMissing,
        },
        null,
        2,
      ),
    );
    console.log(`Wrote ${path.relative(REPO_ROOT, summaryPath)}`);
    console.log(`Wrote ${path.relative(REPO_ROOT, verifyReportPath)}`);
    if (!verifyReport.ok) {
      console.error("[verify] FAILED  unexpected missing members or Betty not found.");
      process.exit(1);
    }
    console.log("[verify] OK");
    return;
  }

  const updateImportPath = path.join(OUTPUT_DIR, "memberstack-import-existing-updates.csv");
  const createImportPath = path.join(OUTPUT_DIR, "memberstack-import-new-members.csv");
  const stripeAttachPath = path.join(OUTPUT_DIR, "memberstack-stripe-attach.csv");

  try {
    await processExisting({
      existing,
      fullByLegacy,
      client,
      execute: opts.execute,
      logs,
      stripeAttachRows,
    });

    await processNew({
      neu,
      client,
      execute: opts.execute,
      logs,
      stripeAttachRows,
    });
  } finally {
    // Always persist logs even if a future unexpected error escapes row handlers.
    const updateImportRows = existing.map((row) => {
      const fullRow = fullByLegacy.get(normId(row.legacyMemberID));
      return importRowForExisting(row, fullRow, cleanField(row.memberstackMemberId));
    });
    const createImportRows = neu.map(importRowFromNew);

    writeCsv(updateImportPath, IMPORT_HEADERS, updateImportRows);
    writeCsv(createImportPath, IMPORT_HEADERS, createImportRows);
    writeCsv(stripeAttachPath, IMPORT_HEADERS, stripeAttachRows);
    writeCsv(path.join(OUTPUT_DIR, "updated-members.csv"), LOG_HEADERS, logs.updated);
    writeCsv(path.join(OUTPUT_DIR, "created-members.csv"), LOG_HEADERS, logs.created);
    writeCsv(path.join(OUTPUT_DIR, "skipped-members.csv"), LOG_HEADERS, logs.skipped);

    writeSummary({
      mode: opts.mode,
      existingCount: existing.length,
      newCount: neu.length,
      reviewCount: review.length,
      logs,
      stripeAttachPath,
      updateImportPath,
      createImportPath,
      verifyReport: null,
    });
  }

  console.log(
    JSON.stringify(
      {
        mode: opts.mode,
        updatedLogRows: logs.updated.length,
        createdLogRows: logs.created.length,
        skippedLogRows: logs.skipped.length,
        skippedPasswordTooShort: logs.skipped.filter((r) => r.action === "skipped_password_too_short")
          .length,
        stripeAttachCsvRows: stripeAttachRows.length,
        summary: path.relative(REPO_ROOT, path.join(OUTPUT_DIR, "migration-summary.md")).replace(
          /\\/g,
          "/",
        ),
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  const endpoint = err?.endpoint;
  const httpStatus = err?.httpStatus;
  const responseBody = err?.responseBody;
  const cause = summarizeFetchCause(err);
  console.error(err?.stack || String(err));
  if (endpoint || httpStatus != null || cause !== "(no cause details)") {
    console.error(
      JSON.stringify(
        {
          endpoint: endpoint || null,
          httpStatus: httpStatus ?? null,
          responseBody: responseBody || null,
          fetchCause: cause,
          envPresence: describeEnvPresence(),
        },
        null,
        2,
      ),
    );
  }
  process.exit(1);
});

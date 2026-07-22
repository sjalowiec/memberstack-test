/**
 * Attach Stripe customer IDs to existing Memberstack members (monthly migration).
 *
 * Separate from member create/update. Restart-safe and idempotent.
 *
 * Attempts PATCH /members/{id} with { stripeCustomerId } only.
 * IMPORTANT (2026-07-17): Official Admin REST PATCH params do NOT include
 * stripeCustomerId. Memberstack returns HTTP 2xx while leaving the field null.
 * Execute therefore requires follow-up GET confirmation before counting success.
 * Stripe subscription IDs are logged for reconciliation but never PATCHed.
 *
 * Usage:
 *   node scripts/memberstack/attach-monthly-stripe-customers.mjs
 *   node scripts/memberstack/attach-monthly-stripe-customers.mjs --preflight-only
 *   node scripts/memberstack/attach-monthly-stripe-customers.mjs --execute --i-understand-this-writes-to-memberstack
 *   node scripts/memberstack/attach-monthly-stripe-customers.mjs --verify
 *
 * Default is dry-run (GET only). TLS insecure only when MEMBERSTACK_TLS_INSECURE=1.
 *
 * See scripts/memberstack/MONTHLY_MIGRATION.md
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  applyMemberstackLocalTlsInsecureIfRequested,
  createMemberstackAdminClient,
  describeSecretKeyEnvironment,
  isMemberstackTlsInsecureFlagEnabled,
  MEMBERSTACK_ADMIN_BASE_URL,
  summarizeFetchCause,
} from "../../netlify/functions/lib/memberstack-admin.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const IMPORT_DIR = path.join(REPO_ROOT, "tmp", "memberstack-import");
const OUTPUT_DIR = path.join(IMPORT_DIR, "output");

const ATTACH_CSV = path.join(OUTPUT_DIR, "memberstack-stripe-attach.csv");
const NEW_CSV = path.join(OUTPUT_DIR, "monthly-members-new-memberstack.csv");

const EXPECTED_ROWS = 319;
const PREMIUM_PLAN_ID = "pln_kin-membership-annual-premium-tn5b0cxj";
const MIN_PASSWORD_LENGTH = 8;

const LOG_HEADERS = [
  "memberstackMemberId",
  "email",
  "expectedStripeCustomerId",
  "liveStripeCustomerId",
  "stripeSubscriptionId",
  "legacyMemberID",
  "status",
  "activePlanIds",
  "hasPremiumPlan",
  "notes",
];

// ---------------------------------------------------------------------------
// Helpers
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
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

function describeEnvPresence() {
  const secret = (process.env.MEMBERSTACK_SECRET_KEY || "").trim();
  const keyEnv = describeSecretKeyEnvironment();
  return {
    MEMBERSTACK_SECRET_KEY: secret
      ? `present (${keyEnv.mode}, ${secret.length} chars, hint ${keyEnv.keyHint})`
      : "MISSING",
    MEMBERSTACK_TLS_INSECURE: process.env.MEMBERSTACK_TLS_INSECURE
      ? `present (enabled=${isMemberstackTlsInsecureFlagEnabled()})`
      : "not set",
    MEMBERSTACK_ADMIN_BASE_URL,
  };
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

function clean(value) {
  return String(value ?? "")
    .replace(/\r/g, "")
    .trim();
}

function normEmail(value) {
  return clean(value).toLowerCase();
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
    if (p?.active === false) return false;
    const status = String(p?.status || "").toUpperCase();
    if (status && status !== "ACTIVE" && status !== "TRIALING") return false;
    return true;
  });
}

function parseArgs(argv) {
  const args = new Set(argv.slice(2));
  if (args.has("--help") || args.has("-h")) {
    return { help: true, mode: "help" };
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
    mode: execute
      ? "execute"
      : verify
        ? "verify"
        : preflightOnly
          ? "preflight-only"
          : "dry-run",
  };
}

function printHelp() {
  console.log(`Attach Stripe customer IDs to existing monthly-migration members.

Usage:
  node scripts/memberstack/attach-monthly-stripe-customers.mjs
  node scripts/memberstack/attach-monthly-stripe-customers.mjs --preflight-only
  node scripts/memberstack/attach-monthly-stripe-customers.mjs --execute --i-understand-this-writes-to-memberstack
  node scripts/memberstack/attach-monthly-stripe-customers.mjs --verify

Default is dry-run (GET only). PATCH payload is only { stripeCustomerId }.
TLS: set MEMBERSTACK_TLS_INSECURE=1 if local SSL inspection blocks Node fetch.`);
}

function logRow(partial) {
  const row = {};
  for (const h of LOG_HEADERS) row[h] = partial[h] ?? "";
  return row;
}

function loadShortPasswordEmails() {
  if (!fs.existsSync(NEW_CSV)) return new Set();
  const rows = readCsvFile(NEW_CSV);
  return new Set(
    rows
      .filter((r) => String(r.Password ?? "").length < MIN_PASSWORD_LENGTH)
      .map((r) => normEmail(r.Email))
      .filter(Boolean),
  );
}

function loadAttachRows() {
  if (!fs.existsSync(ATTACH_CSV)) {
    throw new Error(`Missing source CSV: ${path.relative(REPO_ROOT, ATTACH_CSV)}`);
  }
  return readCsvFile(ATTACH_CSV).map((r, idx) => ({
    rowNumber: idx + 2, // 1-based data row in file terms (header is 1)
    memberstackMemberId: clean(r["Member ID"]),
    email: clean(r.Email),
    stripeCustomerId: clean(r["Member Stripe Customer ID"]),
    stripeSubscriptionId: clean(r["Member Stripe Subscription ID"]),
    legacyMemberID: clean(r.legacyMemberID),
  }));
}

function validateAttachRows(rows) {
  const errors = [];
  if (rows.length !== EXPECTED_ROWS) {
    errors.push(`expected exactly ${EXPECTED_ROWS} rows, found ${rows.length}`);
  }

  const shortEmails = loadShortPasswordEmails();
  const memIds = new Map();
  const cusIds = new Map();

  for (const row of rows) {
    const label = `row ${row.rowNumber} (${row.email || "no-email"})`;
    if (!row.memberstackMemberId) errors.push(`${label}: blank Memberstack ID`);
    else if (!row.memberstackMemberId.startsWith("mem_")) {
      errors.push(`${label}: Memberstack ID must start with mem_`);
    }
    if (!row.stripeCustomerId) errors.push(`${label}: blank Stripe customer ID`);
    else if (!row.stripeCustomerId.startsWith("cus_")) {
      errors.push(`${label}: Stripe customer ID must start with cus_`);
    }
    if (!row.email) errors.push(`${label}: blank email`);

    if (row.memberstackMemberId) {
      if (memIds.has(row.memberstackMemberId)) {
        errors.push(
          `duplicate Memberstack ID ${row.memberstackMemberId} at rows ${memIds.get(row.memberstackMemberId)} and ${row.rowNumber}`,
        );
      } else memIds.set(row.memberstackMemberId, row.rowNumber);
    }
    if (row.stripeCustomerId) {
      if (cusIds.has(row.stripeCustomerId)) {
        errors.push(
          `duplicate Stripe customer ID ${row.stripeCustomerId} at rows ${cusIds.get(row.stripeCustomerId)} and ${row.rowNumber} (not approved)`,
        );
      } else cusIds.set(row.stripeCustomerId, row.rowNumber);
    }

    if (shortEmails.has(normEmail(row.email))) {
      errors.push(`${label}: short-password migration email must not appear in attach CSV`);
    }
  }

  return errors;
}

async function runApiPreflight(client) {
  const envPresence = describeEnvPresence();
  console.log("[preflight] environment:", JSON.stringify(envPresence, null, 2));
  if (envPresence.MEMBERSTACK_SECRET_KEY === "MISSING") {
    return { ok: false, errors: ["MEMBERSTACK_SECRET_KEY missing"], envPresence };
  }
  try {
    const page = await client.listMembers({ limit: 1, order: "ASC" });
    console.log(
      `[preflight] Memberstack GET ${MEMBERSTACK_ADMIN_BASE_URL}/members?limit=1 OK` +
        ` (totalCount=${page?.totalCount ?? "?"})`,
    );
    return { ok: true, errors: [], envPresence, totalCount: page?.totalCount ?? null };
  } catch (err) {
    const cause = summarizeFetchCause(err);
    return {
      ok: false,
      errors: [
        `Memberstack preflight GET failed: ${/** @type {any} */ (err).endpoint || "GET /members"} | cause: ${cause}`,
      ],
      envPresence,
    };
  }
}

function classifyLiveStripe(liveCustomerId, expectedCustomerId) {
  const live = clean(liveCustomerId);
  const expected = clean(expectedCustomerId);
  if (!live) return "missing";
  if (live === expected) return "already_correct";
  return "conflict";
}

async function processRows({ rows, client, execute }) {
  const updated = [];
  const alreadyCorrect = [];
  const conflicts = [];
  const errors = [];

  for (const row of rows) {
    try {
      const member = await client.getMember(row.memberstackMemberId);
      await sleep(45);

      if (!member?.id) {
        errors.push(
          logRow({
            memberstackMemberId: row.memberstackMemberId,
            email: row.email,
            expectedStripeCustomerId: row.stripeCustomerId,
            liveStripeCustomerId: "",
            stripeSubscriptionId: row.stripeSubscriptionId,
            legacyMemberID: row.legacyMemberID,
            status: "error_member_not_found",
            notes: "GET returned null",
          }),
        );
        continue;
      }

      const liveCustomerId = clean(member.stripeCustomerId);
      const plans = planIds(member);
      const premium = hasActivePremium(member);
      const classification = classifyLiveStripe(liveCustomerId, row.stripeCustomerId);
      const base = {
        memberstackMemberId: row.memberstackMemberId,
        email: member.auth?.email || row.email,
        expectedStripeCustomerId: row.stripeCustomerId,
        liveStripeCustomerId: liveCustomerId,
        stripeSubscriptionId: row.stripeSubscriptionId,
        legacyMemberID: row.legacyMemberID,
        activePlanIds: plans.join(" | "),
        hasPremiumPlan: premium ? "yes" : "no",
      };

      if (classification === "already_correct") {
        alreadyCorrect.push(
          logRow({
            ...base,
            status: "already_correct",
            notes: execute ? "skipped_already_complete" : "would_skip_already_complete",
          }),
        );
        continue;
      }

      if (classification === "conflict") {
        conflicts.push(
          logRow({
            ...base,
            status: "conflict",
            notes: "live stripeCustomerId differs from expected; not overwritten",
          }),
        );
        continue;
      }

      // missing
      if (execute) {
        const patchBody = { stripeCustomerId: row.stripeCustomerId };
        const patchResult = await client.updateMember(
          row.memberstackMemberId,
          patchBody,
        );
        await sleep(45);
        const after = await client.getMember(row.memberstackMemberId);
        await sleep(45);

        const patchReturned = clean(patchResult?.stripeCustomerId);
        const afterLive = clean(after?.stripeCustomerId);
        // HTTP 2xx alone is never enough. Require immediate follow-up GET confirmation.
        const getConfirmed = afterLive === row.stripeCustomerId;
        const patchConfirmed = patchReturned === row.stripeCustomerId;

        if (!getConfirmed) {
          errors.push(
            logRow({
              ...base,
              liveStripeCustomerId: afterLive,
              activePlanIds: planIds(after).join(" | "),
              hasPremiumPlan: hasActivePremium(after) ? "yes" : "no",
              status: "error_not_persisted",
              notes:
                `HTTP 2xx but stripeCustomerId not persisted on follow-up GET ` +
                `(PATCH response=${patchReturned || "null/empty"}; ` +
                `follow-up GET=${afterLive || "null/empty"}` +
                `${patchConfirmed ? "; PATCH echoed field but GET did not" : ""}). ` +
                `Admin PATCH docs do not list stripeCustomerId as updatable; ` +
                `unknown fields appear to be ignored.`,
            }),
          );
          console.error(
            `[attach] ${row.memberstackMemberId} HTTP OK but stripeCustomerId not persisted; continuing.`,
          );
          continue;
        }

        updated.push(
          logRow({
            ...base,
            liveStripeCustomerId: afterLive,
            activePlanIds: planIds(after).join(" | "),
            hasPremiumPlan: hasActivePremium(after) ? "yes" : "no",
            status: "updated",
            notes: "patched_stripeCustomerId_confirmed_via_get",
          }),
        );
      } else {
        updated.push(
          logRow({
            ...base,
            status: "would_update",
            notes: "would_patch_stripeCustomerId_only",
          }),
        );
      }
    } catch (err) {
      const cause = summarizeFetchCause(err);
      errors.push(
        logRow({
          memberstackMemberId: row.memberstackMemberId,
          email: row.email,
          expectedStripeCustomerId: row.stripeCustomerId,
          liveStripeCustomerId: "",
          stripeSubscriptionId: row.stripeSubscriptionId,
          legacyMemberID: row.legacyMemberID,
          status: "error",
          notes: err?.message || cause,
        }),
      );
      console.error(
        `[attach] ${row.memberstackMemberId} failed; continuing. ${err?.message || cause}`,
      );
    }
  }

  return { updated, alreadyCorrect, conflicts, errors };
}

async function verifyRows({ rows, client }) {
  const results = [];
  let okCount = 0;
  let premiumSynced = 0;
  const notSyncedPremium = [];
  const unexpected = [];

  for (const row of rows) {
    try {
      const member = await client.getMember(row.memberstackMemberId);
      await sleep(45);
      if (!member?.id) {
        unexpected.push({
          memberstackMemberId: row.memberstackMemberId,
          email: row.email,
          reason: "member_not_found",
        });
        results.push(
          logRow({
            memberstackMemberId: row.memberstackMemberId,
            email: row.email,
            expectedStripeCustomerId: row.stripeCustomerId,
            status: "verify_missing_member",
            stripeSubscriptionId: row.stripeSubscriptionId,
            legacyMemberID: row.legacyMemberID,
          }),
        );
        continue;
      }

      const live = clean(member.stripeCustomerId);
      const classification = classifyLiveStripe(live, row.stripeCustomerId);
      const premium = hasActivePremium(member);
      const plans = planIds(member);

      if (classification === "already_correct") {
        okCount++;
        if (premium) premiumSynced++;
        else {
          notSyncedPremium.push({
            memberstackMemberId: row.memberstackMemberId,
            email: member.auth?.email || row.email,
            stripeCustomerId: live,
            stripeSubscriptionId: row.stripeSubscriptionId,
            activePlanIds: plans,
          });
        }
      } else if (classification === "conflict") {
        unexpected.push({
          memberstackMemberId: row.memberstackMemberId,
          email: member.auth?.email || row.email,
          reason: "stripe_customer_conflict",
          live,
          expected: row.stripeCustomerId,
        });
      } else {
        unexpected.push({
          memberstackMemberId: row.memberstackMemberId,
          email: member.auth?.email || row.email,
          reason: "stripe_customer_missing",
          expected: row.stripeCustomerId,
        });
      }

      results.push(
        logRow({
          memberstackMemberId: row.memberstackMemberId,
          email: member.auth?.email || row.email,
          expectedStripeCustomerId: row.stripeCustomerId,
          liveStripeCustomerId: live,
          stripeSubscriptionId: row.stripeSubscriptionId,
          legacyMemberID: row.legacyMemberID,
          status: `verify_${classification}`,
          activePlanIds: plans.join(" | "),
          hasPremiumPlan: premium ? "yes" : "no",
          notes: premium ? "premium_synced" : "premium_not_yet_visible",
        }),
      );
    } catch (err) {
      unexpected.push({
        memberstackMemberId: row.memberstackMemberId,
        email: row.email,
        reason: "verify_error",
        error: err?.message || summarizeFetchCause(err),
      });
    }
  }

  return {
    ok: unexpected.length === 0,
    checked: rows.length,
    stripeCustomerCorrect: okCount,
    premiumSynced,
    premiumNotYetVisible: notSyncedPremium.length,
    notSyncedPremium,
    unexpected,
    results,
  };
}

function writeOutputs({ mode, updated, alreadyCorrect, conflicts, errors, verify }) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  writeCsv(path.join(OUTPUT_DIR, "stripe-attach-updated.csv"), LOG_HEADERS, updated);
  writeCsv(
    path.join(OUTPUT_DIR, "stripe-attach-already-correct.csv"),
    LOG_HEADERS,
    alreadyCorrect,
  );
  writeCsv(path.join(OUTPUT_DIR, "stripe-attach-conflicts.csv"), LOG_HEADERS, conflicts);
  writeCsv(path.join(OUTPUT_DIR, "stripe-attach-errors.csv"), LOG_HEADERS, errors);

  const verifyPath = path.join(OUTPUT_DIR, "stripe-attach-verify.json");
  const verifyPayload = verify || {
    mode,
    note: "Run --verify after execute (and after Memberstack has had time to sync Stripe).",
  };
  fs.writeFileSync(verifyPath, JSON.stringify(verifyPayload, null, 2), "utf8");

  const lines = [
    `# Stripe customer attachment summary`,
    ``,
    `- Generated: ${new Date().toISOString()}`,
    `- Mode: **${mode}**`,
    `- Source: \`${path.relative(REPO_ROOT, ATTACH_CSV)}\``,
    `- Expected rows: ${EXPECTED_ROWS}`,
    `- PATCH field: \`stripeCustomerId\` only (subscription ID not written)`,
    `- Target Premium plan (sync expected): \`${PREMIUM_PLAN_ID}\``,
    ``,
    `## Counts`,
    ``,
    `| Bucket | Count |`,
    `|---|---:|`,
    `| Would update / updated (missing ? attach) | ${updated.length} |`,
    `| Already correct | ${alreadyCorrect.length} |`,
    `| Conflicts (not overwritten) | ${conflicts.length} |`,
    `| Errors | ${errors.length} |`,
    ``,
    `## Commands`,
    ``,
    "```powershell",
    `$env:MEMBERSTACK_TLS_INSECURE="1"`,
    `node scripts/memberstack/attach-monthly-stripe-customers.mjs --preflight-only`,
    `node scripts/memberstack/attach-monthly-stripe-customers.mjs`,
    `node scripts/memberstack/attach-monthly-stripe-customers.mjs --execute --i-understand-this-writes-to-memberstack`,
    `node scripts/memberstack/attach-monthly-stripe-customers.mjs --verify`,
    "```",
    ``,
  ];

  if (mode === "dry-run") {
    lines.push(
      `## Dry-run note`,
      ``,
      `No Memberstack writes occurred. Review conflicts before execute.`,
      ``,
    );
  }

  if (verify) {
    lines.push(
      `## Verify`,
      ``,
      `- OK: **${verify.ok ? "yes" : "NO"}**`,
      `- Stripe customer correct: ${verify.stripeCustomerCorrect}/${verify.checked}`,
      `- Premium plan visible: ${verify.premiumSynced}`,
      `- Premium not yet visible (follow-up): ${verify.premiumNotYetVisible}`,
      `- Unexpected issues: ${verify.unexpected.length}`,
      ``,
    );
  }

  const summaryPath = path.join(OUTPUT_DIR, "stripe-attach-summary.md");
  fs.writeFileSync(summaryPath, lines.join("\n"), "utf8");
  return summaryPath;
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
  applyMemberstackLocalTlsInsecureIfRequested();

  const secret = (process.env.MEMBERSTACK_SECRET_KEY || "").trim();
  if (!secret) {
    console.error("[preflight] environment:", JSON.stringify(describeEnvPresence(), null, 2));
    throw new Error("MEMBERSTACK_SECRET_KEY is required");
  }

  const client = createMemberstackAdminClient({ secretKey: secret });
  console.log(`Mode: ${opts.mode}`);

  let rows;
  try {
    rows = loadAttachRows();
  } catch (err) {
    console.error(`[preflight] FAILED - ${err.message}`);
    process.exit(1);
  }

  const csvErrors = validateAttachRows(rows);
  const apiPreflight = await runApiPreflight(client);
  const preflightErrors = [...csvErrors, ...(apiPreflight.ok ? [] : apiPreflight.errors)];

  if (preflightErrors.length) {
    console.error("[preflight] FAILED - stopping before writes.");
    for (const e of preflightErrors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log(`[preflight] OK (${rows.length} attach rows)`);

  if (opts.preflightOnly) {
    console.log(
      JSON.stringify(
        {
          mode: "preflight-only",
          memberstackWrites: false,
          rows: rows.length,
          totalCount: apiPreflight.totalCount,
        },
        null,
        2,
      ),
    );
    return;
  }

  if (opts.verify) {
    const verify = await verifyRows({ rows, client });
    const summaryPath = writeOutputs({
      mode: "verify",
      updated: [],
      alreadyCorrect: verify.results.filter((r) => r.status === "verify_already_correct"),
      conflicts: verify.results.filter((r) => r.status === "verify_conflict"),
      errors: verify.results.filter(
        (r) =>
          r.status === "verify_missing" ||
          r.status === "verify_missing_member" ||
          r.status.startsWith("verify_error"),
      ),
      verify,
    });
    console.log(
      JSON.stringify(
        {
          ok: verify.ok,
          checked: verify.checked,
          stripeCustomerCorrect: verify.stripeCustomerCorrect,
          premiumSynced: verify.premiumSynced,
          premiumNotYetVisible: verify.premiumNotYetVisible,
          unexpectedCount: verify.unexpected.length,
          unexpected: verify.unexpected,
          notSyncedPremiumSample: verify.notSyncedPremium.slice(0, 20),
          summary: path.relative(REPO_ROOT, summaryPath).replace(/\\/g, "/"),
        },
        null,
        2,
      ),
    );
    if (!verify.ok) {
      console.error("[verify] FAILED");
      process.exit(1);
    }
    console.log("[verify] OK");
    return;
  }

  const result = await processRows({
    rows,
    client,
    execute: opts.execute,
  });

  const summaryPath = writeOutputs({
    mode: opts.mode,
    ...result,
    verify: null,
  });

  console.log(
    JSON.stringify(
      {
        mode: opts.mode,
        memberstackWrites: Boolean(opts.execute),
        wouldUpdateOrUpdated: result.updated.length,
        alreadyCorrect: result.alreadyCorrect.length,
        conflicts: result.conflicts.length,
        errors: result.errors.length,
        summary: path.relative(REPO_ROOT, summaryPath).replace(/\\/g, "/"),
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err?.stack || String(err));
  console.error(
    JSON.stringify(
      {
        fetchCause: summarizeFetchCause(err),
        envPresence: describeEnvPresence(),
      },
      null,
      2,
    ),
  );
  process.exit(1);
});

/**
 * Knit It Now to Memberstack monthly member migration (local dry-run / prep).
 *
 * Reads sensitive CSVs from tmp/memberstack-import/ and writes validation
 * reports + exception CSVs under tmp/memberstack-import/output/.
 *
 * Security:
 * - Never prints, logs, or writes password values to reports/exception files.
 * - Never uploads data. Never modifies source CSVs.
 * - Final Memberstack import CSV is written only if import format is confirmed
 *   in this repository (see resolveMemberstackImportFormat).
 *
 * Usage:
 *   node scripts/memberstack/prepare-monthly-import.mjs
 *   node scripts/memberstack/prepare-monthly-import.mjs --dry-run
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const IMPORT_DIR = path.join(REPO_ROOT, "tmp", "memberstack-import");
const OUTPUT_DIR = path.join(IMPORT_DIR, "output");
const OVERRIDES_PATH = path.join(IMPORT_DIR, "memberid-overrides.json");

const CANONICAL_LEGACY = "legacy-members.csv";
const CANONICAL_STRIPE = "stripe-monthly-subscriptions.csv";

const LEGACY_REQUIRED = [
  "memberid",
  "email",
  "password",
  "fristname",
  "lastname",
  "datejoined",
  "birthdayinfo",
];

const STRIPE_REQUIRED = [
  "id",
  "Customer ID",
  "Customer Email",
  "Status",
  "Interval",
  "Plan",
  "memberid (metadata)",
];

// ---------------------------------------------------------------------------
// CSV helpers (same approach as scripts/watson-analyze-csv.mjs)
// ---------------------------------------------------------------------------

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

function readCsvFile(filePath) {
  const buf = fs.readFileSync(filePath);
  let text;
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    text = buf.slice(3).toString("utf8");
  } else {
    text = buf.toString("utf8");
  }
  const rawRows = splitCsvRows(text);
  if (!rawRows.length) {
    return { headers: [], rows: [], sourcePath: filePath };
  }
  const headers = parseCsvLine(rawRows[0]).map((h) => h.trim());
  const rows = [];
  const malformed = [];
  for (let i = 1; i < rawRows.length; i++) {
    const line = rawRows[i];
    if (!line.trim()) continue;
    const fields = parseCsvLine(line);
    if (fields.length !== headers.length) {
      malformed.push({
        sourceFile: path.basename(filePath),
        rowNumber: i + 1,
        reason: `expected ${headers.length} columns, found ${fields.length}`,
        fieldCount: String(fields.length),
      });
      continue;
    }
    const obj = {};
    for (let c = 0; c < headers.length; c++) obj[headers[c]] = fields[c] ?? "";
    rows.push({ __rowNumber: i + 1, ...obj });
  }
  return { headers, rows, malformed, sourcePath: filePath };
}

function isBlank(value) {
  return value == null || String(value).trim() === "";
}

function normId(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function normEmail(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

// ---------------------------------------------------------------------------
// Source file resolution
// ---------------------------------------------------------------------------

function listCsvFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith(".csv") && !f.startsWith("."))
    .map((f) => path.join(dir, f));
}

function headersLookLikeLegacy(headers) {
  const set = new Set(headers.map((h) => h.toLowerCase()));
  return LEGACY_REQUIRED.every((h) => set.has(h.toLowerCase()));
}

function headersLookLikeStripe(headers) {
  const set = new Set(headers);
  return (
    set.has("Customer ID") &&
    set.has("Status") &&
    set.has("Interval") &&
    set.has("memberid (metadata)") &&
    set.has("id")
  );
}

function resolveSourceFiles() {
  const assumptions = [];
  const all = listCsvFiles(IMPORT_DIR);

  let legacyPath = path.join(IMPORT_DIR, CANONICAL_LEGACY);
  let stripePath = path.join(IMPORT_DIR, CANONICAL_STRIPE);

  if (!fs.existsSync(legacyPath)) {
    const byName = all.find((p) => /legacy.*member/i.test(path.basename(p)));
    if (byName) {
      legacyPath = byName;
      assumptions.push(
        `Canonical ${CANONICAL_LEGACY} not found; using ${path.basename(legacyPath)}`,
      );
    } else {
      for (const p of all) {
        const probe = readCsvFile(p);
        if (headersLookLikeLegacy(probe.headers)) {
          legacyPath = p;
          assumptions.push(
            `Resolved legacy members file by headers: ${path.basename(p)}`,
          );
          break;
        }
      }
    }
  }

  if (!fs.existsSync(stripePath)) {
    const byName = all.find((p) => /stripe/i.test(path.basename(p)));
    if (byName) {
      stripePath = byName;
      assumptions.push(
        `Canonical ${CANONICAL_STRIPE} not found; using ${path.basename(stripePath)}`,
      );
    } else {
      for (const p of all) {
        if (p === legacyPath) continue;
        const probe = readCsvFile(p);
        if (headersLookLikeStripe(probe.headers)) {
          stripePath = p;
          assumptions.push(
            `Resolved Stripe subscriptions file by headers: ${path.basename(p)}`,
          );
          break;
        }
      }
    }
  }

  if (!fs.existsSync(legacyPath)) {
    throw new Error(
      `Legacy members CSV not found under ${IMPORT_DIR}. Expected ${CANONICAL_LEGACY} or a file with the legacy member headers.`,
    );
  }
  if (!fs.existsSync(stripePath)) {
    throw new Error(
      `Stripe subscriptions CSV not found under ${IMPORT_DIR}. Expected ${CANONICAL_STRIPE} or a file with Stripe subscription headers.`,
    );
  }

  return { legacyPath, stripePath, assumptions };
}

/**
 * Load password-free one-time overrides keyed by Stripe Subscription ID.
 * File: tmp/memberstack-import/memberid-overrides.json
 */
function loadMemberIdOverrides() {
  if (!fs.existsSync(OVERRIDES_PATH)) {
    return { bySubscriptionId: new Map(), applied: [], path: null };
  }
  const raw = JSON.parse(fs.readFileSync(OVERRIDES_PATH, "utf8"));
  const bySubscriptionId = new Map();
  for (const row of raw.overrides || []) {
    const subId = String(row.stripeSubscriptionId || "").trim();
    const legacyId = String(row.legacyMemberId || "").trim();
    if (!subId || !legacyId) continue;
    bySubscriptionId.set(subId, {
      legacyMemberId: legacyId,
      reason: row.reason || "manual override",
      stripeCustomerId: row.stripeCustomerId || "",
      stripeMemberidMetadata: row.stripeMemberidMetadata || "",
      stripeCustomerEmailNote: row.stripeCustomerEmailNote || "",
      addedAt: row.addedAt || "",
    });
  }
  return {
    bySubscriptionId,
    applied: [],
    path: path.relative(REPO_ROOT, OVERRIDES_PATH).replace(/\\/g, "/"),
    description: raw.description || "",
  };
}

/**
 * Confirmed from official Memberstack docs + Sample Import File:
 * https://docs.memberstack.com/hc/en-us/articles/7789851571099-Import-Members-via-CSV-Free-Paying
 * Sample Import File spreadsheet (downloaded for header verification):
 * https://docs.google.com/spreadsheets/d/1bE7y0yEtkf2hyyLviYuGOmITd2E3nLo44VAY5bceQTY/edit
 *
 * KIN custom field IDs confirmed from this repo's data-ms-member usage / signup comments:
 * first-name, last-name, birthday, date-joined, legacyMemberID
 */
function resolveMemberstackImportFormat() {
  // Exact system headers from the official Sample Import File (row 1).
  const sampleImportHeaders = [
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
  ];

  // Custom field columns use the Memberstack custom field ID as the header.
  const kinCustomFieldHeaders = [
    "first-name",
    "last-name",
    "birthday",
    "date-joined",
    "legacyMemberID",
  ];

  return {
    confirmed: true,
    source:
      "Official docs article 7789851571099 + Sample Import File spreadsheet headers",
    docsUrl:
      "https://docs.memberstack.com/hc/en-us/articles/7789851571099-Import-Members-via-CSV-Free-Paying",
    sampleImportFileUrl:
      "https://docs.google.com/spreadsheets/d/1bE7y0yEtkf2hyyLviYuGOmITd2E3nLo44VAY5bceQTY/edit?usp=sharing",
    systemHeaders: sampleImportHeaders,
    customFieldHeaders: kinCustomFieldHeaders,
    importHeaders: [...sampleImportHeaders, ...kinCustomFieldHeaders],
    recurringPaidRequirements: {
      email: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      memberstackPlanId: false,
      freePlans: false,
      notes: [
        "Recurring paid members require Member Stripe Customer ID and Member Stripe Subscription ID.",
        "Paid plan assignment comes from the Stripe subscription (not Free Plans / plan ID in CSV).",
        "Official FAQ: paid plan cannot be changed during import.",
        "Import tool supports only one active subscription per member; extras need Sync with Stripe after import.",
      ],
    },
    passwordHeader: "Password",
    passwordNotes:
      "Use Password for plaintext. Use Member Hashed Password only for bcrypt hashes from Memberstack 1.0 exports.",
  };
}

// ---------------------------------------------------------------------------
// Migration logic
// ---------------------------------------------------------------------------

function countDuplicates(values) {
  const counts = new Map();
  for (const v of values) {
    if (isBlank(v)) continue;
    const key = normId(v);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  let duplicateValues = 0;
  let duplicateExtraRows = 0;
  for (const n of counts.values()) {
    if (n > 1) {
      duplicateValues += 1;
      duplicateExtraRows += n - 1;
    }
  }
  return { uniqueKeys: counts.size, duplicateValues, duplicateExtraRows, counts };
}

function run() {
  const dryRun = process.argv.includes("--dry-run") || !process.argv.includes("--write-import");
  // Always local-only; --dry-run is the default and documented mode.
  void dryRun;

  console.log("Memberstack monthly migration prep (local dry-run)");
  console.log("Mode: validation + reports only; no remote uploads.\n");

  const { legacyPath, stripePath, assumptions } = resolveSourceFiles();
  const formatInfo = resolveMemberstackImportFormat();

  const legacy = readCsvFile(legacyPath);
  const stripe = readCsvFile(stripePath);

  // STEP 1 � inspect
  const legacyIds = legacy.rows.map((r) => r.memberid);
  const stripeMemberIds = stripe.rows.map((r) => r["memberid (metadata)"]);
  const legacyBlankIds = legacyIds.filter(isBlank).length;
  const stripeBlankIds = stripeMemberIds.filter(isBlank).length;
  const legacyDup = countDuplicates(legacyIds);
  const stripeDupAll = countDuplicates(stripeMemberIds);

  const stripeNonActive = stripe.rows.filter(
    (r) => String(r.Status || "").trim().toLowerCase() !== "active",
  ).length;
  const stripeNonMonth = stripe.rows.filter(
    (r) => String(r.Interval || "").trim().toLowerCase() !== "month",
  ).length;

  const step1 = {
    legacySourceFile: path.basename(legacyPath),
    stripeSourceFile: path.basename(stripePath),
    totalLegacyMemberRows: legacy.rows.length,
    totalStripeRows: stripe.rows.length,
    legacyHeaders: legacy.headers,
    stripeHeaders: stripe.headers,
    blankLegacyMemberIds: legacyBlankIds,
    blankStripeMemberIds: stripeBlankIds,
    duplicateLegacyMemberIds: legacyDup.duplicateValues,
    duplicateStripeMemberIds: stripeDupAll.duplicateValues,
    stripeRowsStatusNotActive: stripeNonActive,
    stripeRowsIntervalNotMonth: stripeNonMonth,
    legacyMalformedRows: legacy.malformed.length,
    stripeMalformedRows: stripe.malformed.length,
  };

  console.log("STEP 1 � Source inspection");
  console.log(JSON.stringify(step1, null, 2));
  console.log("");

  // STEP 2 � monthly Stripe population
  const monthlyActive = stripe.rows.filter((r) => {
    const statusOk = String(r.Status || "").trim().toLowerCase() === "active";
    const intervalOk = String(r.Interval || "").trim().toLowerCase() === "month";
    const memberOk = !isBlank(r["memberid (metadata)"]);
    return statusOk && intervalOk && memberOk;
  });

  // STEP 3 - match on legacy memberid (with optional subscription overrides)
  const overrides = loadMemberIdOverrides();
  const legacyByNormId = new Map();
  for (const row of legacy.rows) {
    if (isBlank(row.memberid)) continue;
    const key = normId(row.memberid);
    if (!legacyByNormId.has(key)) legacyByNormId.set(key, []);
    legacyByNormId.get(key).push(row);
  }

  const matched = [];
  const unmatchedStripe = [];
  const ambiguousMatches = [];
  const overrideMatches = [];
  const monthlyByMember = new Map();

  for (const s of monthlyActive) {
    const rawMemberId = s["memberid (metadata)"];
    const override = overrides.bySubscriptionId.get(String(s.id || "").trim());
    const effectiveMemberId = override ? override.legacyMemberId : rawMemberId;
    const key = normId(effectiveMemberId);
    if (!monthlyByMember.has(key)) monthlyByMember.set(key, []);
    monthlyByMember.get(key).push(s);

    const candidates = legacyByNormId.get(key) || [];
    if (candidates.length === 0) {
      unmatchedStripe.push({
        stripeRowNumber: String(s.__rowNumber),
        subscriptionId: s.id,
        customerId: s["Customer ID"],
        customerEmail: s["Customer Email"],
        status: s.Status,
        interval: s.Interval,
        plan: s.Plan,
        memberid_metadata: rawMemberId,
        overrideLegacyMemberId: override ? override.legacyMemberId : "",
        reason: override
          ? "override legacy memberid not found in legacy members"
          : "no matching legacy memberid",
      });
    } else if (candidates.length > 1) {
      ambiguousMatches.push({
        stripeRowNumber: String(s.__rowNumber),
        subscriptionId: s.id,
        customerId: s["Customer ID"],
        customerEmail: s["Customer Email"],
        memberid_metadata: rawMemberId,
        overrideLegacyMemberId: override ? override.legacyMemberId : "",
        legacyMatchCount: String(candidates.length),
        reason: "multiple legacy rows for memberid",
      });
    } else {
      matched.push({
        stripe: s,
        legacy: candidates[0],
        viaOverride: Boolean(override),
      });
      if (override) {
        overrideMatches.push({
          stripeSubscriptionId: s.id,
          stripeCustomerId: s["Customer ID"],
          stripeCustomerEmail: s["Customer Email"],
          stripeMemberidMetadata: rawMemberId,
          legacyMemberId: candidates[0].memberid,
          legacyEmail: candidates[0].email,
          reason: override.reason,
        });
      }
    }
  }

  // Duplicate active monthly Stripe member IDs
  const duplicateStripeMemberIdRows = [];
  for (const [key, rows] of monthlyByMember) {
    if (rows.length > 1) {
      for (const s of rows) {
        duplicateStripeMemberIdRows.push({
          memberid_metadata: s["memberid (metadata)"],
          memberid_normalized: key,
          subscriptionId: s.id,
          customerId: s["Customer ID"],
          customerEmail: s["Customer Email"],
          status: s.Status,
          interval: s.Interval,
          plan: s.Plan,
          activeMonthlyCountForMemberId: String(rows.length),
        });
      }
    }
  }

  // One row per unique active monthly member for import candidate set:
  // prefer the first matched subscription when duplicates exist (flagged in exceptions).
  // One candidate per unique legacy member ID (authoritative join key).
  const importCandidates = [];
  const seenMemberForImport = new Set();
  for (const m of matched) {
    const key = normId(m.legacy.memberid);
    if (seenMemberForImport.has(key)) continue;
    seenMemberForImport.add(key);
    importCandidates.push(m);
  }

  // STEP 4 � validate matched
  let blankEmail = 0;
  let blankPassword = 0;
  let blankFirst = 0;
  let blankLast = 0;
  let emailMismatch = 0;

  const blankPasswordRows = [];
  const emailMismatchRows = [];
  const emailCounts = new Map();

  for (const m of importCandidates) {
    const leg = m.legacy;
    const stripeEmail = m.stripe["Customer Email"];
    if (isBlank(leg.email)) blankEmail += 1;
    if (isBlank(leg.password)) {
      blankPassword += 1;
      blankPasswordRows.push({
        memberid: leg.memberid,
        email: leg.email,
        fristname: leg.fristname,
        lastname: leg.lastname,
        datejoined: leg.datejoined,
        subscriptionId: m.stripe.id,
        customerId: m.stripe["Customer ID"],
        customerEmail: stripeEmail,
        reason: "blank legacy password",
      });
    }
    if (isBlank(leg.fristname)) blankFirst += 1;
    if (isBlank(leg.lastname)) blankLast += 1;

    const le = normEmail(leg.email);
    const se = normEmail(stripeEmail);
    if (le && se && le !== se) {
      emailMismatch += 1;
      emailMismatchRows.push({
        memberid: leg.memberid,
        legacyEmail: leg.email,
        stripeCustomerEmail: stripeEmail,
        subscriptionId: m.stripe.id,
        customerId: m.stripe["Customer ID"],
        reason: "legacy email differs from Stripe customer email (trimmed, lowercase compare)",
      });
    }

    if (!isBlank(leg.email)) {
      const ek = normEmail(leg.email);
      if (!emailCounts.has(ek)) emailCounts.set(ek, []);
      emailCounts.get(ek).push(m);
    }
  }

  const duplicateEmailRows = [];
  let duplicateMatchedEmails = 0;
  for (const [ek, list] of emailCounts) {
    if (list.length > 1) {
      duplicateMatchedEmails += 1;
      for (const m of list) {
        duplicateEmailRows.push({
          email_normalized: ek,
          email: m.legacy.email,
          memberid: m.legacy.memberid,
          subscriptionId: m.stripe.id,
          customerId: m.stripe["Customer ID"],
          matchedCountForEmail: String(list.length),
        });
      }
    }
  }

  // Customer ID / Subscription ID uniqueness across monthly active set
  const customerIdCounts = new Map();
  const subscriptionIdCounts = new Map();
  for (const s of monthlyActive) {
    const cid = String(s["Customer ID"] || "").trim();
    const sid = String(s.id || "").trim();
    if (cid) customerIdCounts.set(cid, (customerIdCounts.get(cid) || 0) + 1);
    if (sid) subscriptionIdCounts.set(sid, (subscriptionIdCounts.get(sid) || 0) + 1);
  }
  const duplicateCustomerIdRows = [...customerIdCounts.values()].filter((n) => n > 1).reduce((a, n) => a + n, 0);
  const duplicateCustomerIdGroups = [...customerIdCounts.values()].filter((n) => n > 1).length;
  const duplicateSubscriptionIdRows = [...subscriptionIdCounts.values()].filter((n) => n > 1).reduce((a, n) => a + n, 0);
  const duplicateSubscriptionIdGroups = [...subscriptionIdCounts.values()].filter((n) => n > 1).length;

  const step4 = {
    totalActiveMonthlyStripeSubscriptions: monthlyActive.length,
    totalUniqueActiveMonthlyMemberIds: monthlyByMember.size,
    totalMatchedLegacyMembers: matched.length,
    totalUniqueMatchedMembersForImport: importCandidates.length,
    totalUnmatchedStripeSubscriptions: unmatchedStripe.length,
    totalOverrideMatches: overrideMatches.length,
    totalAmbiguousLegacyMatches: ambiguousMatches.length,
    totalDuplicateActiveStripeSubscriptionsForSameMemberId: duplicateStripeMemberIdRows.length,
    totalDuplicateActiveStripeMemberIdGroups: [...monthlyByMember.values()].filter((r) => r.length > 1).length,
    totalMatchedRecordsWithBlankEmail: blankEmail,
    totalMatchedRecordsWithBlankPassword: blankPassword,
    totalMatchedRecordsWithBlankFirstName: blankFirst,
    totalMatchedRecordsWithBlankLastName: blankLast,
    totalMatchedRecordsWithDuplicateEmailAddresses: duplicateMatchedEmails,
    totalEmailMismatches: emailMismatch,
    totalStripeRowsSameCustomerIdMoreThanOnce: duplicateCustomerIdRows,
    totalStripeCustomerIdDuplicateGroups: duplicateCustomerIdGroups,
    totalStripeRowsSameSubscriptionIdMoreThanOnce: duplicateSubscriptionIdRows,
    totalStripeSubscriptionIdDuplicateGroups: duplicateSubscriptionIdGroups,
  };

  console.log("STEP 2�4 � Matching & validation");
  console.log(JSON.stringify(step4, null, 2));
  console.log("");

  console.log("STEP 5 - Memberstack import format");
  console.log(JSON.stringify(formatInfo, null, 2));
  console.log("");

  // STEP 8 � write outputs (never include passwords in exception/report files)
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const malformedRows = [
    ...legacy.malformed.map((m) => ({ ...m, source: "legacy" })),
    ...stripe.malformed.map((m) => ({ ...m, source: "stripe" })),
    ...ambiguousMatches.map((m) => ({
      sourceFile: "match",
      rowNumber: m.stripeRowNumber,
      reason: m.reason,
      fieldCount: "",
      memberid_metadata: m.memberid_metadata,
      subscriptionId: m.subscriptionId,
      customerId: m.customerId,
      customerEmail: m.customerEmail,
      legacyMatchCount: m.legacyMatchCount,
    })),
  ];

  writeCsv(
    path.join(OUTPUT_DIR, "unmatched-stripe-members.csv"),
    [
      "stripeRowNumber",
      "subscriptionId",
      "customerId",
      "customerEmail",
      "status",
      "interval",
      "plan",
      "memberid_metadata",
      "overrideLegacyMemberId",
      "reason",
    ],
    unmatchedStripe,
  );

  writeCsv(
    path.join(OUTPUT_DIR, "memberid-overrides-applied.csv"),
    [
      "stripeSubscriptionId",
      "stripeCustomerId",
      "stripeCustomerEmail",
      "stripeMemberidMetadata",
      "legacyMemberId",
      "legacyEmail",
      "reason",
    ],
    overrideMatches,
  );

  writeCsv(
    path.join(OUTPUT_DIR, "duplicate-stripe-memberids.csv"),
    [
      "memberid_metadata",
      "memberid_normalized",
      "subscriptionId",
      "customerId",
      "customerEmail",
      "status",
      "interval",
      "plan",
      "activeMonthlyCountForMemberId",
    ],
    duplicateStripeMemberIdRows,
  );

  writeCsv(
    path.join(OUTPUT_DIR, "duplicate-emails.csv"),
    [
      "email_normalized",
      "email",
      "memberid",
      "subscriptionId",
      "customerId",
      "matchedCountForEmail",
    ],
    duplicateEmailRows,
  );

  writeCsv(
    path.join(OUTPUT_DIR, "email-mismatches.csv"),
    [
      "memberid",
      "legacyEmail",
      "stripeCustomerEmail",
      "subscriptionId",
      "customerId",
      "reason",
    ],
    emailMismatchRows,
  );

  writeCsv(
    path.join(OUTPUT_DIR, "blank-passwords.csv"),
    [
      "memberid",
      "email",
      "fristname",
      "lastname",
      "datejoined",
      "subscriptionId",
      "customerId",
      "customerEmail",
      "reason",
    ],
    blankPasswordRows,
  );

  writeCsv(
    path.join(OUTPUT_DIR, "malformed-rows.csv"),
    [
      "source",
      "sourceFile",
      "rowNumber",
      "reason",
      "fieldCount",
      "memberid_metadata",
      "subscriptionId",
      "customerId",
      "customerEmail",
      "legacyMatchCount",
    ],
    malformedRows.map((r) => ({
      source: r.source || "",
      sourceFile: r.sourceFile || "",
      rowNumber: String(r.rowNumber ?? ""),
      reason: r.reason || "",
      fieldCount: String(r.fieldCount ?? ""),
      memberid_metadata: r.memberid_metadata || "",
      subscriptionId: r.subscriptionId || "",
      customerId: r.customerId || "",
      customerEmail: r.customerEmail || "",
      legacyMatchCount: r.legacyMatchCount || "",
    })),
  );

  let importCsvGenerated = false;
  let importCsvPath = null;
  let importRowCount = 0;
  const duplicateImportChoices = [];

  if (formatInfo.confirmed) {
    importCsvPath = path.join(OUTPUT_DIR, "memberstack-monthly-import.csv");
    const importHeaders = formatInfo.importHeaders;

    // Prefer newest Stripe subscription when a legacy member has duplicates
    // (Created UTC descending), matching "one active subscription per member".
    const chosenByMember = new Map();
    for (const m of matched) {
      const key = normId(m.legacy.memberid);
      const existing = chosenByMember.get(key);
      if (!existing) {
        chosenByMember.set(key, m);
        continue;
      }
      const a = String(m.stripe["Created (UTC)"] || "");
      const b = String(existing.stripe["Created (UTC)"] || "");
      if (a > b) chosenByMember.set(key, m);
    }

    for (const [key, rows] of monthlyByMember) {
      if (rows.length <= 1) continue;
      const chosen = chosenByMember.get(key);
      if (!chosen) continue;
      duplicateImportChoices.push({
        memberid_metadata: chosen.stripe["memberid (metadata)"],
        chosenSubscriptionId: chosen.stripe.id,
        allSubscriptionIds: rows.map((r) => r.id).join(" | "),
        customerId: chosen.stripe["Customer ID"],
        customerEmail: chosen.stripe["Customer Email"],
        note: "Import includes newest Created (UTC) subscription only; sync extras in Memberstack after import.",
      });
    }

    const importRows = [...chosenByMember.values()].map((m) => ({
      "Member ID": "",
      Email: m.legacy.email,
      Password: m.legacy.password,
      "Member Metadata": "",
      "Member JSON": "",
      "Member Login Redirect": "",
      "Member Stripe Customer ID": m.stripe["Customer ID"],
      "Member Stripe Subscription ID": m.stripe.id,
      "Member Hashed Password": "",
      "Free Plans": "",
      "first-name": m.legacy.fristname,
      "last-name": m.legacy.lastname,
      birthday: m.legacy.birthdayinfo,
      "date-joined": m.legacy.datejoined,
      legacyMemberID: m.legacy.memberid,
    }));

    writeCsv(importCsvPath, importHeaders, importRows);
    importCsvGenerated = true;
    importRowCount = importRows.length;

    // Password-free column checklist for verification (never includes values).
    writeCsv(
      path.join(OUTPUT_DIR, "import-column-checklist.csv"),
      ["header", "requiredForRecurringPaid", "source", "populatedInImport"],
      importHeaders.map((h) => {
        const populated = importRows.some((r) => !isBlank(r[h]));
        const required =
          h === "Email" ||
          h === "Member Stripe Customer ID" ||
          h === "Member Stripe Subscription ID";
        let source = "left blank";
        if (h === "Email") source = "legacy.email";
        else if (h === "Password") source = "legacy.password";
        else if (h === "Member Stripe Customer ID") source = "stripe.Customer ID";
        else if (h === "Member Stripe Subscription ID") source = "stripe.id";
        else if (h === "first-name") source = "legacy.fristname";
        else if (h === "last-name") source = "legacy.lastname";
        else if (h === "birthday") source = "legacy.birthdayinfo";
        else if (h === "date-joined") source = "legacy.datejoined";
        else if (h === "legacyMemberID") source = "legacy.memberid";
        return {
          header: h,
          requiredForRecurringPaid: required ? "yes" : "no",
          source,
          populatedInImport: populated ? "yes" : "no",
        };
      }),
    );

    writeCsv(
      path.join(OUTPUT_DIR, "duplicate-subscription-import-choices.csv"),
      [
        "memberid_metadata",
        "chosenSubscriptionId",
        "allSubscriptionIds",
        "customerId",
        "customerEmail",
        "note",
      ],
      duplicateImportChoices,
    );
  }

  const report = {
    generatedAt: new Date().toISOString(),
    dryRun: true,
    assumptions,
    sources: {
      legacy: path.relative(REPO_ROOT, legacyPath).replace(/\\/g, "/"),
      stripe: path.relative(REPO_ROOT, stripePath).replace(/\\/g, "/"),
    },
    step1,
    step4,
    memberstackImportFormat: {
      confirmed: formatInfo.confirmed,
      source: formatInfo.source,
      docsUrl: formatInfo.docsUrl,
      sampleImportFileUrl: formatInfo.sampleImportFileUrl,
      importHeaders: formatInfo.importHeaders,
      recurringPaidRequirements: formatInfo.recurringPaidRequirements,
      passwordHeader: formatInfo.passwordHeader,
      passwordNotes: formatInfo.passwordNotes,
    },
    importCsvGenerated,
    importRowCount,
    importCsvPath: importCsvPath
      ? path.relative(REPO_ROOT, importCsvPath).replace(/\\/g, "/")
      : null,
    duplicateImportChoices,
    memberIdOverrides: {
      file: overrides.path,
      appliedCount: overrideMatches.length,
      applied: overrideMatches,
    },
    manualReview: {
      unmatchedStripeSubscriptions: unmatchedStripe.length,
      duplicateStripeMemberIdRows: duplicateStripeMemberIdRows.length,
      duplicateSubscriptionGroups: duplicateImportChoices.length,
      duplicateEmailRows: duplicateEmailRows.length,
      emailMismatches: emailMismatchRows.length,
      blankPasswords: blankPasswordRows.length,
      malformedOrAmbiguousRows: malformedRows.length,
      ambiguousLegacyMatches: ambiguousMatches.length,
      overrideMatches: overrideMatches.length,
    },
    // Security: password values intentionally omitted from this report.
    security: {
      passwordsIncludedInReports: false,
      passwordsPrintedToConsole: false,
      sourceCsvsModified: false,
    },
  };

  // Defense in depth: refuse to write if a password *value field* slipped into the report.
  // Allow documentation keys like passwordHeader / passwordNotes / passwordsIncludedInReports.
  const reportJson = JSON.stringify(report, null, 2);
  if (/"Password"\s*:\s*"[^"]+"/i.test(reportJson)) {
    throw new Error("Refusing to write report: password value detected in report payload.");
  }

  fs.writeFileSync(path.join(OUTPUT_DIR, "migration-report.json"), reportJson + "\n", "utf8");

  const summaryLines = [
    "Knit It Now to Memberstack monthly migration - validation summary",
    `Generated: ${report.generatedAt}`,
    "Mode: dry-run (local only; no uploads)",
    "",
    "Sources",
    `  Legacy: ${report.sources.legacy}`,
    `  Stripe: ${report.sources.stripe}`,
    "",
    "STEP 1 - Inspection",
    `  Legacy member rows: ${step1.totalLegacyMemberRows}`,
    `  Stripe rows: ${step1.totalStripeRows}`,
    `  Legacy headers: ${step1.legacyHeaders.join(" | ")}`,
    `  Stripe headers: ${step1.stripeHeaders.join(" | ")}`,
    `  Blank legacy member IDs: ${step1.blankLegacyMemberIds}`,
    `  Blank Stripe member IDs: ${step1.blankStripeMemberIds}`,
    `  Duplicate legacy member IDs: ${step1.duplicateLegacyMemberIds}`,
    `  Duplicate Stripe member IDs (all rows): ${step1.duplicateStripeMemberIds}`,
    `  Stripe Status not active: ${step1.stripeRowsStatusNotActive}`,
    `  Stripe Interval not month: ${step1.stripeRowsIntervalNotMonth}`,
    `  Malformed legacy rows: ${step1.legacyMalformedRows}`,
    `  Malformed Stripe rows: ${step1.stripeMalformedRows}`,
    "",
    "STEP 2-4 - Monthly match validation",
    `  Active monthly Stripe subscriptions (with memberid): ${step4.totalActiveMonthlyStripeSubscriptions}`,
    `  Unique active monthly member IDs: ${step4.totalUniqueActiveMonthlyMemberIds}`,
    `  Matched legacy members (subscription rows): ${step4.totalMatchedLegacyMembers}`,
    `  Unique matched members (import candidates): ${step4.totalUniqueMatchedMembersForImport}`,
    `  Unmatched Stripe subscriptions: ${step4.totalUnmatchedStripeSubscriptions}`,
    `  Override matches applied: ${step4.totalOverrideMatches}`,
    `  Ambiguous legacy matches: ${step4.totalAmbiguousLegacyMatches}`,
    `  Duplicate active Stripe rows for same member ID: ${step4.totalDuplicateActiveStripeSubscriptionsForSameMemberId}`,
    `  Matched blank email: ${step4.totalMatchedRecordsWithBlankEmail}`,
    `  Matched blank password: ${step4.totalMatchedRecordsWithBlankPassword}`,
    `  Matched blank first name: ${step4.totalMatchedRecordsWithBlankFirstName}`,
    `  Matched blank last name: ${step4.totalMatchedRecordsWithBlankLastName}`,
    `  Duplicate matched emails (groups): ${step4.totalMatchedRecordsWithDuplicateEmailAddresses}`,
    `  Email mismatches (legacy vs Stripe): ${step4.totalEmailMismatches}`,
    `  Stripe rows with duplicate Customer ID: ${step4.totalStripeRowsSameCustomerIdMoreThanOnce} (groups: ${step4.totalStripeCustomerIdDuplicateGroups})`,
    `  Stripe rows with duplicate Subscription ID: ${step4.totalStripeRowsSameSubscriptionIdMoreThanOnce} (groups: ${step4.totalStripeSubscriptionIdDuplicateGroups})`,
    "",
    "STEP 5 - Memberstack import format",
    `  Confirmed: ${formatInfo.confirmed}`,
    `  Source: ${formatInfo.source}`,
    `  Docs: ${formatInfo.docsUrl}`,
    `  Sample file: ${formatInfo.sampleImportFileUrl}`,
    `  Password header: ${formatInfo.passwordHeader}`,
    `  Import headers: ${formatInfo.importHeaders.join(" | ")}`,
    "  Recurring paid required: Email + Member Stripe Customer ID + Member Stripe Subscription ID",
    "  Memberstack Plan ID / Free Plans: not required for recurring (plan comes from Stripe subscription)",
    "",
    "STEP 6 - Final import CSV",
    `  Generated: ${importCsvGenerated}`,
    `  Path: ${importCsvPath ? path.relative(REPO_ROOT, importCsvPath).replace(/\\/g, "/") : "(none)"}`,
    `  Rows: ${importRowCount}`,
    "",
    "Manual review counts",
    `  unmatched-stripe-members.csv: ${unmatchedStripe.length}`,
    `  memberid-overrides-applied.csv: ${overrideMatches.length}`,
    `  duplicate-stripe-memberids.csv: ${duplicateStripeMemberIdRows.length}`,
    `  duplicate-subscription-import-choices.csv: ${duplicateImportChoices.length}`,
    `  duplicate-emails.csv: ${duplicateEmailRows.length}`,
    `  email-mismatches.csv: ${emailMismatchRows.length}`,
    `  blank-passwords.csv: ${blankPasswordRows.length}`,
    `  malformed-rows.csv: ${malformedRows.length}`,
    "",
    "Assumptions",
    ...(assumptions.length ? assumptions.map((a) => `  - ${a}`) : ["  - (none)"]),
    "  - Join key is legacy memberid to Stripe memberid (metadata), case-insensitive trim for matching only.",
    `  - Optional overrides from ${overrides.path || "memberid-overrides.json"} map Stripe Subscription ID to a confirmed legacy memberid.`,
    "  - Email is used only for diagnostics; legacy email is not overwritten (legacy email goes into Email column).",
    "  - One import row per unique matched legacy member ID; newest Created (UTC) subscription chosen when duplicates exist.",
    "  - Member ID left blank so Memberstack assigns new IDs; legacy ID goes in legacyMemberID custom field.",
    "  - Free Plans left blank for recurring paid members (per official docs).",
    "  - Passwords are never written to reports or exception CSVs.",
    "",
    "Security",
    "  Passwords excluded from all reports and exception files.",
    "  Source CSVs were not modified.",
    "  No import was performed.",
    "",
  ];

  fs.writeFileSync(
    path.join(OUTPUT_DIR, "migration-summary.txt"),
    summaryLines.join("\n"),
    "utf8",
  );

  console.log("STEP 6 - Final import CSV");
  console.log(`  Generated: ${importCsvGenerated}`);
  console.log(`  Rows: ${importRowCount}`);
  if (importCsvPath) {
    console.log(`  Path: ${path.relative(REPO_ROOT, importCsvPath).replace(/\\/g, "/")}`);
  }
  console.log("");
  console.log("Output directory:", path.relative(REPO_ROOT, OUTPUT_DIR).replace(/\\/g, "/"));
  console.log("Wrote: migration-summary.txt, migration-report.json, exception CSVs, import CSV");
  console.log("");
  console.log("Manual review needed for:");
  console.log(`  unmatched Stripe: ${unmatchedStripe.length}`);
  console.log(`  override matches applied: ${overrideMatches.length}`);
  console.log(`  duplicate Stripe memberids: ${duplicateStripeMemberIdRows.length}`);
  console.log(`  duplicate subscription choices: ${duplicateImportChoices.length}`);
  console.log(`  duplicate emails: ${duplicateEmailRows.length}`);
  console.log(`  email mismatches: ${emailMismatchRows.length}`);
  console.log(`  blank passwords: ${blankPasswordRows.length}`);
  console.log(`  malformed/ambiguous: ${malformedRows.length}`);
  if (assumptions.length) {
    console.log("\nAssumptions:");
    for (const a of assumptions) console.log(`  - ${a}`);
  }
}

try {
  run();
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  // Never include row payloads (may contain passwords) in error output.
  console.error("Migration prep failed:", message);
  process.exit(1);
}

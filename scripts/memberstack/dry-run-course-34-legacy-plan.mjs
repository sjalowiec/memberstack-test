/**
 * Dry run only. Classifies Course 34 plan grants and legacy custom-field fills
 * for verified purchasers. Never creates members, grants plans, patches fields,
 * or sends email.
 *
 * Reuses the Course 87 dry-run lookup (GET by email, then GET by id) and the
 * monthly migration custom-field keys. date-joined is the legacy DateJoined
 * value in SQL style 121 (yyyy-mm-dd hh:mi:ss.mmm), the format already stored
 * by the monthly import. It is never replaced with the run date.
 *
 * A later execute would:
 *   - GET by normalized email before create, and skip if an account exists
 *   - POST /members/:id/add-plan with only this free plan id
 *   - PATCH customFields for verified blank keys only (shallow merge)
 *   - create new accounts with the four legacy fields and this plan, then leave
 *     password setup to the site forgot-password flow
 *   - append each result to the operation log and skip rows already succeeded
 */
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const PLAN_ID = "pln_course-lk150-patterning-nw00gk6";
const FIELD_KEYS = ["first-name", "last-name", "date-joined", "legacyMemberID"];
const ROOT = resolve(import.meta.dirname, "../..");
const PRIVATE_DIR = resolve(ROOT, "legacy-data/private/course-34");
const ENTITLED_CSV = resolve(PRIVATE_DIR, "course-34-entitled-purchases.csv");
const SOURCE_CSV = resolve(PRIVATE_DIR, "course-34-legacy-member-source.csv");
const REPORT_CSV = resolve(PRIVATE_DIR, "course-34-dry-run.csv");
const OPERATION_LOG = resolve(PRIVATE_DIR, "course-34-dry-run-operations.csv");
const SUMMARY_JSON = resolve(PRIVATE_DIR, "course-34-dry-run-summary.json");

if (process.argv.slice(2).some((arg) => arg !== "--dry-run")) {
  console.error("This script is dry-run only. It does not create accounts, grant plans, or send email.");
  process.exit(1);
}

function readEnvKey() {
  const envText = readFileSync(resolve(ROOT, ".env"), "utf8");
  const line = envText.split(/\r?\n/).find((row) => row.startsWith("MEMBERSTACK_SECRET_KEY="));
  const key = line?.slice("MEMBERSTACK_SECRET_KEY=".length).trim().replace(/^["']|["']$/g, "");
  if (!key || key.startsWith("sk_sb_")) {
    throw new Error("Live MEMBERSTACK_SECRET_KEY is required. Sandbox keys are refused.");
  }
  if (!key.startsWith("sk_")) {
    throw new Error("MEMBERSTACK_SECRET_KEY is present but is not a live secret-key prefix.");
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

function csvCell(value) {
  const text = value == null ? "" : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function writeCsv(path, headers, rows) {
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => csvCell(row[header])).join(","));
  }
  writeFileSync(path, `\uFEFF${lines.join("\r\n")}\r\n`, "utf8");
}

function sqlQuote(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function queryLegacyMembers(people) {
  const emails = [...new Set(people.map((person) => person.email))];
  const memberIds = [...new Set(people.flatMap((person) => person.legacyMemberIds))];
  const sqlPath = resolve(PRIVATE_DIR, "course-34-legacy-member-source.sql");
  const sql = `
SET NOCOUNT ON;
SELECT (
  SELECT
    CONVERT(varchar(36), m.memberid) AS memberid,
    m.Fristname AS first_name,
    m.Lastname AS last_name,
    LOWER(LTRIM(RTRIM(m.Email))) AS email,
    CONVERT(varchar(23), m.DateJoined, 121) AS date_joined,
    CASE WHEN LOWER(LTRIM(RTRIM(m.Email))) IN (${emails.map(sqlQuote).join(",")}) THEN 1 ELSE 0 END AS email_match,
    CASE WHEN CONVERT(varchar(36), m.memberid) IN (${memberIds.map(sqlQuote).join(",")}) THEN 1 ELSE 0 END AS id_match
  FROM Members m
  WHERE LOWER(LTRIM(RTRIM(m.Email))) IN (${emails.map(sqlQuote).join(",")})
     OR CONVERT(varchar(36), m.memberid) IN (${memberIds.map(sqlQuote).join(",")})
  FOR JSON PATH
) AS payload;
`;
  writeFileSync(sqlPath, sql, "utf8");
  const result = spawnSync(
    "sqlcmd",
    ["-C", "-S", "localhost", "-E", "-d", "patternengine", "-y", "0", "-w", "65535", "-i", sqlPath],
    { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 },
  );
  unlinkSync(sqlPath);
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Legacy member query failed: ${result.stderr || result.status}`);
  }
  const joined = (result.stdout ?? "")
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .join("")
    .trim();
  const start = joined.indexOf("[");
  const end = joined.lastIndexOf("]");
  const payload = start >= 0 && end > start ? joined.slice(start, end + 1) : "";
  const rows = payload && payload !== "NULL" ? JSON.parse(payload) : [];
  return rows.map((row) => ({
    memberid: String(row.memberid ?? "").trim().toUpperCase(),
    firstName: String(row.first_name ?? "").trim(),
    lastName: String(row.last_name ?? "").trim(),
    email: String(row.email ?? "").trim().toLowerCase(),
    dateJoined: row.date_joined == null ? "" : String(row.date_joined).trim(),
    emailMatch: row.email_match === 1,
    idMatch: row.id_match === 1,
  }));
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

function customFieldMap(member) {
  const raw = member?.customFields;
  const map = {};
  if (Array.isArray(raw)) {
    for (const item of raw) {
      const key = item?.key || item?.id || item?.name;
      if (!key) continue;
      const value = item?.value ?? item?.text ?? "";
      map[String(key)] = value == null ? "" : String(value);
    }
  } else if (raw && typeof raw === "object") {
    for (const [key, value] of Object.entries(raw)) {
      if (value && typeof value === "object" && "value" in value) {
        map[key] = value.value == null ? "" : String(value.value);
      } else {
        map[key] = value == null ? "" : String(value);
      }
    }
  }
  return map;
}

function requestMemberstack(apiKey, method, url, body) {
  const args = [
    "-sS",
    "-w",
    "\n%{http_code}",
    "-X",
    method,
    "-H",
    `X-API-KEY: ${apiKey}`,
    "-H",
    "Accept: application/json",
    "-H",
    "Content-Type: application/json",
  ];
  if (body) args.push("--data-raw", body);
  args.push(url);
  const result = spawnSync("curl.exe", args, { encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Memberstack ${method} failed: ${result.stderr || result.status}`);
  }
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
  return { status, member: parsed?.data ?? null, parsed };
}

function getMember(apiKey, idOrEmail) {
  const url = `https://admin.memberstack.com/members/${encodeURIComponent(idOrEmail)}`;
  return requestMemberstack(apiKey, "GET", url);
}

function sameText(left, right) {
  return left.trim().replace(/\s+/g, " ").toLowerCase() === right.trim().replace(/\s+/g, " ").toLowerCase();
}

function sourceForPerson(person, rows) {
  const byEmail = rows.filter((row) => row.email === person.email);
  const byId = rows.filter((row) => person.legacyMemberIds.includes(row.memberid));
  const flags = [];
  if (person.legacyMemberIds.length !== 1) flags.push("purchase_rows_have_multiple_legacy_ids");
  if (person.names.size > 1) flags.push("purchase_rows_have_conflicting_names");
  if (byId.length === 0) flags.push("legacy_member_id_not_found");
  if (byId.length > 1) flags.push("legacy_member_id_matched_multiple_rows");
  if (byEmail.length === 0) flags.push("legacy_email_not_found");
  if (byEmail.length > 1) flags.push("ambiguous_legacy_email");
  const idRow = byId.length === 1 ? byId[0] : null;
  if (idRow && idRow.email !== person.email) flags.push("legacy_member_email_differs_from_purchase_email");
  const emailIds = new Set(byEmail.map((row) => row.memberid));
  if (idRow && emailIds.size && !emailIds.has(idRow.memberid)) flags.push("legacy_email_belongs_to_a_different_member_id");
  const comparable = byEmail.length ? byEmail : byId;
  const firstNames = new Set(comparable.map((row) => row.firstName.trim().toLowerCase()).filter(Boolean));
  const lastNames = new Set(comparable.map((row) => row.lastName.trim().toLowerCase()).filter(Boolean));
  const dates = new Set(comparable.map((row) => row.dateJoined).filter(Boolean));
  if (firstNames.size > 1) flags.push("conflicting_legacy_first_name");
  if (lastNames.size > 1) flags.push("conflicting_legacy_last_name");
  if (dates.size > 1) flags.push("conflicting_legacy_date_joined");
  const chosen = flags.length === 0 ? idRow : null;
  if (chosen && !chosen.firstName) flags.push("missing_legacy_first_name");
  if (chosen && !chosen.lastName) flags.push("missing_legacy_last_name");
  if (chosen && !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}$/.test(chosen.dateJoined)) {
    flags.push(chosen.dateJoined ? "unexpected_legacy_date_format" : "missing_legacy_date_joined");
  }
  if (chosen && !chosen.memberid) flags.push("missing_legacy_member_id");
  return {
    chosen: flags.length === 0 ? chosen : null,
    candidate: idRow,
    flags,
    matchCount: byEmail.length,
  };
}

function loadPurchases() {
  const rows = parseCsv(readFileSync(ENTITLED_CSV, "utf8"));
  const header = rows[0].map((cell) => cell.trim());
  const index = Object.fromEntries(header.map((name, i) => [name, i]));
  const required = ["Name", "Email", "Purchase Type", "Order ID"];
  for (const name of required) {
    if (index[name] == null) throw new Error(`Entitled CSV is missing ${name}.`);
  }
  const purchases = rows.slice(1).map((cells) => ({
    name: cells[index.Name]?.trim() ?? "",
    email: cells[index.Email]?.trim().toLowerCase() ?? "",
    purchaseType: cells[index["Purchase Type"]]?.trim() ?? "",
    orderId: cells[index["Order ID"]]?.trim() ?? "",
  }));
  return purchases;
}

function legacyIdsFromRaw(purchases) {
  const rawPath = resolve(PRIVATE_DIR, "course-34-purchases-raw.csv");
  const rows = parseCsv(readFileSync(rawPath, "utf8"));
  const header = rows[0].map((cell) => cell.trim());
  const index = Object.fromEntries(header.map((name, i) => [name, i]));
  const byOrder = new Map();
  for (const cells of rows.slice(1)) {
    const orderId = cells[index.order_id]?.trim();
    if (!orderId) continue;
    byOrder.set(orderId, {
      firstName: cells[index.first_name]?.trim() ?? "",
      lastName: cells[index.last_name]?.trim() ?? "",
      legacyMemberId: (cells[index.legacy_member_id] ?? "").trim().toUpperCase(),
      email: cells[index.email]?.trim().toLowerCase() ?? "",
    });
  }
  return purchases.map((purchase) => {
    const raw = byOrder.get(purchase.orderId);
    if (!raw || raw.email !== purchase.email) {
      throw new Error(`Purchase ${purchase.orderId} has no matching raw legacy member id.`);
    }
    return { ...purchase, ...raw };
  });
}

const apiKey = readEnvKey();
const authProbe = getMember(apiKey, "course-34-dry-run-missing@example.invalid");
if (authProbe.status === 401 || authProbe.status === 403) {
  throw new Error("Memberstack Admin API rejected the live key.");
}
const addPlanProbe = requestMemberstack(
  apiKey,
  "POST",
  "https://admin.memberstack.com/members/mem_course34_dry_run_missing/add-plan",
  JSON.stringify({ planId: PLAN_ID }),
);
if (addPlanProbe.status === 401 || addPlanProbe.status === 403) {
  throw new Error("Memberstack add-plan rejected the live key.");
}
function publicApiMessage(parsed) {
  const message = parsed?.message || parsed?.error || parsed?.data?.message || "";
  const text = typeof message === "string" ? message : JSON.stringify(message ?? "");
  if (/sk_|api[_-]?key|secret/i.test(text)) return "redacted";
  return text.slice(0, 180);
}
const addPlanProbeMessage = publicApiMessage(addPlanProbe.parsed);

const purchases = legacyIdsFromRaw(loadPurchases());
if (purchases.length !== 273) {
  throw new Error(`Expected 273 purchase rows, found ${purchases.length}.`);
}
const people = [];
const byEmail = new Map();
for (const purchase of purchases) {
  let person = byEmail.get(purchase.email);
  if (!person) {
    person = {
      email: purchase.email,
      names: new Set(),
      legacyMemberIds: [],
      purchaseTypes: new Set(),
      orderIds: [],
    };
    byEmail.set(purchase.email, person);
    people.push(person);
  }
  person.names.add(purchase.name);
  if (!person.legacyMemberIds.includes(purchase.legacyMemberId)) {
    person.legacyMemberIds.push(purchase.legacyMemberId);
  }
  person.purchaseTypes.add(purchase.purchaseType);
  person.orderIds.push(purchase.orderId);
}
if (people.length !== 270) {
  throw new Error(`Expected 270 people, found ${people.length}.`);
}

const legacyRows = queryLegacyMembers(people);
writeCsv(SOURCE_CSV, ["memberid", "first_name", "last_name", "email", "date_joined", "email_match", "id_match"], legacyRows.map((row) => ({
  memberid: row.memberid,
  first_name: row.firstName,
  last_name: row.lastName,
  email: row.email,
  date_joined: row.dateJoined,
  email_match: row.emailMatch ? "yes" : "no",
  id_match: row.idMatch ? "yes" : "no",
})));

const reports = [];
const operations = [];
const customFieldKeysSeen = new Set();
let lookupErrors = 0;

for (const person of people) {
  const source = sourceForPerson(person, legacyRows);
  const lookup = getMember(apiKey, person.email);
  const member = lookup.member;
  const memberId = typeof member?.id === "string" ? member.id.trim() : "";
  const verified = lookup.status === 200 && member && memberId && memberEmail(member) === person.email;
  if (lookup.status !== 200 || (member && !verified)) lookupErrors += 1;

  const fields = verified ? customFieldMap(member) : {};
  for (const key of Object.keys(fields)) customFieldKeysSeen.add(key);
  const connections = verified && Array.isArray(member.planConnections) ? member.planConnections : [];
  const planMatches = connections
    .map((connection) => ({ planId: planIdOf(connection), state: connectionState(connection) }))
    .filter((connection) => connection.planId === PLAN_ID);
  const activePlan = planMatches.find((connection) => connection.state === "active");

  const actions = [];
  const notes = [...source.flags];
  const sourceReady = Boolean(source.chosen);
  const sourceValues = source.chosen
    ? {
        "first-name": source.chosen.firstName,
        "last-name": source.chosen.lastName,
        "date-joined": source.chosen.dateJoined,
        legacyMemberID: source.chosen.memberid,
      }
    : null;

  if (!verified) {
    if (!sourceReady) {
      actions.push("hold_create");
      operations.push({
        email: person.email,
        memberstack_member_id: "",
        operation: "create_member",
        target: PLAN_ID,
        status: "held",
        result: "dry_run_not_executed",
        notes: source.flags.join("; "),
      });
    } else {
      actions.push("would_create_account");
      actions.push("would_add_plan_on_create");
      operations.push({
        email: person.email,
        memberstack_member_id: "",
        operation: "create_member",
        target: `${PLAN_ID}; first-name; last-name; date-joined; legacyMemberID`,
        status: "proposed",
        result: "dry_run_not_executed",
        notes: "Create only after a fresh GET finds no account. Password is generated at execute time, never logged, and is not the legacy password. Member finishes the existing site forgot-password flow. This run sends no email.",
      });
    }
  } else if (activePlan) {
    actions.push("already_has_plan");
    operations.push({
      email: person.email,
      memberstack_member_id: memberId,
      operation: "add_plan",
      target: PLAN_ID,
      status: "skipped",
      result: "already_active",
      notes: "",
    });
  } else if (planMatches.length) {
    actions.push("hold_plan_not_active");
    notes.push(`plan_states:${planMatches.map((match) => match.state).join("|")}`);
    operations.push({
      email: person.email,
      memberstack_member_id: memberId,
      operation: "add_plan",
      target: PLAN_ID,
      status: "held",
      result: "plan_present_but_not_active",
      notes: planMatches.map((match) => match.state).join("|"),
    });
  } else {
    actions.push("would_add_plan");
    operations.push({
      email: person.email,
      memberstack_member_id: memberId,
      operation: "add_plan",
      target: PLAN_ID,
      status: "proposed",
      result: "dry_run_not_executed",
      notes: "Adds only this plan. Other plans, subscriptions, and the password stay unchanged.",
    });
  }

  if (verified && sourceValues) {
    for (const key of FIELD_KEYS) {
      const current = (fields[key] ?? "").trim();
      const incoming = sourceValues[key];
      const equal = key === "legacyMemberID" ? current.toUpperCase() === incoming.toUpperCase() : sameText(current, incoming);
      if (!current) {
        actions.push(`would_fill_${key}`);
        operations.push({
          email: person.email,
          memberstack_member_id: memberId,
          operation: "fill_blank_field",
          target: key,
          status: "proposed",
          result: "dry_run_not_executed",
          notes: "Patch this blank key only.",
        });
      } else if (!equal) {
        actions.push(`conflict_${key}`);
        notes.push(`existing_${key}_kept`);
        notes.push(`memberstack_${key}=${current}`);
        operations.push({
          email: person.email,
          memberstack_member_id: memberId,
          operation: "report_conflict",
          target: key,
          status: "conflict",
          result: "not_overwritten",
          notes: "Existing value differs from the legacy record and is kept.",
        });
      } else {
        operations.push({
          email: person.email,
          memberstack_member_id: memberId,
          operation: "skip_field",
          target: key,
          status: "skipped",
          result: "already_matches",
          notes: "",
        });
      }
    }
    const typoDate = (fields["dae-joined"] ?? "").trim();
    if (typoDate) {
      const sourceDay = sourceValues["date-joined"].slice(0, 10);
      const sourceMonth = sourceValues["date-joined"].slice(0, 7);
      const monthDay = typoDate.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      const monthOnly = typoDate.match(/^(\d{2})\/(\d{4})$/);
      const typoDay = monthDay ? `${monthDay[3]}-${monthDay[1]}-${monthDay[2]}` : "";
      const typoMonth = monthOnly ? `${monthOnly[2]}-${monthOnly[1]}` : "";
      if (sameText(typoDate, sourceValues["date-joined"]) || typoDay === sourceDay) {
        notes.push("nonstandard_dae-joined_same_calendar_day");
      } else if (typoMonth && typoMonth === sourceMonth) {
        notes.push("nonstandard_dae-joined_same_month_only");
      } else {
        notes.push("nonstandard_dae-joined_differs_from_date-joined");
      }
    }
    const kinId = (fields["kin-id"] ?? "").trim();
    if (kinId) {
      notes.push(kinId.toUpperCase() === sourceValues.legacyMemberID.toUpperCase()
        ? "nonstandard_kin-id_matches_legacyMemberID"
        : "nonstandard_kin-id_differs_from_legacyMemberID");
    }
  } else if (verified && !sourceValues) {
    actions.push("hold_field_fills");
    operations.push({
      email: person.email,
      memberstack_member_id: memberId,
      operation: "fill_blank_field",
      target: FIELD_KEYS.join("; "),
      status: "held",
      result: "source_not_verified",
      notes: source.flags.join("; "),
    });
  }

  reports.push({
    "First Name": source.chosen?.firstName || source.candidate?.firstName || "",
    "Last Name": source.chosen?.lastName || source.candidate?.lastName || "",
    "Original Date Joined": source.chosen?.dateJoined || source.candidate?.dateJoined || "",
    "Legacy Member ID": source.chosen?.memberid || person.legacyMemberIds.join("|"),
    Email: person.email,
    "Memberstack Member ID": verified ? memberId : "",
    "Proposed Actions": actions.join("; "),
    Notes: notes.join("; "),
    "Purchase Types": [...person.purchaseTypes].join("; "),
    "Order IDs": person.orderIds.join("; "),
  });
}

writeCsv(
  REPORT_CSV,
  [
    "First Name",
    "Last Name",
    "Original Date Joined",
    "Legacy Member ID",
    "Email",
    "Memberstack Member ID",
    "Proposed Actions",
    "Notes",
    "Purchase Types",
    "Order IDs",
  ],
  reports,
);
writeCsv(
  OPERATION_LOG,
  ["email", "memberstack_member_id", "operation", "target", "status", "result", "notes"],
  operations,
);

function actionSet(row) {
  return new Set(row["Proposed Actions"].split("; ").filter(Boolean));
}
const summary = {
  dryRun: true,
  writesPerformed: false,
  emailsSent: false,
  planId: PLAN_ID,
  customFieldKeys: FIELD_KEYS,
  dateJoinedFormat: "yyyy-mm-dd hh:mi:ss.mmm",
  purchaseRows: purchases.length,
  people: people.length,
  credentialCheck: {
    liveKeyPrefix: true,
    sandboxKeyRefused: true,
    getMemberHttpStatus: authProbe.status,
    addPlanProbeHttpStatus: addPlanProbe.status,
    addPlanProbeMessage,
    addPlanProbeGranted: false,
  },
  customFieldKeysSeen: [...customFieldKeysSeen].sort(),
  lookupErrors,
  existingAccountsNeedingPlan: reports.filter((row) => actionSet(row).has("would_add_plan")).length,
  missingAccountsToCreate: reports.filter((row) => actionSet(row).has("would_create_account")).length,
  alreadyHoldingPlan: reports.filter((row) => actionSet(row).has("already_has_plan")).length,
  existingAccountsWithBlankFields: reports.filter((row) => [...actionSet(row)].some((action) => action.startsWith("would_fill_"))).length,
  heldCreates: reports.filter((row) => actionSet(row).has("hold_create")).length,
  heldFieldFills: reports.filter((row) => actionSet(row).has("hold_field_fills")).length,
  heldInactivePlans: reports.filter((row) => actionSet(row).has("hold_plan_not_active")).length,
  conflicts: reports.filter((row) => [...actionSet(row)].some((action) => action.startsWith("conflict_"))).length,
  blankFieldCounts: Object.fromEntries(FIELD_KEYS.map((key) => [
    key,
    reports.filter((row) => actionSet(row).has(`would_fill_${key}`)).length,
  ])),
  conflictCounts: Object.fromEntries(FIELD_KEYS.map((key) => [
    key,
    reports.filter((row) => actionSet(row).has(`conflict_${key}`)).length,
  ])),
  sourceFlagCounts: {},
};
for (const report of reports) {
  for (const flag of report.Notes.split("; ").filter(Boolean)) {
    summary.sourceFlagCounts[flag] = (summary.sourceFlagCounts[flag] ?? 0) + 1;
  }
}
writeFileSync(SUMMARY_JSON, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
console.log(JSON.stringify(summary, null, 2));

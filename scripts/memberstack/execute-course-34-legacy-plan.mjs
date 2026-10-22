/**
 * Resumable Course 34 plan migration for the reviewed dry-run report.
 *
 * Writes only the free plan pln_course-lk150-patterning-nw00gk6 and verified
 * blank legacy fields. Rechecks each member before creating, granting, or
 * patching so a retry cannot create a duplicate. Generates a password in
 * memory for new accounts, never logs it, and does not call any email,
 * welcome, or password-reset endpoint.
 *
 *   node scripts/memberstack/execute-course-34-legacy-plan.mjs --execute --i-understand-this-writes-to-memberstack
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { createMemberstackAdminClient } from "../../netlify/functions/lib/memberstack-admin.js";

const PLAN_ID = "pln_course-lk150-patterning-nw00gk6";
const ROOT = resolve(import.meta.dirname, "../..");
const PRIVATE_DIR = resolve(ROOT, "legacy-data/private/course-34");
const REPORT_CSV = resolve(PRIVATE_DIR, "course-34-dry-run.csv");
const SUMMARY_JSON = resolve(PRIVATE_DIR, "course-34-dry-run-summary.json");
const OPERATION_LOG = resolve(PRIVATE_DIR, "course-34-execute-operations.csv");
const VERIFY_CSV = resolve(PRIVATE_DIR, "course-34-execute-verification.csv");
const RESULT_JSON = resolve(PRIVATE_DIR, "course-34-execute-summary.json");
const DATE_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}$/;
const LEGACY_ID_RE = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i;
const LOG_HEADERS = ["timestamp", "email", "memberstack_member_id", "operation", "target", "status", "result", "notes"];

const args = new Set(process.argv.slice(2));
if (!args.has("--execute") || !args.has("--i-understand-this-writes-to-memberstack") || args.size !== 2) {
  console.error(
    "Refusing to write. Pass --execute --i-understand-this-writes-to-memberstack. This script sends no email.",
  );
  process.exit(1);
}

function readLiveKey() {
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
    if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") field += char;
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
  for (const row of rows) lines.push(headers.map((header) => csvCell(row[header])).join(","));
  writeFileSync(path, `\uFEFF${lines.join("\r\n")}\r\n`, "utf8");
}

function loadReport() {
  const table = parseCsv(readFileSync(REPORT_CSV, "utf8"));
  const header = table[0].map((cell) => cell.trim());
  return table.slice(1).map((cells) => Object.fromEntries(header.map((name, index) => [name, cells[index] ?? ""])));
}

function actionSet(row) {
  return new Set(String(row["Proposed Actions"] ?? "").split("; ").map((item) => item.trim()).filter(Boolean));
}

function classify(rows) {
  const people = [];
  for (const row of rows) {
    const email = String(row.Email ?? "").trim().toLowerCase();
    const actions = actionSet(row);
    const notes = String(row.Notes ?? "").split("; ").map((item) => item.trim()).filter(Boolean);
    const sourceNotes = notes.filter((note) => !note.startsWith("existing_") && !note.startsWith("memberstack_") && !note.startsWith("nonstandard_"));
    const firstName = String(row["First Name"] ?? "").trim();
    const lastName = String(row["Last Name"] ?? "").trim();
    const dateJoined = String(row["Original Date Joined"] ?? "").trim();
    const legacyMemberId = String(row["Legacy Member ID"] ?? "").trim();
    const memberstackId = String(row["Memberstack Member ID"] ?? "").trim();
    const create = actions.has("would_create_account");
    const holdCreate = actions.has("hold_create");
    const grant = actions.has("would_add_plan");
    const person = {
      email,
      firstName,
      lastName,
      dateJoined,
      legacyMemberId,
      priorMemberstackId: memberstackId,
      cohort: create ? "create" : holdCreate ? "blank-last-name" : grant ? "existing" : "unexpected",
      fillDate: actions.has("would_fill_date-joined"),
      fillLegacyId: actions.has("would_fill_legacyMemberID"),
      keepFirstName: actions.has("conflict_first-name"),
      actions: [...actions].sort(),
      sourceNotes,
    };
    people.push(person);
  }
  return people;
}

function assertReviewedCohort(people) {
  const counts = {
    create: people.filter((person) => person.cohort === "create").length,
    existing: people.filter((person) => person.cohort === "existing").length,
    blankLastName: people.filter((person) => person.cohort === "blank-last-name").length,
    unexpected: people.filter((person) => person.cohort === "unexpected").length,
  };
  const problems = [];
  if (people.length !== 270) problems.push(`people=${people.length}`);
  if (new Set(people.map((person) => person.email)).size !== 270) problems.push("emails are not unique");
  if (counts.create !== 204 || counts.existing !== 64 || counts.blankLastName !== 2 || counts.unexpected !== 0) {
    problems.push(`cohorts create=${counts.create} existing=${counts.existing} blankLastName=${counts.blankLastName} unexpected=${counts.unexpected}`);
  }
  for (const person of people) {
    if (!person.email || !person.email.includes("@")) problems.push("invalid email row");
    if (!person.firstName) problems.push(`missing first name for ${person.cohort}`);
    if (!DATE_RE.test(person.dateJoined)) problems.push(`unexpected date format for ${person.cohort}`);
    if (!LEGACY_ID_RE.test(person.legacyMemberId)) problems.push(`unexpected legacy id for ${person.cohort}`);
    if (person.cohort === "create") {
      if (!person.lastName) problems.push("create row missing last name");
      if (person.priorMemberstackId) problems.push("create row already has a memberstack id");
      if (person.actions.join("|") !== "would_add_plan_on_create|would_create_account") problems.push("unexpected create actions");
      if (person.sourceNotes.length) problems.push("create row has source flags");
    } else if (person.cohort === "blank-last-name") {
      if (person.lastName) problems.push("blank-last-name row has a last name");
      if (person.priorMemberstackId) problems.push("blank-last-name row already has a memberstack id");
      if (person.actions.join("|") !== "hold_create") problems.push("unexpected hold actions");
      if (person.sourceNotes.join("|") !== "missing_legacy_last_name") problems.push("blank-last-name row has other flags");
    } else if (person.cohort === "existing") {
      if (!person.priorMemberstackId.startsWith("mem_")) problems.push("existing row missing memberstack id");
      if (!person.fillDate) problems.push("existing row missing date fill");
      const allowed = new Set(["would_add_plan", "would_fill_date-joined"]);
      if (person.fillLegacyId) allowed.add("would_fill_legacyMemberID");
      if (person.keepFirstName) allowed.add("conflict_first-name");
      if (person.actions.length !== allowed.size || person.actions.some((action) => !allowed.has(action))) {
        problems.push(`unexpected existing actions: ${person.actions.join("|")}`);
      }
    }
  }
  const reviewed = JSON.parse(readFileSync(SUMMARY_JSON, "utf8"));
  if (reviewed.planId !== PLAN_ID || reviewed.dryRun !== true || reviewed.writesPerformed !== false) {
    problems.push("dry-run summary is not the reviewed no-write report");
  }
  if (reviewed.people !== 270 || reviewed.existingAccountsNeedingPlan !== 64 || reviewed.missingAccountsToCreate !== 204 || reviewed.heldCreates !== 2) {
    problems.push("dry-run summary counts do not match the reviewed migration");
  }
  if (problems.length) {
    throw new Error(`Refusing to write. Reviewed cohort check failed (${problems.length} issues). First: ${problems[0]}`);
  }
  return counts;
}

function generatePassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const symbols = "!@#$%*-_";
  const bytes = randomBytes(40);
  let body = "";
  for (let i = 0; i < 28; i += 1) body += chars[bytes[i] % chars.length];
  return `Aa1${symbols[bytes[28] % symbols.length]}${body}`;
}

function safeText(value, secret) {
  let text = String(value ?? "");
  if (secret) text = text.split(secret).join("[redacted]");
  return text
    .replace(/sk_[a-zA-Z0-9_]+/g, "sk_[redacted]")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .slice(0, 300);
}

function memberEmail(member) {
  const auth = member?.auth && typeof member.auth === "object" ? member.auth : {};
  return String(auth.email ?? member?.email ?? "").trim().toLowerCase();
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
      if (value && typeof value === "object" && "value" in value) map[key] = value.value == null ? "" : String(value.value);
      else map[key] = value == null ? "" : String(value);
    }
  }
  return map;
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

function connectionsOf(member) {
  return Array.isArray(member?.planConnections) ? member.planConnections : [];
}

function planState(member) {
  const matches = connectionsOf(member)
    .map((connection) => ({ planId: planIdOf(connection), state: connectionState(connection) }))
    .filter((connection) => connection.planId === PLAN_ID);
  if (matches.some((connection) => connection.state === "active")) return "active";
  if (matches.length) return matches.map((connection) => connection.state).join("|");
  return "";
}

function otherPlanSignature(member) {
  return connectionsOf(member)
    .filter((connection) => planIdOf(connection) !== PLAN_ID)
    .map((connection) => `${planIdOf(connection)}:${connectionState(connection)}`)
    .sort()
    .join("|");
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function curlFetch(url, init = {}) {
  const headers = init.headers && typeof init.headers === "object" ? init.headers : {};
  const args = ["-sS", "-w", "\n%{http_code}", "-X", init.method || "GET"];
  for (const [key, value] of Object.entries(headers)) {
    if (value == null) continue;
    args.push("-H", `${key}: ${value}`);
  }
  const input = typeof init.body === "string" ? init.body : undefined;
  if (input !== undefined) args.push("--data-binary", "@-");
  args.push(url);
  const result = spawnSync("curl.exe", args, {
    encoding: "utf8",
    input,
    maxBuffer: 20 * 1024 * 1024,
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = String(result.stderr || result.status).replace(/sk_[a-zA-Z0-9_]+/g, "sk_[redacted]");
    throw new Error(`Memberstack request failed before an HTTP response: ${detail.slice(0, 300)}`);
  }
  const output = result.stdout ?? "";
  const splitAt = output.lastIndexOf("\n");
  const responseBody = splitAt >= 0 ? output.slice(0, splitAt) : output;
  const status = Number(splitAt >= 0 ? output.slice(splitAt + 1).trim() : "0");
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => responseBody,
    json: async () => (responseBody ? JSON.parse(responseBody) : null),
  };
}

async function withRetry(operation) {
  let lastError;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const status = error?.httpStatus;
      const retryable = status === 429 || (typeof status === "number" && status >= 500) || status == null;
      if (!retryable || attempt === 5) throw error;
      await sleep(400 * attempt);
    }
  }
  throw lastError;
}

function openLog() {
  mkdirSync(PRIVATE_DIR, { recursive: true });
  if (!existsSync(OPERATION_LOG) || readFileSync(OPERATION_LOG, "utf8").trim() === "") {
    writeFileSync(OPERATION_LOG, `\uFEFF${LOG_HEADERS.join(",")}\r\n`, "utf8");
  }
}

function logOperation(entry, secret) {
  const row = {
    timestamp: new Date().toISOString(),
    email: entry.email,
    memberstack_member_id: entry.memberstack_member_id ?? "",
    operation: entry.operation,
    target: entry.target ?? "",
    status: entry.status,
    result: entry.result,
    notes: safeText(entry.notes ?? "", secret),
  };
  if (secret && row.notes.includes(secret)) {
    throw new Error("Refusing to write a log row that still contains a secret.");
  }
  appendFileSync(OPERATION_LOG, `${LOG_HEADERS.map((header) => csvCell(row[header])).join(",")}\r\n`, "utf8");
  return row;
}

async function getExactMember(client, idOrEmail, expectedEmail = idOrEmail) {
  const member = await withRetry(() => client.getMember(idOrEmail));
  await sleep(40);
  if (!member) return null;
  const expected = String(expectedEmail ?? "").trim().toLowerCase();
  if (memberEmail(member) !== expected || typeof member.id !== "string" || !member.id.startsWith("mem_")) {
    const error = new Error("Memberstack lookup returned an account that does not match this email.");
    error.code = "lookup_mismatch";
    throw error;
  }
  return member;
}

function preservedFieldChanges(before, after, allowedKeys) {
  const beforeMap = customFieldMap(before);
  const afterMap = customFieldMap(after);
  const changes = [];
  for (const key of new Set([...Object.keys(beforeMap), ...Object.keys(afterMap)])) {
    if (allowedKeys.has(key)) continue;
    if ((beforeMap[key] ?? "") !== (afterMap[key] ?? "")) changes.push(key);
  }
  return changes;
}

async function processPerson(client, person, operations) {
  const email = person.email;
  let before;
  try {
    before = await getExactMember(client, email);
  } catch (error) {
    operations.push(logOperation({
      email,
      operation: "lookup",
      status: "failed",
      result: "lookup_failed",
      notes: safeText(error?.message || error),
    }));
    return;
  }

  const existedBefore = Boolean(before);
  if (!existedBefore) {
    if (person.cohort === "existing") {
      operations.push(logOperation({
        email,
        operation: "lookup",
        status: "failed",
        result: "existing_account_missing",
        notes: "Reviewed existing account was not found. No account was created for this row.",
      }));
      return;
    }
    const password = generatePassword();
    const customFields = {
      "first-name": person.firstName,
      "date-joined": person.dateJoined,
      legacyMemberID: person.legacyMemberId,
    };
    if (person.lastName) customFields["last-name"] = person.lastName;
    try {
      await withRetry(() => client.createMember({
        email,
        password,
        plans: [{ planId: PLAN_ID }],
        customFields,
      }));
      await sleep(40);
      operations.push(logOperation({
        email,
        operation: "create_member",
        target: person.cohort === "blank-last-name" ? "account_plan_fields_blank_last_name" : "account_plan_fields",
        status: "succeeded",
        result: "created",
        notes: person.cohort === "blank-last-name"
          ? "Created with verified first name, blank last name, date-joined, and legacyMemberID. Password was not logged. No email was sent."
          : "Created with verified legacy fields and the course plan. Password was not logged. No email was sent.",
      }, password));
    } catch (error) {
      let createdAnyway = null;
      for (let attempt = 1; attempt <= 4 && !createdAnyway; attempt += 1) {
        await sleep(250 * attempt);
        try {
          createdAnyway = await getExactMember(client, email);
        } catch {
          createdAnyway = null;
        }
      }
      if (!createdAnyway) {
        const blankRejected = person.cohort === "blank-last-name" && error?.httpStatus === 400;
        operations.push(logOperation({
          email,
          operation: "create_member",
          target: person.cohort === "blank-last-name" ? "blank_last_name" : "account_plan_fields",
          status: "failed",
          result: blankRejected ? "blank_last_name_rejected" : "create_failed",
          notes: safeText(error?.message || error, password),
        }, password));
        return;
      }
      operations.push(logOperation({
        email,
        memberstack_member_id: createdAnyway.id,
        operation: "create_member",
        target: person.cohort === "blank-last-name" ? "account_plan_fields_blank_last_name" : "account_plan_fields",
        status: "succeeded",
        result: "created",
        notes: "Create response failed after the account existed. No second account was created.",
      }, password));
    }
  } else if (person.cohort !== "existing") {
    operations.push(logOperation({
      email,
      memberstack_member_id: before.id,
      operation: "create_member",
      status: "skipped",
      result: "already_exists",
      notes: "Fresh lookup found an account, so no duplicate was created.",
    }));
  }

  let member = null;
  for (let attempt = 1; attempt <= 4 && !member; attempt += 1) {
    try {
      member = await getExactMember(client, email);
    } catch (error) {
      if (attempt === 4) {
        operations.push(logOperation({
          email,
          operation: "lookup",
          status: "failed",
          result: "lookup_failed_after_create",
          notes: safeText(error?.message || error),
        }));
        return;
      }
    }
    if (!member) await sleep(250 * attempt);
  }
  if (!member) {
    operations.push(logOperation({
      email,
      operation: "lookup",
      status: "failed",
      result: "missing_after_create",
      notes: "Account was not found after the create attempt.",
    }));
    return;
  }

  const memberId = member.id;
  const stateBeforePlan = planState(member);
  if (stateBeforePlan === "active") {
    operations.push(logOperation({
      email,
      memberstack_member_id: memberId,
      operation: "add_plan",
      target: PLAN_ID,
      status: "skipped",
      result: existedBefore ? "already_active" : "active_on_create",
      notes: "",
    }));
  } else if (stateBeforePlan) {
    operations.push(logOperation({
      email,
      memberstack_member_id: memberId,
      operation: "add_plan",
      target: PLAN_ID,
      status: "failed",
      result: "plan_present_but_not_active",
      notes: stateBeforePlan,
    }));
  } else {
    try {
      await withRetry(() => client.addPlan(memberId, PLAN_ID));
      await sleep(40);
      const granted = await getExactMember(client, memberId, email);
      if (planState(granted) !== "active") {
        operations.push(logOperation({
          email,
          memberstack_member_id: memberId,
          operation: "add_plan",
          target: PLAN_ID,
          status: "failed",
          result: "plan_not_active_after_grant",
          notes: planState(granted) || "absent",
        }));
      } else {
        operations.push(logOperation({
          email,
          memberstack_member_id: memberId,
          operation: "add_plan",
          target: PLAN_ID,
          status: "succeeded",
          result: "granted",
          notes: "Added only this free plan.",
        }));
        member = granted;
      }
    } catch (error) {
      operations.push(logOperation({
        email,
        memberstack_member_id: memberId,
        operation: "add_plan",
        target: PLAN_ID,
        status: "failed",
        result: "grant_failed",
        notes: safeText(error?.message || error),
      }));
    }
  }

  const current = await getExactMember(client, memberId, email);
  const fields = customFieldMap(current);
  const patch = {};
  const fieldPlan = person.cohort === "existing"
    ? [
        ["date-joined", person.dateJoined, true],
        ["legacyMemberID", person.legacyMemberId, true],
      ]
    : [
        ["first-name", person.firstName, true],
        ["last-name", person.lastName, Boolean(person.lastName)],
        ["date-joined", person.dateJoined, true],
        ["legacyMemberID", person.legacyMemberId, true],
      ];
  for (const [key, incoming, allowed] of fieldPlan) {
    if (!allowed) continue;
    const currentValue = (fields[key] ?? "").trim();
    const same = key === "legacyMemberID"
      ? currentValue.toUpperCase() === incoming.toUpperCase()
      : currentValue.replace(/\s+/g, " ").toLowerCase() === incoming.replace(/\s+/g, " ").toLowerCase();
    if (!currentValue) patch[key] = incoming;
    else if (same) {
      operations.push(logOperation({
        email,
        memberstack_member_id: memberId,
        operation: "fill_blank_field",
        target: key,
        status: "skipped",
        result: "already_set",
        notes: "",
      }));
    } else {
      operations.push(logOperation({
        email,
        memberstack_member_id: memberId,
        operation: "fill_blank_field",
        target: key,
        status: "skipped",
        result: "existing_value_kept",
        notes: "Existing value differs and was not overwritten.",
      }));
    }
  }
  if (person.cohort === "blank-last-name" && (fields["last-name"] ?? "").trim()) {
    operations.push(logOperation({
      email,
      memberstack_member_id: memberId,
      operation: "fill_blank_field",
      target: "last-name",
      status: "failed",
      result: "unexpected_last_name",
      notes: "A last name is present on an account that was required to stay blank.",
    }));
  }

  const allowedChanges = new Set(Object.keys(patch));
  if (Object.keys(patch).length) {
    try {
      await withRetry(() => client.updateMember(memberId, { customFields: patch }));
      await sleep(40);
      for (const key of Object.keys(patch)) {
        operations.push(logOperation({
          email,
          memberstack_member_id: memberId,
          operation: "fill_blank_field",
          target: key,
          status: "succeeded",
          result: "filled",
          notes: person.cohort === "existing" ? "Filled a verified blank field only." : "Filled a verified field that was still blank after create.",
        }));
      }
    } catch (error) {
      for (const key of Object.keys(patch)) {
        operations.push(logOperation({
          email,
          memberstack_member_id: memberId,
          operation: "fill_blank_field",
          target: key,
          status: "failed",
          result: "fill_failed",
          notes: safeText(error?.message || error),
        }));
      }
    }
  }

  if (existedBefore) {
    const after = await getExactMember(client, memberId, email);
    const fieldChanges = preservedFieldChanges(before, after, allowedChanges);
    const plansBefore = otherPlanSignature(before);
    const plansAfter = otherPlanSignature(after);
    if (fieldChanges.length || plansBefore !== plansAfter) {
      operations.push(logOperation({
        email,
        memberstack_member_id: memberId,
        operation: "preserve_existing",
        target: fieldChanges.join("|") || "other_plans",
        status: "failed",
        result: "unexpected_change",
        notes: fieldChanges.length ? "A field outside the blank date-joined or legacyMemberID fill changed." : "Another plan connection changed.",
      }));
    } else {
      operations.push(logOperation({
        email,
        memberstack_member_id: memberId,
        operation: "preserve_existing",
        status: "succeeded",
        result: "unchanged",
        notes: "Names, typo fields, other custom fields, and other plans stayed as they were.",
      }));
    }
  }
}

function latestOperations(operations) {
  const latest = new Map();
  for (const operation of operations) {
    latest.set(`${operation.email}|${operation.operation}|${operation.target}`, operation);
  }
  return [...latest.values()];
}

function countWhere(operations, predicate) {
  return operations.filter(predicate).length;
}

async function verifyPeople(client, people) {
  const rows = [];
  for (const person of people) {
    let member = null;
    let lookup = "ok";
    try {
      member = await getExactMember(client, person.email);
    } catch (error) {
      lookup = safeText(error?.message || error);
    }
    const fields = member ? customFieldMap(member) : {};
    rows.push({
      email: person.email,
      cohort: person.cohort,
      memberstack_member_id: member?.id || "",
      account: member ? "yes" : "no",
      plan_active: member && planState(member) === "active" ? "yes" : "no",
      lookup,
      first_name_present: member && (fields["first-name"] ?? "").trim() ? "yes" : "no",
      last_name_blank: member && !(fields["last-name"] ?? "").trim() ? "yes" : "no",
      date_joined_present: member && (fields["date-joined"] ?? "").trim() ? "yes" : "no",
      legacy_member_id_present: member && (fields.legacyMemberID ?? "").trim() ? "yes" : "no",
    });
  }
  return rows;
}

const reviewedSummary = JSON.parse(readFileSync(SUMMARY_JSON, "utf8"));
const people = classify(loadReport());
const counts = assertReviewedCohort(people);
console.log(JSON.stringify({
  phase: "preflight",
  planId: PLAN_ID,
  people: people.length,
  ...counts,
  emailsSent: false,
  reviewedPlanId: reviewedSummary.planId,
}));

const apiKey = readLiveKey();
const client = createMemberstackAdminClient({ secretKey: apiKey, fetchImpl: curlFetch });
const authProbe = await client.getMember("course-34-execute-missing@example.invalid");
if (authProbe) {
  throw new Error("Auth probe unexpectedly found a member. Refusing to write.");
}
openLog();

function loadPriorOperations() {
  if (!existsSync(OPERATION_LOG)) return [];
  const table = parseCsv(readFileSync(OPERATION_LOG, "utf8"));
  if (table.length < 2) return [];
  const header = table[0].map((cell) => cell.trim());
  return table.slice(1).map((cells) => Object.fromEntries(header.map((name, index) => [name, cells[index] ?? ""])));
}

const operations = loadPriorOperations();
let index = 0;
for (const person of people) {
  index += 1;
  try {
    await processPerson(client, person, operations);
  } catch (error) {
    operations.push(logOperation({
      email: person.email,
      operation: "person",
      status: "failed",
      result: "unexpected_error",
      notes: safeText(error?.message || error),
    }));
  }
  if (index % 25 === 0 || index === people.length) {
    const created = countWhere(operations, (row) => row.operation === "create_member" && row.result === "created");
    const failed = countWhere(operations, (row) => row.status === "failed");
    console.log(JSON.stringify({ phase: "progress", processed: index, total: people.length, created, failed }));
  }
}

console.log(JSON.stringify({ phase: "verify" }));
const verification = await verifyPeople(client, people);
writeCsv(
  VERIFY_CSV,
  ["email", "cohort", "memberstack_member_id", "account", "plan_active", "lookup", "first_name_present", "last_name_blank", "date_joined_present", "legacy_member_id_present"],
  verification,
);

const latest = latestOperations(operations);
const failures = latest.filter((row) => row.status === "failed");
const summary = {
  writesPerformed: true,
  emailsSent: false,
  passwordsLogged: false,
  planId: PLAN_ID,
  people: people.length,
  created: countWhere(latest, (row) => row.operation === "create_member" && row.result === "created"),
  blankLastNameCreated: countWhere(latest, (row) => row.operation === "create_member" && row.result === "created" && row.target === "account_plan_fields_blank_last_name"),
  blankLastNameRejected: countWhere(latest, (row) => row.result === "blank_last_name_rejected"),
  createSkippedAlreadyExisted: countWhere(latest, (row) => row.operation === "create_member" && row.status === "skipped"),
  planGrants: countWhere(latest, (row) => row.operation === "add_plan" && row.result === "granted"),
  planActiveOnCreate: countWhere(latest, (row) => row.operation === "add_plan" && row.result === "active_on_create"),
  planSkippedAlreadyActive: countWhere(latest, (row) => row.operation === "add_plan" && row.result === "already_active"),
  fieldFills: {
    "first-name": countWhere(latest, (row) => row.operation === "fill_blank_field" && row.target === "first-name" && row.result === "filled"),
    "last-name": countWhere(latest, (row) => row.operation === "fill_blank_field" && row.target === "last-name" && row.result === "filled"),
    "date-joined": countWhere(latest, (row) => row.operation === "fill_blank_field" && row.target === "date-joined" && row.result === "filled"),
    legacyMemberID: countWhere(latest, (row) => row.operation === "fill_blank_field" && row.target === "legacyMemberID" && row.result === "filled"),
  },
  fieldSkipsAlreadySet: countWhere(latest, (row) => row.operation === "fill_blank_field" && row.result === "already_set"),
  fieldValuesKept: countWhere(latest, (row) => row.operation === "fill_blank_field" && row.result === "existing_value_kept"),
  existingAccountsPreserved: countWhere(latest, (row) => row.operation === "preserve_existing" && row.result === "unchanged"),
  skips: countWhere(latest, (row) => row.status === "skipped"),
  failures: failures.length,
  failureResults: failures.reduce((map, row) => {
    map[row.result] = (map[row.result] ?? 0) + 1;
    return map;
  }, {}),
  failureRows: failures.map((row) => ({
    email: row.email,
    operation: row.operation,
    target: row.target,
    result: row.result,
    notes: row.notes,
  })),
  verification: {
    withAccount: verification.filter((row) => row.account === "yes").length,
    withActivePlan: verification.filter((row) => row.account === "yes" && row.plan_active === "yes").length,
    missingAccount: verification.filter((row) => row.account !== "yes").map((row) => row.email),
    missingPlan: verification.filter((row) => row.account === "yes" && row.plan_active !== "yes").map((row) => row.email),
    blankLastNameStillBlank: verification.filter((row) => row.cohort === "blank-last-name" && row.account === "yes" && row.last_name_blank === "yes").length,
    blankLastNameHasLastName: verification.filter((row) => row.cohort === "blank-last-name" && row.last_name_blank !== "yes").map((row) => row.email),
  },
};
writeFileSync(RESULT_JSON, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
const publicSummary = { ...summary, failureRows: undefined, verification: { ...summary.verification, missingAccount: undefined, missingPlan: undefined, blankLastNameHasLastName: undefined } };
publicSummary.verification.missingAccountCount = summary.verification.missingAccount.length;
publicSummary.verification.missingPlanCount = summary.verification.missingPlan.length;
console.log(JSON.stringify(publicSummary, null, 2));

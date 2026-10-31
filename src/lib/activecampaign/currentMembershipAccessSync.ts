/**
 * Reconcile ActiveCampaign "Current membership access" with the Watson census.
 *
 * Writes only that one field, and only for a resolved person with exactly one
 * existing contact. Does not create contacts, send email, start automations,
 * or change legacy paid-through dates or older status fields.
 *
 * Blank and unresolved stay blank. A later reminder may send only when the
 * field is explicitly "no".
 */
import type { ActiveCampaignClient } from "./client";
import { createActiveCampaignClient, getActiveCampaignConfig } from "./client";
import { isProductionActiveCampaignWriteRuntime } from "../watson/complimentaryCampaignSync";
import {
  CURRENT_MEMBERSHIP_ACCESS_FIELD,
  CURRENT_MEMBERSHIP_ACCESS_NO,
  CURRENT_MEMBERSHIP_ACCESS_YES,
  canonicalMembershipEmail,
} from "../membership/currentMembershipAccess";
import {
  loadCurrentMembershipAccessCensus,
  type CurrentMembershipAccessCensus,
} from "../membership/currentMembershipAccessCensus";

export const CURRENT_MEMBERSHIP_ACCESS_SYNC_FLAG = "CURRENT_MEMBERSHIP_ACCESS_SYNC_LIVE_ENABLED";

/** Stay inside the background-function time limit, then continue in a later run. */
export const MEMBERSHIP_ACCESS_WRITE_BATCH = 1000;

/** A run still holding the lock inside this window blocks a second worker. */
export const MEMBERSHIP_ACCESS_LOCK_MS = 16 * 60 * 1000;

export function membershipAccessBatchSize(requested: number | undefined): number {
  if (requested == null || !Number.isFinite(requested) || requested <= 0) {
    return MEMBERSHIP_ACCESS_WRITE_BATCH;
  }
  return Math.min(Math.floor(requested), MEMBERSHIP_ACCESS_WRITE_BATCH);
}

export function membershipAccessLockIsActive(
  startedAtIso: string | null | undefined,
  nowMs: number,
): boolean {
  if (!startedAtIso) return false;
  const started = Date.parse(startedAtIso);
  if (!Number.isFinite(started)) return false;
  return nowMs - started >= 0 && nowMs - started < MEMBERSHIP_ACCESS_LOCK_MS;
}

/**
 * Continue only after a live run that can still make progress.
 * A batch that writes nothing is retried twice, then stopped so a permanent
 * failure cannot chain forever. Successful writes reset that retry count.
 */
export function membershipAccessShouldChain(input: {
  liveWrite: boolean;
  fieldValuesKnown: boolean;
  truncated: boolean;
  legacyLoaded: boolean;
  written: number;
  remainingWrites: number;
  failures: number;
  retry: number;
}): boolean {
  if (!input.liveWrite || !input.fieldValuesKnown || input.truncated || !input.legacyLoaded) {
    return false;
  }
  const more = input.remainingWrites > 0 || input.failures > 0;
  if (!more) return false;
  if (input.written <= 0 && input.retry >= 2) return false;
  return true;
}

export function currentMembershipAccessSyncWillWrite(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (!isProductionActiveCampaignWriteRuntime(env)) return false;
  return env[CURRENT_MEMBERSHIP_ACCESS_SYNC_FLAG] === "true";
}

export interface MembershipAccessContact {
  id: string;
  email: string | null;
  /** Current field value when it was read. Omit when the field was not read. */
  fieldValue?: string | null;
}

export interface MembershipAccessWrite {
  email: string;
  contactId: string;
  value: "yes" | "no";
  previous: string | null;
}

export interface MembershipAccessReconciliationPlan {
  watsonYesCount: number;
  /** Contacts whose field is already yes. */
  activeCampaignYesCount: number;
  /** Yes people who would have exactly one contact after this plan is applied. */
  matchedYesCount: number;
  /** Resolved no people with exactly one contact. Their field becomes no. */
  matchedNoCount: number;
  wouldWrite: MembershipAccessWrite[];
  unchanged: number;
  /** Current members with no ActiveCampaign contact. */
  missingFromActiveCampaign: string[];
  /** Contacts already yes who are not a resolved current member. */
  missingFromWatson: Array<{ email: string; contactId: string; reason: string }>;
  unresolved: Array<{ email: string | null; reason: string }>;
  duplicateContacts: Array<{ email: string; contactIds: string[]; outcome: string }>;
}

export function planCurrentMembershipAccessUpdates(input: {
  census: CurrentMembershipAccessCensus;
  contacts: MembershipAccessContact[];
}): MembershipAccessReconciliationPlan {
  const contactsByEmail = new Map<string, MembershipAccessContact[]>();
  for (const contact of input.contacts) {
    const email = canonicalMembershipEmail(contact.email);
    if (!email) continue;
    const group = contactsByEmail.get(email) ?? [];
    group.push(contact);
    contactsByEmail.set(email, group);
  }

  const yesEmails = new Set(
    input.census.people.filter((person) => person.outcome === "yes").map((person) => person.email),
  );
  const wouldWrite: MembershipAccessWrite[] = [];
  const missingFromActiveCampaign: string[] = [];
  const unresolved: Array<{ email: string | null; reason: string }> = [];
  const duplicateContacts: Array<{ email: string; contactIds: string[]; outcome: string }> = [];
  let unchanged = 0;
  let matchedYesCount = 0;
  let matchedNoCount = 0;

  if (input.census.missingEmail > 0) {
    unresolved.push({
      email: null,
      reason: `memberstack_missing_email:${input.census.missingEmail}`,
    });
  }

  for (const person of input.census.people) {
    const contacts = contactsByEmail.get(person.email) ?? [];
    if (contacts.length > 1) {
      duplicateContacts.push({
        email: person.email,
        contactIds: contacts.map((contact) => contact.id),
        outcome: person.outcome,
      });
    }
    if (person.outcome === "unresolved" || !person.value) {
      unresolved.push({ email: person.email, reason: person.reason ?? "unresolved" });
      continue;
    }
    if (contacts.length === 0) {
      if (person.outcome === "yes") missingFromActiveCampaign.push(person.email);
      continue;
    }
    if (contacts.length > 1) continue;
    const contact = contacts[0];
    const previous = normalizeFieldValue(contact.fieldValue);
    if (person.outcome === "yes") matchedYesCount += 1;
    if (person.outcome === "no") matchedNoCount += 1;
    if (previous === person.value) {
      unchanged += 1;
      continue;
    }
    wouldWrite.push({
      email: person.email,
      contactId: contact.id,
      value: person.value,
      previous,
    });
  }

  const peopleByEmail = new Map(input.census.people.map((person) => [person.email, person]));
  const missingFromWatson: MembershipAccessReconciliationPlan["missingFromWatson"] = [];
  for (const [email, contacts] of contactsByEmail) {
    for (const contact of contacts) {
      if (normalizeFieldValue(contact.fieldValue) !== CURRENT_MEMBERSHIP_ACCESS_YES) continue;
      if (yesEmails.has(email) && contacts.length === 1) continue;
      const person = peopleByEmail.get(email);
      missingFromWatson.push({
        email,
        contactId: contact.id,
        reason:
          contacts.length > 1
            ? "duplicate_contact"
            : person?.outcome === "no"
              ? "resolved_no"
              : person?.outcome === "unresolved"
                ? (person.reason ?? "unresolved")
                : "not_in_watson_census",
      });
    }
  }

  return {
    watsonYesCount: input.census.watsonYesCount,
    activeCampaignYesCount: input.contacts.filter(
      (contact) => normalizeFieldValue(contact.fieldValue) === CURRENT_MEMBERSHIP_ACCESS_YES,
    ).length,
    matchedYesCount,
    matchedNoCount,
    wouldWrite,
    unchanged,
    missingFromActiveCampaign,
    missingFromWatson,
    unresolved,
    duplicateContacts,
  };
}

function writePriority(write: MembershipAccessWrite): number {
  if (write.value === CURRENT_MEMBERSHIP_ACCESS_YES) return 0;
  if (write.previous === CURRENT_MEMBERSHIP_ACCESS_YES) return 1;
  return 2;
}

function normalizeFieldValue(value: string | null | undefined): string | null {
  const trimmed = value?.trim().toLowerCase() ?? "";
  if (trimmed === CURRENT_MEMBERSHIP_ACCESS_YES || trimmed === CURRENT_MEMBERSHIP_ACCESS_NO) {
    return trimmed;
  }
  return trimmed ? trimmed : null;
}

export interface CurrentMembershipAccessSyncResult {
  ok: boolean;
  liveWrite: boolean;
  census: CurrentMembershipAccessCensus | null;
  plan: MembershipAccessReconciliationPlan | null;
  fieldReady: boolean;
  /** ActiveCampaign id of the exact "Current membership access" field. */
  fieldId: string | null;
  /** False when existing field values could not be listed, so the ActiveCampaign yes count is not a measurement. */
  fieldValuesKnown: boolean;
  written: number;
  /** Writes still required after this invocation. */
  remainingWrites: number;
  failures: Array<{ email: string; error: string }>;
  errorMessage: string | null;
  /** Sample checks. Emails are the canonical mailbox. */
  samples: Array<{ email: string; outcome: string; contactValue: string | null }>;
}

async function listAllContacts(
  client: ActiveCampaignClient,
): Promise<MembershipAccessContact[]> {
  if (!client.listContacts) {
    throw new Error("ActiveCampaign contact list is not available.");
  }
  const contacts: MembershipAccessContact[] = [];
  for (let offset = 0; offset < 100_000; offset += 100) {
    const batch = await client.listContacts({ offset, limit: 100 });
    contacts.push(...batch);
    if (batch.length < 100) break;
  }
  return contacts;
}

async function attachFieldValues(
  client: ActiveCampaignClient,
  contacts: MembershipAccessContact[],
  fieldId: string | null,
): Promise<{ contacts: MembershipAccessContact[]; known: boolean }> {
  const blank = contacts.map((contact) => ({ ...contact, fieldValue: null }));
  if (!fieldId || !client.listFieldValues) {
    return { contacts: blank, known: !fieldId };
  }
  const listed = await client.listFieldValues(fieldId);
  if (!listed) return { contacts: blank, known: false };
  const byContact = new Map(listed.map((entry) => [entry.contactId, entry.value]));
  return {
    known: true,
    contacts: contacts.map((contact) => ({
      ...contact,
      fieldValue: byContact.get(contact.id) ?? null,
    })),
  };
}

export async function runCurrentMembershipAccessSync(
  options: {
    liveWrite?: boolean;
    /** Limit this invocation so a large backfill can continue on the next run. */
    maxWrites?: number;
    census?: CurrentMembershipAccessCensus;
    activeCampaign?: ActiveCampaignClient;
    env?: NodeJS.ProcessEnv;
    sampleEmails?: string[];
  } = {},
): Promise<CurrentMembershipAccessSyncResult> {
  const liveWrite = options.liveWrite ?? false;
  const result: CurrentMembershipAccessSyncResult = {
    ok: false,
    liveWrite,
    census: null,
    plan: null,
    fieldReady: false,
    fieldId: null,
    fieldValuesKnown: false,
    written: 0,
    remainingWrites: 0,
    failures: [],
    errorMessage: null,
    samples: [],
  };

  try {
    const census = options.census ?? (await loadCurrentMembershipAccessCensus());
    result.census = census;
    if (census.memberstackTruncated || !census.legacyLoaded) {
      result.errorMessage = census.memberstackTruncated
        ? "Memberstack scan was truncated, so missing accounts cannot be treated as non-members."
        : "Watson legacy dates did not load, so access that depends on them is unresolved.";
      return result;
    }

    let client = options.activeCampaign ?? null;
    if (!client) {
      const config = getActiveCampaignConfig(options.env);
      if (!config) {
        result.errorMessage = "Missing ACTIVECAMPAIGN_API_KEY or ACTIVECAMPAIGN_BASE_URL.";
        return result;
      }
      client = createActiveCampaignClient(config);
    }
    if (!client.resolveFieldId || !client.listContacts || !client.writeFieldValue) {
      result.errorMessage = "ActiveCampaign field sync is not available.";
      return result;
    }

    const fieldId = await client.resolveFieldId(CURRENT_MEMBERSHIP_ACCESS_FIELD, {
      create: false,
      type: "text",
    });
    result.fieldId = fieldId;
    result.fieldReady = Boolean(fieldId);
    const contacts = await listAllContacts(client);
    const attached = await attachFieldValues(client, contacts, fieldId);
    result.fieldValuesKnown = attached.known;
    const withValues = attached.contacts;
    const plan = planCurrentMembershipAccessUpdates({ census, contacts: withValues });
    result.plan = plan;

    if (!liveWrite) {
      result.remainingWrites = plan.wouldWrite.length;
      result.samples = sampleResults(census, withValues, options.sampleEmails ?? []);
      result.ok = true;
      return result;
    }
    if (fieldId && !attached.known) {
      result.errorMessage =
        "Existing Current membership access values could not be listed, so a contact already marked yes cannot be changed to no. No contacts were written.";
      result.remainingWrites = plan.wouldWrite.length;
      return result;
    }
    let writeFieldId = fieldId;
    if (!writeFieldId) {
      writeFieldId = await client.resolveFieldId(CURRENT_MEMBERSHIP_ACCESS_FIELD, {
        create: true,
        type: "text",
      });
      result.fieldReady = Boolean(writeFieldId);
      result.fieldId = writeFieldId;
    }
    if (!writeFieldId) {
      result.errorMessage = `Create a text field named "${CURRENT_MEMBERSHIP_ACCESS_FIELD}" before writing contacts.`;
      return result;
    }
    if (plan.duplicateContacts.length > 0 && plan.wouldWrite.length === 0 && plan.watsonYesCount > 0) {
      result.errorMessage = "Duplicate ActiveCampaign contacts blocked the write.";
      return result;
    }

    const orderedWrites = [...plan.wouldWrite].sort((a, b) => writePriority(a) - writePriority(b));
    const batch =
      options.maxWrites && options.maxWrites > 0
        ? orderedWrites.slice(0, options.maxWrites)
        : orderedWrites;
    for (const write of batch) {
      try {
        await client.writeFieldValue(write.contactId, writeFieldId, write.value);
        result.written += 1;
      } catch (error) {
        result.failures.push({
          email: write.email,
          error: error instanceof Error ? error.message.slice(0, 300) : "write failed",
        });
      }
    }

    if (client.readFieldValue && options.sampleEmails?.length) {
      const refreshed: MembershipAccessContact[] = [];
      for (const email of options.sampleEmails) {
        const key = canonicalMembershipEmail(email);
        const contact = contacts.find((item) => canonicalMembershipEmail(item.email) === key);
        if (!contact) continue;
        refreshed.push({
          ...contact,
          fieldValue: await client.readFieldValue(contact.id, writeFieldId),
        });
      }
      result.samples = sampleResults(census, refreshed, options.sampleEmails);
    } else {
      result.samples = sampleResults(census, withValues, options.sampleEmails ?? []);
    }

    result.remainingWrites = Math.max(0, plan.wouldWrite.length - result.written);
    result.ok = result.failures.length === 0;
    return result;
  } catch (error) {
    result.errorMessage = error instanceof Error ? error.message.slice(0, 300) : "Sync failed.";
    return result;
  }
}

function sampleResults(
  census: CurrentMembershipAccessCensus,
  contacts: MembershipAccessContact[],
  emails: string[],
): CurrentMembershipAccessSyncResult["samples"] {
  return emails.map((email) => {
    const key = canonicalMembershipEmail(email);
    const person = census.people.find((item) => item.email === key);
    const contact = contacts.find((item) => canonicalMembershipEmail(item.email) === key);
    return {
      email: key ?? email,
      outcome: person?.outcome ?? "not_in_census",
      contactValue: contact?.fieldValue ?? null,
    };
  });
}


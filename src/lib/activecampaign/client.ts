/**
 * Minimal ActiveCampaign v3 Admin API client.
 *
 * This is a standalone client used by the legacy renewal reminder job. It is
 * intentionally separate from `netlify/functions/memberstack-created.ts` (the
 * signup webhook) so that working webhook behavior is never touched.
 *
 * Auth matches the existing signup webhook: header `Api-Token` + a base URL that
 * ends without a trailing slash, then `${baseUrl}/api/3/...`.
 */

export interface ActiveCampaignConfig {
  baseUrl: string;
  apiKey: string;
}

/** Per-list subscription status for a contact. */
export type ActiveCampaignListStatus =
  | "active"
  | "unsubscribed"
  | "unconfirmed"
  | "bounced"
  | "not_on_list"
  | "unknown";

/** The narrow surface the reminder job depends on (mockable in tests). */
export interface ActiveCampaignClient {
  /** Confirm a list id exists. Used to fail fast instead of guessing/creating. */
  listExists(listId: string): Promise<boolean>;
  /** Find a contact by exact email. Returns null when not present. */
  findContactByEmail(email: string): Promise<{ id: string } | null>;
  /** Create or update a contact (and optionally write custom field values). */
  syncContact(input: {
    email: string;
    firstName?: string;
    fieldValues?: Array<{ field: string; value: string }>;
  }): Promise<{ id: string }>;
  /** Read the contact's status on a specific list. */
  getListStatus(contactId: string, listId: string): Promise<ActiveCampaignListStatus>;
  /** Subscribe a contact to a list (status = 1). Never call for an unsubscribed contact. */
  subscribeToList(contactId: string, listId: string): Promise<void>;
  /** Resolve a tag id by name, optionally creating it when missing. */
  resolveTagId(tagName: string, options?: { create?: boolean }): Promise<string | null>;
  /** True when the contact already has the given tag id. */
  contactHasTag(contactId: string, tagId: string): Promise<boolean>;
  /** Apply a tag to a contact. */
  addTag(contactId: string, tagId: string): Promise<void>;
}

/** Read AC credentials from the environment (same vars as the signup webhook). */
export function getActiveCampaignConfig(
  env: NodeJS.ProcessEnv = process.env,
): ActiveCampaignConfig | null {
  const apiKey = (env.ACTIVECAMPAIGN_API_KEY || "").trim();
  const baseUrl = (env.ACTIVECAMPAIGN_BASE_URL || "").trim().replace(/\/$/, "");
  if (!apiKey || !baseUrl) {
    return null;
  }
  return { baseUrl, apiKey };
}

interface AcContact {
  id: string;
}
interface AcContactsResponse {
  contacts?: AcContact[];
}
interface AcContactSyncResponse {
  contact?: AcContact;
}
interface AcTag {
  id: string;
  tag: string;
}
interface AcTagsResponse {
  tags?: AcTag[];
}
interface AcTagResponse {
  tag?: AcTag;
}
interface AcContactListLink {
  list?: string;
  status?: string | number;
}
interface AcContactListsResponse {
  contactLists?: AcContactListLink[];
}
interface AcContactTagLink {
  tag?: string;
}
interface AcContactTagsResponse {
  contactTags?: AcContactTagLink[];
}

function mapListStatus(status: string | number | undefined): ActiveCampaignListStatus {
  switch (String(status ?? "")) {
    case "1":
      return "active";
    case "2":
      return "unsubscribed";
    case "0":
      return "unconfirmed";
    case "3":
      return "bounced";
    default:
      return "unknown";
  }
}

/** Build the real HTTP-backed client. `fetchImpl` is injectable for tests. */
export function createActiveCampaignClient(
  config: ActiveCampaignConfig,
  fetchImpl: typeof fetch = fetch,
): ActiveCampaignClient {
  async function request(path: string, init: RequestInit = {}): Promise<Response> {
    return fetchImpl(`${config.baseUrl}${path}`, {
      ...init,
      headers: {
        "Api-Token": config.apiKey,
        "Content-Type": "application/json",
        ...(init.headers as Record<string, string> | undefined),
      },
    });
  }

  async function readJson<T>(resp: Response, context: string): Promise<T> {
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new Error(`ActiveCampaign ${context} failed (HTTP ${resp.status}): ${text}`);
    }
    return (await resp.json()) as T;
  }

  return {
    async listExists(listId: string): Promise<boolean> {
      const resp = await request(`/api/3/lists/${encodeURIComponent(listId)}`);
      if (resp.ok) return true;
      if (resp.status === 404) return false;
      const text = await resp.text().catch(() => "");
      throw new Error(`ActiveCampaign list lookup failed (HTTP ${resp.status}): ${text}`);
    },

    async findContactByEmail(email: string): Promise<{ id: string } | null> {
      const resp = await request(`/api/3/contacts?email=${encodeURIComponent(email)}`);
      const data = await readJson<AcContactsResponse>(resp, "contact lookup");
      const contact = (data.contacts ?? [])[0];
      return contact?.id ? { id: contact.id } : null;
    },

    async syncContact(input): Promise<{ id: string }> {
      const contact: Record<string, unknown> = { email: input.email };
      if (input.firstName) contact.firstName = input.firstName;
      if (input.fieldValues && input.fieldValues.length > 0) {
        contact.fieldValues = input.fieldValues;
      }
      const resp = await request("/api/3/contact/sync", {
        method: "POST",
        body: JSON.stringify({ contact }),
      });
      const data = await readJson<AcContactSyncResponse>(resp, "contact sync");
      const id = data.contact?.id;
      if (!id) {
        throw new Error("ActiveCampaign contact sync returned no contact id");
      }
      return { id };
    },

    async getListStatus(contactId, listId): Promise<ActiveCampaignListStatus> {
      const resp = await request(
        `/api/3/contacts/${encodeURIComponent(contactId)}/contactLists`,
      );
      const data = await readJson<AcContactListsResponse>(resp, "contact list read");
      const link = (data.contactLists ?? []).find(
        (entry) => String(entry.list ?? "") === String(listId),
      );
      if (!link) return "not_on_list";
      return mapListStatus(link.status);
    },

    async subscribeToList(contactId, listId): Promise<void> {
      const resp = await request("/api/3/contactLists", {
        method: "POST",
        body: JSON.stringify({
          contactList: { list: listId, contact: contactId, status: 1 },
        }),
      });
      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        throw new Error(`ActiveCampaign list subscribe failed (HTTP ${resp.status}): ${text}`);
      }
    },

    async resolveTagId(tagName, options = {}): Promise<string | null> {
      const searchResp = await request(
        `/api/3/tags?search=${encodeURIComponent(tagName)}`,
      );
      if (searchResp.ok) {
        const data = (await searchResp.json()) as AcTagsResponse;
        const existing = (data.tags ?? []).find((tag) => tag.tag === tagName);
        if (existing?.id) return existing.id;
      }
      if (!options.create) return null;

      const createResp = await request("/api/3/tags", {
        method: "POST",
        body: JSON.stringify({ tag: { tag: tagName, tagType: "contact" } }),
      });
      if (createResp.ok) {
        const data = (await createResp.json()) as AcTagResponse;
        if (data.tag?.id) return data.tag.id;
      }
      // A conflict can happen if the tag already exists but the search missed it.
      const retryResp = await request(
        `/api/3/tags?search=${encodeURIComponent(tagName)}`,
      );
      if (retryResp.ok) {
        const data = (await retryResp.json()) as AcTagsResponse;
        const retry = (data.tags ?? []).find((tag) => tag.tag === tagName);
        if (retry?.id) return retry.id;
      }
      return null;
    },

    async contactHasTag(contactId, tagId): Promise<boolean> {
      const resp = await request(
        `/api/3/contacts/${encodeURIComponent(contactId)}/contactTags`,
      );
      const data = await readJson<AcContactTagsResponse>(resp, "contact tag read");
      return (data.contactTags ?? []).some(
        (link) => String(link.tag ?? "") === String(tagId),
      );
    },

    async addTag(contactId, tagId): Promise<void> {
      const resp = await request("/api/3/contactTags", {
        method: "POST",
        body: JSON.stringify({ contactTag: { contact: contactId, tag: tagId } }),
      });
      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        throw new Error(`ActiveCampaign apply tag failed (HTTP ${resp.status}): ${text}`);
      }
    },
  };
}

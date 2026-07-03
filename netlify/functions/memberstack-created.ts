import "dotenv/config";

const KIN_SIGNUP_TAG_NAME = "source:KIN 2026 signup";
const LEARNDAK_SIGNUP_TAG_NAME = "source: Learn DAK";

// LearnDAK grants this free plan to every account it creates at signup. Because
// LearnDAK and Knit It Now share this Memberstack app, its presence in the
// created member's planConnections is how we tell a LearnDAK signup apart from a
// Knit It Now signup (KIN's public signup attaches no plan).
const LEARNDAK_FREE_PLAN_ID = "pln_dak-quick-start-vp4e0are";

interface MemberstackWebhookBody {
  payload?: {
    auth?: {
      email?: string;
    };
    customFields?: Record<string, string>;
    planConnections?: Array<{ planId?: string } | null>;
  };
}

interface AcTag {
  id: string;
  tag: string;
}

interface AcContactSyncResponse {
  contact: {
    id: string;
  };
}

interface AcTagsResponse {
  tags: AcTag[];
}

interface AcTagResponse {
  tag: AcTag;
}

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function getActiveCampaignConfig(): { baseUrl: string; apiKey: string } | null {
  const apiKey = (process.env.ACTIVECAMPAIGN_API_KEY || "").trim();
  const baseUrl = (process.env.ACTIVECAMPAIGN_BASE_URL || "")
    .trim()
    .replace(/\/$/, "");

  if (!apiKey || !baseUrl) {
    return null;
  }

  return { baseUrl, apiKey };
}

async function activeCampaignRequest(
  baseUrl: string,
  apiKey: string,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Api-Token": apiKey,
      "Content-Type": "application/json",
      ...(init.headers as Record<string, string> | undefined),
    },
  });
}

// Look up the given source tag by name, creating it if it does not exist.
// Returns the tag id, or null if it could not be resolved (caller stays
// defensive and skips tagging rather than failing the webhook).
async function resolveNewAccountTagId(
  baseUrl: string,
  apiKey: string,
  tagName: string,
): Promise<string | null> {
  try {
    const tagsResp = await activeCampaignRequest(
      baseUrl,
      apiKey,
      `/api/3/tags?search=${encodeURIComponent(tagName)}`,
    );

    if (tagsResp.ok) {
      const tagsData = (await tagsResp.json()) as AcTagsResponse;
      const existingTag = (tagsData.tags ?? []).find(
        (tag) => tag.tag === tagName,
      );
      if (existingTag?.id) {
        return existingTag.id;
      }
    } else {
      const tagsErrorText = await tagsResp.text();
      console.error("memberstack-created: tag search failed", {
        status: tagsResp.status,
        body: tagsErrorText,
      });
    }

    const createResp = await activeCampaignRequest(baseUrl, apiKey, "/api/3/tags", {
      method: "POST",
      body: JSON.stringify({
        tag: {
          tag: tagName,
          tagType: "contact",
        },
      }),
    });

    if (createResp.ok) {
      const createData = (await createResp.json()) as AcTagResponse;
      if (createData.tag?.id) {
        return createData.tag.id;
      }
    } else {
      const createErrorText = await createResp.text();
      console.error("memberstack-created: tag create failed", {
        status: createResp.status,
        body: createErrorText,
      });

      // A conflict (or similar) can occur if the tag already exists but was
      // missed by the search above; try one more lookup before giving up.
      const retryResp = await activeCampaignRequest(
        baseUrl,
        apiKey,
        `/api/3/tags?search=${encodeURIComponent(tagName)}`,
      );
      if (retryResp.ok) {
        const retryData = (await retryResp.json()) as AcTagsResponse;
        const retryTag = (retryData.tags ?? []).find(
          (tag) => tag.tag === tagName,
        );
        if (retryTag?.id) {
          return retryTag.id;
        }
      }
    }
  } catch (error) {
    console.error("memberstack-created: tag resolve error", error);
  }

  return null;
}

export default async (req: Request): Promise<Response> => {
  console.log("memberstack-created: function started");

  const hasActiveCampaignApiKey = Boolean(
    (process.env.ACTIVECAMPAIGN_API_KEY || "").trim(),
  );
  const activeCampaignBaseUrl = (process.env.ACTIVECAMPAIGN_BASE_URL || "")
    .trim()
    .replace(/\/$/, "");
  const hasActiveCampaignBaseUrl = Boolean(activeCampaignBaseUrl);

  console.log("memberstack-created: ActiveCampaign env", {
    hasActiveCampaignApiKey,
    hasActiveCampaignBaseUrl,
    activeCampaignBaseUrl,
  });

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const config = getActiveCampaignConfig();
  if (!config) {
    console.error(
      "memberstack-created: missing ACTIVECAMPAIGN_API_KEY or ACTIVECAMPAIGN_BASE_URL",
    );
    return jsonResponse({ error: "Server configuration error" }, 500);
  }

  const { baseUrl, apiKey } = config;

  let body: MemberstackWebhookBody;
  try {
    body = (await req.json()) as MemberstackWebhookBody;
  } catch (parseError) {
    console.error("memberstack-created: invalid JSON body", parseError);
    return jsonResponse({ error: "Invalid request body" }, 400);
  }

  console.log("memberstack-created: webhook body keys", {
    topLevelKeys: Object.keys(body),
    payloadKeys: body.payload ? Object.keys(body.payload) : undefined,
  });

  const email = body.payload?.auth?.email?.trim();

  console.log("memberstack-created: extracted email", { email });

  if (!email) {
    console.warn("memberstack-created: missing payload.auth.email");
    return jsonResponse({ error: "Missing member email" }, 400);
  }

  const firstNameRaw = body.payload?.customFields?.["first-name"];
  const firstName =
    typeof firstNameRaw === "string" ? firstNameRaw.trim() : undefined;

  // Choose the source tag by signup origin. LearnDAK attaches its free plan at
  // signup, so a matching planConnection marks the member as a LearnDAK signup;
  // everything else is treated as a Knit It Now signup. This only affects which
  // source tag is applied — plan assignment, redirects, and paid membership
  // logic are untouched.
  const isLearnDakSignup = (body.payload?.planConnections ?? []).some(
    (connection) => connection?.planId === LEARNDAK_FREE_PLAN_ID,
  );
  const sourceTagName = isLearnDakSignup
    ? LEARNDAK_SIGNUP_TAG_NAME
    : KIN_SIGNUP_TAG_NAME;

  console.log("memberstack-created: processing member", {
    email,
    hasFirstName: Boolean(firstName),
    isLearnDakSignup,
    sourceTagName,
  });

  try {
    const contactPayload: { email: string; firstName?: string } = { email };
    if (firstName) {
      contactPayload.firstName = firstName;
    }

    const syncResp = await activeCampaignRequest(
      baseUrl,
      apiKey,
      "/api/3/contact/sync",
      {
        method: "POST",
        body: JSON.stringify({ contact: contactPayload }),
      },
    );

    if (!syncResp.ok) {
      const syncErrorText = await syncResp.text();
      console.error("memberstack-created: contact sync failed", {
        status: syncResp.status,
        body: syncErrorText,
      });
      return jsonResponse({ error: "Internal server error" }, 500);
    }

    const syncData = (await syncResp.json()) as AcContactSyncResponse;
    const contactId = syncData.contact?.id;
    if (!contactId) {
      console.error("memberstack-created: sync response missing contact id", {
        syncData,
      });
      return jsonResponse({ error: "Internal server error" }, 500);
    }

    console.log("memberstack-created: contact synced", { contactId, email });

    // Tagging is best-effort: the contact is already synced, so a tag
    // lookup/create/apply failure should not fail the whole webhook.
    const tagId = await resolveNewAccountTagId(baseUrl, apiKey, sourceTagName);

    if (!tagId) {
      console.warn("memberstack-created: proceeding without new-account tag", {
        contactId,
        email,
      });
      return jsonResponse(
        {
          ok: true,
          contactId,
          tagged: false,
        },
        200,
      );
    }

    console.log("memberstack-created: applying new-account tag", {
      contactId,
      tagId,
    });

    const tagResp = await activeCampaignRequest(
      baseUrl,
      apiKey,
      "/api/3/contactTags",
      {
        method: "POST",
        body: JSON.stringify({
          contactTag: {
            contact: contactId,
            tag: tagId,
          },
        }),
      },
    );

    if (!tagResp.ok) {
      const tagErrorText = await tagResp.text();
      console.error("memberstack-created: apply tag failed", {
        status: tagResp.status,
        body: tagErrorText,
      });
      return jsonResponse(
        {
          ok: true,
          contactId,
          tagged: false,
        },
        200,
      );
    }

    console.log("memberstack-created: success", { contactId, email });

    return jsonResponse(
      {
        ok: true,
        contactId,
        tagged: true,
        tag: sourceTagName,
      },
      200,
    );
  } catch (error) {
    console.error("memberstack-created: unexpected error", error);
    console.error(
      "memberstack-created: error message",
      error instanceof Error ? error.message : String(error),
    );
    return jsonResponse({ error: "Internal server error" }, 500);
  }
};

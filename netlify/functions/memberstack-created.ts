import "dotenv/config";

const BETA_TAG_NAME = "Beta";

interface MemberstackWebhookBody {
  payload?: {
    auth?: {
      email?: string;
    };
    customFields?: Record<string, string>;
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

  console.log("memberstack-created: processing member", {
    email,
    hasFirstName: Boolean(firstName),
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

    const tagsResp = await activeCampaignRequest(
      baseUrl,
      apiKey,
      `/api/3/tags?search=${encodeURIComponent(BETA_TAG_NAME)}`,
    );

    if (!tagsResp.ok) {
      const tagsErrorText = await tagsResp.text();
      console.error("memberstack-created: tag search failed", {
        status: tagsResp.status,
        body: tagsErrorText,
      });
      return jsonResponse({ error: "Internal server error" }, 500);
    }

    const tagsData = (await tagsResp.json()) as AcTagsResponse;
    const betaTag = (tagsData.tags ?? []).find(
      (tag) => tag.tag === BETA_TAG_NAME,
    );

    if (!betaTag) {
      console.error("memberstack-created: beta tag not found", {
        tagCount: tagsData.tags?.length ?? 0,
      });
      return jsonResponse({ error: "Internal server error" }, 500);
    }

    console.log("memberstack-created: applying beta tag", {
      contactId,
      tagId: betaTag.id,
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
            tag: betaTag.id,
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
      return jsonResponse({ error: "Internal server error" }, 500);
    }

    console.log("memberstack-created: success", { contactId, email });

    return jsonResponse(
      {
        ok: true,
        contactId,
        tag: BETA_TAG_NAME,
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

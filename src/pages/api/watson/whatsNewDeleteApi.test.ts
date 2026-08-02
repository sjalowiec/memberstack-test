import { afterEach, describe, expect, it } from "vitest";

import { createWatsonSessionToken, WATSON_SESSION_COOKIE } from "../../../lib/watson/watsonAuth";
import { DELETE } from "./whats-new/[id]";

type DeleteContext = Parameters<typeof DELETE>[0];

const TEST_PASSWORD = "delete-route-test-password";

function buildContext(overrides: Partial<DeleteContext> = {}): DeleteContext {
  return {
    cookies: { get: () => undefined },
    params: { id: "card-1" },
    request: new Request("http://localhost/api/watson/whats-new/card-1", {
      method: "DELETE",
    }),
    ...overrides,
  } as unknown as DeleteContext;
}

function authedCookies(): DeleteContext["cookies"] {
  const token = createWatsonSessionToken(TEST_PASSWORD);
  return {
    get: (name: string) =>
      name === WATSON_SESSION_COOKIE ? { value: token } : undefined,
  } as unknown as DeleteContext["cookies"];
}

describe("Watson What's New DELETE route", () => {
  afterEach(() => {
    Reflect.deleteProperty(
      import.meta.env as Record<string, unknown>,
      "WATSON_ADMIN_PASSWORD",
    );
  });

  it("rejects unauthorized requests with 401 before touching the database", async () => {
    const res = await DELETE(buildContext());
    expect(res.status).toBe(401);
    const body = (await res.json()) as { ok?: boolean; error?: string };
    expect(body.ok).toBe(false);
    expect(body.error).toBe("Sign in required.");
  });

  it("rejects an authorized request with a blank card id as 400", async () => {
    (import.meta.env as Record<string, unknown>).WATSON_ADMIN_PASSWORD = TEST_PASSWORD;
    const res = await DELETE(
      buildContext({
        cookies: authedCookies(),
        params: { id: "   " },
      } as Partial<DeleteContext>),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { ok?: boolean; error?: string };
    expect(body.ok).toBe(false);
    expect(body.error).toBe("Card id is required.");
  });
});

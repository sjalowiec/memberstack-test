import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAdminForRequest = vi.hoisted(() => vi.fn());
const getPatternErrataById = vi.hoisted(() => vi.fn());
const store = vi.hoisted(() => ({
  list: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
}));

vi.mock("../../admin/requireAdminRequest", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../admin/requireAdminRequest")>();
  return { ...actual, requireAdminForRequest };
});

vi.mock("./patternErrataStore", () => ({
  getPatternErrataById,
}));

vi.mock("@netlify/blobs", () => ({
  getStore: () => store,
}));

import { GET as impactGet } from "../../../pages/api/admin/pattern-errata/[id]/impact";
import { BABY_KIDS_LENGTH_MATCH_RULES } from "./babyKidsLengthErrata";
import { loadPatternErrataImpactReport, memberstackHeadersIfAlreadyReady } from "./patternErrataImpactPanel";
import { createWatsonSessionToken, WATSON_SESSION_COOKIE } from "../../watson/watsonAuth";

const ERRATA_ID = "6f3c1a90-7b24-4e1d-9a55-0c8e2b7d4f61";
const WATSON_PASSWORD = "panel-watson-only-password";

class El {
  textContent = "";
  className = "";
  children: El[] = [];
  dataset: { impactId?: string } = {};
  constructor(readonly tag: string) {}
  append(...nodes: El[]) {
    this.children.push(...nodes);
  }
  replaceChildren() {
    this.children = [];
    this.textContent = "";
  }
}

function visibleText(node: El): string {
  return [node.textContent, ...node.children.map(visibleText)].filter(Boolean).join(" ");
}

function panel() {
  const impact = new El("p");
  impact.dataset.impactId = ERRATA_ID;
  return impact;
}

function sweater(options: {
  id: string;
  owner: string;
  audience: string;
  size: string;
  length: number;
  createdAt: string;
}) {
  return {
    key: `sleeveless/${options.owner}/${options.id}.json`,
    body: JSON.stringify({
      id: options.id,
      name: options.id,
      createdAt: options.createdAt,
      pattern: {
        patternType: "sleeveless",
        style: {
          construction: "drop-shoulder",
          constructionAuthored: "drop-shoulder",
          recipientCategory: options.audience,
        },
        fit: {
          sizingChart: options.audience,
          selectedSize: options.size,
          selectedMeasurements: { back_neck_to_hem: options.length },
        },
      },
    }),
  };
}

const files = [
  sweater({
    id: "old-baby",
    owner: "member-a",
    audience: "baby",
    size: "3 mo",
    length: 6,
    createdAt: "2026-02-01T00:00:00.000Z",
  }),
  sweater({
    id: "old-kids",
    owner: "member-a",
    audience: "kids",
    size: "4 yr",
    length: 19.5,
    createdAt: "2026-02-02T00:00:00.000Z",
  }),
  sweater({
    id: "custom",
    owner: "member-b",
    audience: "baby",
    size: "6 mo",
    length: 11,
    createdAt: "2026-02-03T00:00:00.000Z",
  }),
];

describe("pattern errata impact page with a Watson-only admin session", () => {
  beforeEach(() => {
    requireAdminForRequest.mockReset();
    getPatternErrataById.mockReset();
    store.list.mockReset();
    store.get.mockReset();
    store.set.mockReset();
    store.list.mockResolvedValue({ blobs: files.map((file) => ({ key: file.key })) });
    store.get.mockImplementation(async (key: string) => files.find((file) => file.key === key)?.body ?? null);
    getPatternErrataById.mockResolvedValue({
      id: ERRATA_ID,
      affectedBuilders: ["drop-shoulder", "sleeveless"],
      matchRules: BABY_KIDS_LENGTH_MATCH_RULES,
    });
    Reflect.deleteProperty(import.meta.env as Record<string, unknown>, "WATSON_ADMIN_PASSWORD");
  });

  it("renders scanned counts without waiting for Memberstack", async () => {
    (import.meta.env as Record<string, unknown>).WATSON_ADMIN_PASSWORD = WATSON_PASSWORD;
    requireAdminForRequest.mockResolvedValue({
      ok: false,
      status: 401,
      error: "Sign in required.",
    });
    const token = createWatsonSessionToken(WATSON_PASSWORD);
    const headers = await memberstackHeadersIfAlreadyReady();
    expect(headers).toEqual({});

    const impact = panel();
    await loadPatternErrataImpactReport(impact, {
      getHeaders: async () => ({}),
      createElement: (tag) => new El(tag),
      fetchImpl: async (input, init) => {
        const requestInit = init as RequestInit & { headers?: Record<string, string> };
        expect(String(input)).toBe(`/api/admin/pattern-errata/${ERRATA_ID}/impact`);
        expect(requestInit.credentials).toBe("same-origin");
        expect(requestInit.headers?.Authorization).toBeUndefined();
        return impactGet({
          request: new Request(`https://knititnow.com${String(input)}`, { method: "GET" }),
          cookies: {
            get: (name: string) => (name === WATSON_SESSION_COOKIE ? { value: token } : undefined),
          },
          params: { id: ERRATA_ID },
        } as never);
      },
    });

    const text = visibleText(impact);
    expect(text).toContain("Scanned 3 saved patterns.");
    expect(text).toContain("Potentially affected: 2 patterns, 1 owners.");
    expect(text).toContain("Customized: 1 patterns, 1 owners.");
    expect(text).not.toContain("Sign in with your Knit it Now account");
    expect(store.set).not.toHaveBeenCalled();
  });

  it("shows the server denial for a signed-out visitor and does not scan", async () => {
    requireAdminForRequest.mockResolvedValue({
      ok: false,
      status: 401,
      error: "Sign in required.",
    });
    const impact = panel();
    await loadPatternErrataImpactReport(impact, {
      getHeaders: async () => ({}),
      createElement: (tag) => new El(tag),
      fetchImpl: (input) =>
        impactGet({
          request: new Request(`https://knititnow.com${String(input)}`),
          cookies: { get: () => undefined },
          params: { id: ERRATA_ID },
        } as never),
    });
    expect(impact.textContent).toBe("Sign in required.");
    expect(getPatternErrataById).not.toHaveBeenCalled();
    expect(store.list).not.toHaveBeenCalled();
  });

  it("shows the server denial for a signed-in non-admin and does not scan", async () => {
    requireAdminForRequest.mockResolvedValue({
      ok: false,
      status: 403,
      error: "Admin access required.",
    });
    const impact = panel();
    await loadPatternErrataImpactReport(impact, {
      getHeaders: async () => ({ Authorization: "Bearer member-token" }),
      createElement: (tag) => new El(tag),
      fetchImpl: (input, init) => {
        expect((init as { headers?: Record<string, string> }).headers?.Authorization).toBe(
          "Bearer member-token",
        );
        return impactGet({
          request: new Request(`https://knititnow.com${String(input)}`, {
            headers: { Authorization: "Bearer member-token" },
          }),
          cookies: { get: () => undefined },
          params: { id: ERRATA_ID },
        } as never);
      },
    });
    expect(impact.textContent).toBe("Admin access required.");
    expect(store.list).not.toHaveBeenCalled();
  });

  it("keeps correction saving behind Memberstack and loads impact without it", () => {
    const page = readFileSync(
      join(process.cwd(), "src/pages/admin/pattern-errata/edit.astro"),
      "utf8",
    );
    const save = page.slice(page.indexOf("form?.addEventListener"), page.indexOf("if (impact)"));
    expect(save).toContain("fetchAdminJson");
    expect(save).not.toContain("allowMissingToken");
    expect(page).toContain("loadPatternErrataImpactReport(impact)");
    expect(page).not.toContain("waitForMemberstackDom");
  });
});

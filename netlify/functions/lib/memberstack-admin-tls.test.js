import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./local-dotenv.js", () => ({
  readDotEnvValue: vi.fn(() => null),
  clearLocalDotEnvCache: vi.fn(),
}));

import {
  applyMemberstackLocalTlsInsecureIfRequested,
  createMemberstackAdminClient,
  describeGetMemberOperation,
  extractFetchErrorCode,
  redactMemberstackSecrets,
  resetMemberstackTlsInsecureStateForTests,
  resolveMemberstackAdminFetchImpl,
  sanitizeMemberstackErrorDiagnostic,
  shouldUseMemberstackTlsInsecure,
} from "./memberstack-admin.js";

const ENV_KEYS = ["MEMBERSTACK_TLS_INSECURE", "NODE_ENV", "CONTEXT", "NODE_TLS_REJECT_UNAUTHORIZED"];
let savedEnv = {};

beforeEach(() => {
  savedEnv = {};
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
  resetMemberstackTlsInsecureStateForTests();
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  resetMemberstackTlsInsecureStateForTests();
  vi.restoreAllMocks();
});

describe("Memberstack Admin local TLS opt-in", () => {
  it("keeps secure TLS as the default", () => {
    expect(shouldUseMemberstackTlsInsecure()).toBe(false);
    const resolved = resolveMemberstackAdminFetchImpl(undefined);
    expect(resolved.tlsInsecure).toBe(false);
    expect(resolved.source).toBe("default");
    expect(process.env.NODE_TLS_REJECT_UNAUTHORIZED).toBeUndefined();
  });

  it("enables client-scoped insecure TLS when MEMBERSTACK_TLS_INSECURE=1 outside production", () => {
    process.env.MEMBERSTACK_TLS_INSECURE = "1";
    delete process.env.NODE_ENV;
    delete process.env.CONTEXT;

    expect(shouldUseMemberstackTlsInsecure()).toBe(true);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const resolved = resolveMemberstackAdminFetchImpl(undefined);
    expect(resolved.tlsInsecure).toBe(true);
    expect(resolved.source).toBe("insecure-local");
    expect(resolved.fetchImpl).not.toBe(fetch);
    expect(process.env.NODE_TLS_REJECT_UNAUTHORIZED).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("MEMBERSTACK_TLS_INSECURE=1"));

    const applied = applyMemberstackLocalTlsInsecureIfRequested();
    expect(applied).toEqual({ applied: true, reason: "client-scoped" });
    expect(process.env.NODE_TLS_REJECT_UNAUTHORIZED).toBeUndefined();
  });

  it("ignores MEMBERSTACK_TLS_INSECURE in NODE_ENV=production", () => {
    process.env.MEMBERSTACK_TLS_INSECURE = "1";
    process.env.NODE_ENV = "production";
    expect(shouldUseMemberstackTlsInsecure()).toBe(false);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const resolved = resolveMemberstackAdminFetchImpl(undefined);
    expect(resolved.tlsInsecure).toBe(false);
    expect(resolved.source).toBe("default");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("ignored in production"));
  });

  it("ignores MEMBERSTACK_TLS_INSECURE when Netlify CONTEXT=production", () => {
    process.env.MEMBERSTACK_TLS_INSECURE = "1";
    process.env.CONTEXT = "production";
    delete process.env.NODE_ENV;
    expect(shouldUseMemberstackTlsInsecure()).toBe(false);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const resolved = resolveMemberstackAdminFetchImpl(undefined);
    expect(resolved.tlsInsecure).toBe(false);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("ignored in production"));
  });

  it("never overrides an explicit custom fetchImpl", () => {
    process.env.MEMBERSTACK_TLS_INSECURE = "1";
    const custom = vi.fn();
    const resolved = resolveMemberstackAdminFetchImpl(custom);
    expect(resolved.fetchImpl).toBe(custom);
    expect(resolved.tlsInsecure).toBe(false);
    expect(resolved.source).toBe("custom");
  });

  it("labels getMember operations without including the lookup value", () => {
    expect(describeGetMemberOperation("mem_abc123")).toBe("getMember by id");
    expect(describeGetMemberOperation("member@example.com")).toBe("getMember by email");
    expect(describeGetMemberOperation("mem_abc123")).not.toContain("mem_abc123");
    expect(describeGetMemberOperation("member@example.com")).not.toContain("member@example.com");
  });

  it("sanitizes TLS diagnostics without secrets or full payloads", () => {
    const err = new Error("fetch failed with sk_live_secretvalue and Bearer tok_123");
    err.code = "UNABLE_TO_VERIFY_LEAF_SIGNATURE";
    err.name = "Error";
    err.cause = { code: "UNABLE_TO_VERIFY_LEAF_SIGNATURE", message: "unable to verify the first certificate" };

    const diagnostic = sanitizeMemberstackErrorDiagnostic(err, "getMember by email");
    expect(diagnostic.operation).toBe("getMember by email");
    expect(diagnostic.code).toBe("UNABLE_TO_VERIFY_LEAF_SIGNATURE");
    expect(diagnostic.name).toBe("Error");
    expect(diagnostic.message).toContain("sk_[redacted]");
    expect(diagnostic.message).not.toContain("sk_live_secretvalue");
    expect(diagnostic.message).toContain("Bearer [redacted]");
    expect(diagnostic.message).not.toContain("tok_123");
    expect(JSON.stringify(diagnostic)).not.toMatch(/planConnections|auth\.email|X-API-KEY=sk_/i);

    expect(extractFetchErrorCode(err)).toBe("UNABLE_TO_VERIFY_LEAF_SIGNATURE");
    expect(redactMemberstackSecrets("X-API-KEY=sk_abc123")).toContain("[redacted]");
  });

  it("uses custom fetch for Admin getMember and preserves successful member payloads", async () => {
    const member = {
      id: "mem_activepaid1",
      auth: { email: "paid@example.com" },
      planConnections: [
        {
          id: "con_1",
          active: true,
          status: "ACTIVE",
          planId: "pln_monthly-subscription-to-knititnow-webx0nz5",
          planName: "Monthly Subscription to Knititnow",
          payment: { priceId: "prc_monthly-subscription-to-knititnow-webw0nzy" },
        },
      ],
    };
    const fetchImpl = vi.fn(async () =>
      Response.json({ data: member }, { status: 200 }),
    );
    const client = createMemberstackAdminClient({
      secretKey: "sk_test_only",
      fetchImpl,
    });
    const result = await client.getMember("mem_activepaid1");
    expect(result).toEqual(member);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const calledUrl = String(fetchImpl.mock.calls[0][0]);
    expect(calledUrl).toContain("/members/mem_activepaid1");
  });
});

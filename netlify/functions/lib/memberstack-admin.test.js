import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createMemberstackAdminClient,
  getMemberstackAdminClient,
  getMemberstackSecretKey,
} from "./memberstack-admin.js";

const ENV_KEY = "MEMBERSTACK_SECRET_KEY";
let savedSecretKey;

beforeEach(() => {
  savedSecretKey = process.env[ENV_KEY];
});

afterEach(() => {
  if (savedSecretKey === undefined) {
    delete process.env[ENV_KEY];
  } else {
    process.env[ENV_KEY] = savedSecretKey;
  }
});

describe("memberstack-admin client secret injection", () => {
  it("uses process.env when no explicit secret is passed", () => {
    process.env[ENV_KEY] = "sk_from_process_env";
    expect(getMemberstackSecretKey()).toBe("sk_from_process_env");
    const client = getMemberstackAdminClient();
    expect(client).not.toBeNull();
    expect(client).toHaveProperty("listMembers");
    expect(client).toHaveProperty("createMember");
    expect(client).toHaveProperty("updateMember");
  });

  it("uses an explicit Netlify runtime secret without reading process.env", () => {
    delete process.env[ENV_KEY];
    const client = getMemberstackAdminClient({ secretKey: "sk_explicit_netlify" });
    expect(client).not.toBeNull();
    expect(client).toHaveProperty("listMembers");
    expect(client).toHaveProperty("createMember");
    expect(client).toHaveProperty("updateMember");
  });

  it("returns null when an explicit secret is missing", () => {
    process.env[ENV_KEY] = "sk_from_process_env";
    expect(getMemberstackAdminClient({ secretKey: null })).toBeNull();
    expect(getMemberstackAdminClient({ secretKey: "" })).toBeNull();
    expect(getMemberstackAdminClient({ secretKey: "   " })).toBeNull();
  });

  it("does not create a client when process.env is unset and no secret is passed", () => {
    delete process.env[ENV_KEY];
    expect(getMemberstackAdminClient()).toBeNull();
  });

  it("requires a secret key when creating a client directly", () => {
    expect(() => createMemberstackAdminClient({ secretKey: "" })).toThrow(
      /secretKey is required/i,
    );
  });
});

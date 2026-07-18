import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./local-dotenv.js", () => ({
  readDotEnvValue: vi.fn(() => null),
  clearLocalDotEnvCache: vi.fn(),
}));

import {
  createMemberstackAdminClient,
  getMemberstackAdminClient,
  getMemberstackSecretKey,
} from "./memberstack-admin.js";
import { readDotEnvValue } from "./local-dotenv.js";

const ENV_KEY = "MEMBERSTACK_SECRET_KEY";
const ENV_KEYS = [ENV_KEY, "NODE_ENV"];
let savedEnv = {};

beforeEach(() => {
  savedEnv = {};
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
  }
  vi.mocked(readDotEnvValue).mockReturnValue(null);
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  vi.clearAllMocks();
});

describe("memberstack-admin client secret injection", () => {
  it("uses process.env.MEMBERSTACK_SECRET_KEY when available", () => {
    process.env[ENV_KEY] = "sk_from_process_env";
    delete process.env.NODE_ENV;
    expect(getMemberstackSecretKey()).toBe("sk_from_process_env");
    expect(readDotEnvValue).not.toHaveBeenCalled();
    const client = getMemberstackAdminClient();
    expect(client).not.toBeNull();
    expect(client).toHaveProperty("listMembers");
    expect(client).toHaveProperty("createMember");
    expect(client).toHaveProperty("updateMember");
  });

  it("in non-production, falls back to local .env when process env is missing", () => {
    delete process.env[ENV_KEY];
    delete process.env.NODE_ENV;
    vi.mocked(readDotEnvValue).mockReturnValue("sk_from_dotenv_file");
    expect(getMemberstackSecretKey()).toBe("sk_from_dotenv_file");
    expect(readDotEnvValue).toHaveBeenCalledWith("MEMBERSTACK_SECRET_KEY");
    expect(getMemberstackAdminClient()).not.toBeNull();
  });

  it("does not read the .env fallback in production", () => {
    delete process.env[ENV_KEY];
    process.env.NODE_ENV = "production";
    vi.mocked(readDotEnvValue).mockReturnValue("sk_should_be_ignored");
    expect(getMemberstackSecretKey()).toBeNull();
    expect(readDotEnvValue).not.toHaveBeenCalled();
    expect(getMemberstackAdminClient()).toBeNull();
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

  it("does not create a client when process env is unset, production, and no secret is passed", () => {
    delete process.env[ENV_KEY];
    process.env.NODE_ENV = "production";
    expect(getMemberstackAdminClient()).toBeNull();
  });

  it("requires a secret key when creating a client directly", () => {
    expect(() => createMemberstackAdminClient({ secretKey: "" })).toThrow(
      /secretKey is required/i,
    );
  });
});

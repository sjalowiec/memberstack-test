import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./local-dotenv.js", () => ({
  readDotEnvValue: vi.fn(() => null),
  clearLocalDotEnvCache: vi.fn(),
}));

import {
  classifyMemberstackMemberIdMode,
  classifyMemberstackSecretMode,
  createMemberstackAdminClient,
  getMemberstackAdminClient,
  getMemberstackSecretKey,
  isMemberstackEnvironmentMismatch,
  logMemberstackEnvironmentMismatch,
  resolveMemberstackAdminSecret,
} from "./memberstack-admin.js";
import { readDotEnvValue } from "./local-dotenv.js";

const LIVE_KEY = "MEMBERSTACK_SECRET_KEY";
const SANDBOX_KEY = "MEMBERSTACK_SANDBOX_SECRET_KEY";
const ENV_KEYS = [LIVE_KEY, SANDBOX_KEY, "NODE_ENV", "CONTEXT"];
let savedEnv = {};

beforeEach(() => {
  savedEnv = {};
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
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
  it("uses process.env.MEMBERSTACK_SECRET_KEY when available and sandbox unset", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    process.env[LIVE_KEY] = "sk_from_process_env";
    expect(getMemberstackSecretKey()).toBe("sk_from_process_env");
    expect(readDotEnvValue).not.toHaveBeenCalledWith(LIVE_KEY);
    const client = getMemberstackAdminClient();
    expect(client).not.toBeNull();
    expect(client).toHaveProperty("listMembers");
    expect(client).toHaveProperty("createMember");
    expect(client).toHaveProperty("updateMember");
    warn.mockRestore();
  });

  it("in non-production, prefers MEMBERSTACK_SANDBOX_SECRET_KEY over live", () => {
    process.env[LIVE_KEY] = "sk_live_should_not_win";
    process.env[SANDBOX_KEY] = "sk_sb_sandbox_wins";
    const resolved = resolveMemberstackAdminSecret();
    expect(resolved.secretKey).toBe("sk_sb_sandbox_wins");
    expect(resolved.mode).toBe("sandbox");
    expect(resolved.usedSandboxEnv).toBe(true);
    expect(getMemberstackSecretKey()).toBe("sk_sb_sandbox_wins");
  });

  it("in non-production, falls back to local .env when process env is missing", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(readDotEnvValue).mockImplementation((name) =>
      name === LIVE_KEY ? "sk_from_dotenv_file" : null,
    );
    expect(getMemberstackSecretKey()).toBe("sk_from_dotenv_file");
    expect(readDotEnvValue).toHaveBeenCalledWith(SANDBOX_KEY);
    expect(readDotEnvValue).toHaveBeenCalledWith(LIVE_KEY);
    expect(getMemberstackAdminClient()).not.toBeNull();
    warn.mockRestore();
  });

  it("does not read the sandbox secret or .env fallback in production", () => {
    process.env.NODE_ENV = "production";
    process.env[SANDBOX_KEY] = "sk_sb_must_never_be_used";
    vi.mocked(readDotEnvValue).mockReturnValue("sk_sb_dotenv_ignored");
    expect(getMemberstackSecretKey()).toBeNull();
    expect(readDotEnvValue).not.toHaveBeenCalled();
    expect(getMemberstackAdminClient()).toBeNull();
  });

  it("production uses only the live secret even when sandbox is set", () => {
    process.env.CONTEXT = "production";
    process.env[LIVE_KEY] = "sk_live_prod_only";
    process.env[SANDBOX_KEY] = "sk_sb_must_never_be_used";
    const resolved = resolveMemberstackAdminSecret();
    expect(resolved.secretKey).toBe("sk_live_prod_only");
    expect(resolved.usedSandboxEnv).toBe(false);
    expect(resolved.source).toContain(LIVE_KEY);
    expect(JSON.stringify(resolved)).not.toContain("sk_sb_must_never_be_used");
  });

  it("Netlify branch-deploy keeps sandbox Admin even when NODE_ENV is production", () => {
    process.env.NODE_ENV = "production";
    process.env.CONTEXT = "branch-deploy";
    process.env[LIVE_KEY] = "sk_live_should_not_win";
    process.env[SANDBOX_KEY] = "sk_sb_branch_wins";
    const resolved = resolveMemberstackAdminSecret();
    expect(resolved.secretKey).toBe("sk_sb_branch_wins");
    expect(resolved.mode).toBe("sandbox");
    expect(resolved.usedSandboxEnv).toBe(true);
  });

  it("Netlify deploy-preview prefers sandbox Admin over live", () => {
    process.env.NODE_ENV = "production";
    process.env.CONTEXT = "deploy-preview";
    process.env[LIVE_KEY] = "sk_live_should_not_win";
    process.env[SANDBOX_KEY] = "sk_sb_preview_wins";
    expect(getMemberstackSecretKey()).toBe("sk_sb_preview_wins");
  });

  it("uses an explicit Netlify runtime secret without reading process.env", () => {
    const client = getMemberstackAdminClient({ secretKey: "sk_explicit_netlify" });
    expect(client).not.toBeNull();
    expect(client).toHaveProperty("listMembers");
    expect(client).toHaveProperty("createMember");
    expect(client).toHaveProperty("updateMember");
  });

  it("returns null when an explicit secret is missing", () => {
    process.env[LIVE_KEY] = "sk_from_process_env";
    expect(getMemberstackAdminClient({ secretKey: null })).toBeNull();
    expect(getMemberstackAdminClient({ secretKey: "" })).toBeNull();
    expect(getMemberstackAdminClient({ secretKey: "   " })).toBeNull();
  });

  it("does not create a client when process env is unset, production, and no secret is passed", () => {
    process.env.NODE_ENV = "production";
    expect(getMemberstackAdminClient()).toBeNull();
  });

  it("requires a secret key when creating a client directly", () => {
    expect(() => createMemberstackAdminClient({ secretKey: "" })).toThrow(
      /secretKey is required/i,
    );
  });
});

describe("memberstack environment alignment", () => {
  it("classifies secret and member id modes", () => {
    expect(classifyMemberstackSecretMode("sk_sb_abc")).toBe("sandbox");
    expect(classifyMemberstackSecretMode("sk_live_abc")).toBe("live");
    expect(classifyMemberstackMemberIdMode("mem_sb_cmrw4wref06jb0tv923kw5dq2")).toBe(
      "sandbox",
    );
    expect(classifyMemberstackMemberIdMode("mem_cmrq9lzwl02c70sor1uuwamcf")).toBe("live");
    expect(classifyMemberstackMemberIdMode("member@example.com")).toBe("unknown");
  });

  it("detects mem_sb_ + live Admin as a mismatch", () => {
    expect(
      isMemberstackEnvironmentMismatch(
        "mem_sb_cmrw4wref06jb0tv923kw5dq2",
        "sk_live_only",
      ),
    ).toBe(true);
    expect(
      isMemberstackEnvironmentMismatch(
        "mem_cmrq9lzwl02c70sor1uuwamcf",
        "sk_live_only",
      ),
    ).toBe(false);
    expect(
      isMemberstackEnvironmentMismatch(
        "mem_sb_cmrw4wref06jb0tv923kw5dq2",
        "sk_sb_sandbox",
      ),
    ).toBe(false);
  });

  it("logs environment mismatch without secret values", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const secret = "sk_live_super_secret_value_do_not_log";
    expect(
      logMemberstackEnvironmentMismatch("mem_sb_example", secret, "getMember by id"),
    ).toBe(true);
    const logged = JSON.stringify(error.mock.calls);
    expect(logged).toContain("environment mismatch");
    expect(logged).toContain("sandbox");
    expect(logged).toContain("live");
    expect(logged).not.toContain(secret);
    error.mockRestore();
  });
});

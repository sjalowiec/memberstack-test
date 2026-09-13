import { afterEach, describe, expect, it } from "vitest";

import {
  formatDatabaseTarget,
  getWatsonAdminDatabaseUrl,
  getWatsonApplicationName,
} from "./env";

describe("formatDatabaseTarget", () => {
  it("shows host, port, database, and user without password", () => {
    const target = formatDatabaseTarget(
      "postgresql://watson_user:super_secret@db.example.com:5432/watson_legacy",
    );
    expect(target).toBe("watson_user@db.example.com:5432/watson_legacy");
    expect(target).not.toContain("super_secret");
  });

  it("returns a safe fallback for invalid URLs", () => {
    expect(formatDatabaseTarget("not-a-url")).toBe("(invalid WATSON_DATABASE_URL)");
  });
});

describe("getWatsonApplicationName", () => {
  it("uses Netlify CONTEXT when set", () => {
    expect(getWatsonApplicationName({ CONTEXT: "branch-deploy" })).toBe(
      "watson-branch-deploy",
    );
    expect(getWatsonApplicationName({ CONTEXT: "production" })).toBe(
      "watson-production",
    );
  });

  it("defaults to watson-local and sanitizes unsafe characters", () => {
    expect(getWatsonApplicationName({})).toBe("watson-local");
    expect(getWatsonApplicationName({ CONTEXT: " Deploy Preview! " })).toBe(
      "watson-deploy-preview",
    );
  });
});

describe("getWatsonAdminDatabaseUrl", () => {
  const previousAdmin = process.env.WATSON_DATABASE_ADMIN_URL;
  const previousRuntime = process.env.WATSON_DATABASE_URL;

  afterEach(() => {
    if (previousAdmin === undefined) delete process.env.WATSON_DATABASE_ADMIN_URL;
    else process.env.WATSON_DATABASE_ADMIN_URL = previousAdmin;
    if (previousRuntime === undefined) delete process.env.WATSON_DATABASE_URL;
    else process.env.WATSON_DATABASE_URL = previousRuntime;
  });

  it("prefers WATSON_DATABASE_ADMIN_URL for CLI session-mode connections", () => {
    process.env.WATSON_DATABASE_URL =
      "postgresql://watson:secret@aws-0-us-west-1.pooler.supabase.com:6543/postgres";
    process.env.WATSON_DATABASE_ADMIN_URL =
      "postgresql://watson:secret@aws-0-us-west-1.pooler.supabase.com:5432/postgres";
    expect(getWatsonAdminDatabaseUrl()).toBe(
      "postgresql://watson:secret@aws-0-us-west-1.pooler.supabase.com:5432/postgres",
    );
  });

  it("falls back to WATSON_DATABASE_URL when no admin URL is set", () => {
    delete process.env.WATSON_DATABASE_ADMIN_URL;
    process.env.WATSON_DATABASE_URL =
      "postgresql://watson:secret@localhost:5432/watson";
    expect(getWatsonAdminDatabaseUrl()).toBe(
      "postgresql://watson:secret@localhost:5432/watson",
    );
  });
});

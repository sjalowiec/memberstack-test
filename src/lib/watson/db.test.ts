import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  getWatsonRuntimePoolConfig,
  WATSON_RUNTIME_IDLE_TIMEOUT_MS,
  WATSON_RUNTIME_POOL_MAX,
} from "./db";
import { WATSON_DB_CONNECTION_TIMEOUT_MS } from "./env";

describe("getWatsonRuntimePoolConfig", () => {
  it("limits the serverless pool to one connection per isolate", () => {
    const config = getWatsonRuntimePoolConfig({ CONTEXT: "branch-deploy" });
    expect(config.max).toBe(1);
    expect(config.max).toBe(WATSON_RUNTIME_POOL_MAX);
    expect(config.min).toBe(0);
    expect(config.idleTimeoutMillis).toBe(1_000);
    expect(config.idleTimeoutMillis).toBe(WATSON_RUNTIME_IDLE_TIMEOUT_MS);
    expect(config.allowExitOnIdle).toBe(true);
    expect(config.connectionTimeoutMillis).toBe(WATSON_DB_CONNECTION_TIMEOUT_MS);
    expect(config.application_name).toBe("watson-branch-deploy");
  });

  it("names local runtime connections watson-local", () => {
    expect(getWatsonRuntimePoolConfig({}).application_name).toBe("watson-local");
  });
});

describe("queryWatson source", () => {
  it("keeps pool.query checkout behavior and does not share the runtime pool with CLI imports", () => {
    const source = readFileSync(new URL("./db.ts", import.meta.url), "utf8");
    expect(source).toContain("const result = await client.query<T>(sql, params);");
    expect(source).toContain("...getWatsonRuntimePoolConfig()");
    expect(source).toContain("CLI importers create their own session-mode pools");
  });
});

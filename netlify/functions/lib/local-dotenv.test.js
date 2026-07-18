import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { clearLocalDotEnvCache, readDotEnvValue } from "./local-dotenv.js";

const ENV_KEYS = ["NODE_ENV"];

let savedEnv = {};
let tempDir = "";
let originalCwd = "";

beforeEach(() => {
  savedEnv = {};
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
  }
  clearLocalDotEnvCache();
  originalCwd = process.cwd();
  tempDir = mkdtempSync(join(tmpdir(), "kbm-dotenv-"));
  process.chdir(tempDir);
});

afterEach(() => {
  process.chdir(originalCwd);
  if (tempDir) {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  clearLocalDotEnvCache();
});

describe("readDotEnvValue", () => {
  it("reads a value from project-root .env in non-production", () => {
    delete process.env.NODE_ENV;
    writeFileSync(join(tempDir, ".env"), 'MEMBERSTACK_SECRET_KEY="sk_from_dotenv"\n', "utf8");
    expect(readDotEnvValue("MEMBERSTACK_SECRET_KEY")).toBe("sk_from_dotenv");
  });

  it("does not read .env when NODE_ENV is production", () => {
    process.env.NODE_ENV = "production";
    writeFileSync(join(tempDir, ".env"), "MEMBERSTACK_SECRET_KEY=sk_should_not_load\n", "utf8");
    expect(readDotEnvValue("MEMBERSTACK_SECRET_KEY")).toBeNull();
  });

  it("returns null when the key is missing", () => {
    delete process.env.NODE_ENV;
    writeFileSync(join(tempDir, ".env"), "OTHER_KEY=1\n", "utf8");
    expect(readDotEnvValue("MEMBERSTACK_SECRET_KEY")).toBeNull();
  });
});

import { afterEach, describe, expect, it } from "vitest";
import { useHelpHubJsonStore } from "./storeMode";

describe("useHelpHubJsonStore", () => {
  const previous = process.env.HELP_HUB_STORE;

  afterEach(() => {
    if (previous === undefined) delete process.env.HELP_HUB_STORE;
    else process.env.HELP_HUB_STORE = previous;
  });

  it("uses Postgres unless HELP_HUB_STORE=json", () => {
    delete process.env.HELP_HUB_STORE;
    expect(useHelpHubJsonStore()).toBe(false);
  });

  it("allows a local json rollback only when HELP_HUB_STORE=json in Vite DEV or tests", () => {
    process.env.HELP_HUB_STORE = "json";
    expect(useHelpHubJsonStore()).toBe(true);
  });
});

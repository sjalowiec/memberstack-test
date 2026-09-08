import { afterEach, describe, expect, it } from "vitest";
import { useLessonsJsonStore } from "./storeMode";

describe("useLessonsJsonStore", () => {
  const previous = process.env.LESSONS_STORE;

  afterEach(() => {
    if (previous === undefined) delete process.env.LESSONS_STORE;
    else process.env.LESSONS_STORE = previous;
  });

  it("uses Postgres unless LESSONS_STORE=json", () => {
    delete process.env.LESSONS_STORE;
    expect(useLessonsJsonStore()).toBe(false);
  });

  it("allows a local json rollback only when LESSONS_STORE=json in Vite DEV or tests", () => {
    process.env.LESSONS_STORE = "json";
    expect(useLessonsJsonStore()).toBe(true);
  });
});

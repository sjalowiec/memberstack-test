import fs from "fs";
import path from "path";

import { describe, expect, it } from "vitest";

import {
  loadCurrentBusinessMembershipSummary,
  resolveCurrentBusinessMemberstackSecretKey,
} from "./currentBusinessLoader";

describe("currentBusinessLoader", () => {
  it("returns a membership summary when Memberstack admin is configured", async () => {
    const result = await loadCurrentBusinessMembershipSummary({
      getClient: async () => ({
        listMembers: async () => ({
          data: [
            {
              id: "mem_1",
              createdAt: "2026-07-01T00:00:00.000Z",
              planConnections: [],
            },
          ],
          hasNextPage: false,
        }),
      }),
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.summary.totalMembersScanned).toBe(1);
      expect(result.summary.newMembers.thisMonth).toBe(1);
    }
  });

  it("resolves the Astro SSR secret from import.meta.env", () => {
    expect(
      resolveCurrentBusinessMemberstackSecretKey({
        MEMBERSTACK_SECRET_KEY: "  sk_astro_secret  ",
      }),
    ).toBe("sk_astro_secret");
    expect(resolveCurrentBusinessMemberstackSecretKey({})).toBeNull();
    expect(
      resolveCurrentBusinessMemberstackSecretKey({
        MEMBERSTACK_SECRET_KEY: "   ",
      }),
    ).toBeNull();
  });

  it("returns a configuration error when the Astro secret is missing", async () => {
    const result = await loadCurrentBusinessMembershipSummary({ secretKey: null });

    expect(result).toEqual({
      ok: false,
      error: "Memberstack admin API is not configured.",
    });
  });

  it("returns a configuration error when Memberstack admin is unavailable", async () => {
    const result = await loadCurrentBusinessMembershipSummary({
      getClient: async () => null,
    });

    expect(result).toEqual({
      ok: false,
      error: "Memberstack admin API is not configured.",
    });
  });

  it("returns a load error when Memberstack listMembers fails", async () => {
    const result = await loadCurrentBusinessMembershipSummary({
      getClient: async () => ({
        listMembers: async () => {
          throw new Error("Memberstack listMembers failed (500).");
        },
      }),
    });

    expect(result).toEqual({
      ok: false,
      error: "Failed to load live membership summary from Memberstack.",
    });
  });

  it("passes truncation through to the computed summary", async () => {
    const pages = Array.from({ length: 50 }, (_, index) => ({
      data: [{ id: `mem_${index}` }],
      hasNextPage: true,
      endCursor: index + 1,
    }));

    let page = 0;
    const result = await loadCurrentBusinessMembershipSummary({
      getClient: async () => ({
        listMembers: async () => {
          const current = pages[page];
          page += 1;
          return current;
        },
      }),
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.summary.scanTruncated).toBe(true);
      expect(result.summary.totalMembersScanned).toBe(50);
    }
  });

  it("reads the Astro SSR secret from import.meta.env in source", () => {
    const source = fs.readFileSync(
      path.resolve("src/lib/watson/currentBusinessLoader.ts"),
      "utf8",
    );

    expect(source).toContain("import.meta.env");
    expect(source).toContain("MEMBERSTACK_SECRET_KEY");
    expect(source).not.toContain("PUBLIC_MEMBERSTACK");
    expect(source).not.toContain("process.env.MEMBERSTACK_SECRET_KEY");
  });
});

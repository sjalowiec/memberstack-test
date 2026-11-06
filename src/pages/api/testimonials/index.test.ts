import { beforeEach, describe, expect, it, vi } from "vitest";

const listPublicTestimonials = vi.hoisted(() => vi.fn());

vi.mock("../../../lib/testimonials/testimonialStore", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../lib/testimonials/testimonialStore")>();
  return { ...actual, listPublicTestimonials };
});

import { GET } from "./index";

describe("public testimonial batches", () => {
  beforeEach(() => {
    listPublicTestimonials.mockReset();
  });

  it("sends one visit order and only public fields", async () => {
    const jar = new Map<string, string>();
    const cookies = {
      get: (name: string) => {
        const value = jar.get(name);
        return value ? { value } : undefined;
      },
      set: (name: string, value: string) => {
        jar.set(name, value);
      },
    };
    listPublicTestimonials.mockResolvedValue({
      testimonials: [
        {
          before: "I ",
          highlight: "learned",
          after: " the cast on.",
          attribution: "Ada",
          reviewDate: "2020-01-02",
        },
      ],
      total: 9,
      offset: 0,
      limit: 8,
      nextOffset: 8,
      hasMore: true,
    });
    const first = await GET({
      request: new Request("https://kin-dev.netlify.app/api/testimonials?offset=0"),
      cookies,
    } as never);
    const firstBody = await first.json();
    expect(first.status).toBe(200);
    expect(first.headers.get("Cache-Control")).toContain("no-store");
    expect(Object.keys(firstBody.testimonials[0]).sort()).toEqual([
      "after",
      "attribution",
      "before",
      "highlight",
      "reviewDate",
    ]);
    expect(firstBody.testimonials[0]).not.toHaveProperty("id");
    const seed = listPublicTestimonials.mock.calls[0]?.[0].seed;
    expect(seed).toMatch(/^[a-f0-9]{32}$/);
    await GET({
      request: new Request("https://kin-dev.netlify.app/api/testimonials?offset=8"),
      cookies,
    } as never);
    expect(listPublicTestimonials.mock.calls[1]?.[0]).toEqual({ seed, offset: 8 });
  });
});

import { describe, expect, it } from "vitest";
import { sortWithFreeContentFirst } from "./catalogFreeContentFirst";

type Item = { id: string; free: boolean; title: string };

const items: Item[] = [
  { id: "m1", free: false, title: "Alpha Member" },
  { id: "f1", free: true, title: "Zebra Free" },
  { id: "m2", free: false, title: "Beta Member" },
  { id: "f2", free: true, title: "Apple Free" },
];

describe("sortWithFreeContentFirst", () => {
  it("keeps original order when preferFreeFirst is false and no compare", () => {
    const sorted = sortWithFreeContentFirst(items, {
      isFree: (item) => item.free,
      preferFreeFirst: false,
    });
    expect(sorted.map((item) => item.id)).toEqual(["m1", "f1", "m2", "f2"]);
  });

  it("puts free items first while preserving original order within groups", () => {
    const sorted = sortWithFreeContentFirst(items, {
      isFree: (item) => item.free,
      preferFreeFirst: true,
    });
    expect(sorted.map((item) => item.id)).toEqual(["f1", "f2", "m1", "m2"]);
  });

  it("applies secondary compare within free and member groups", () => {
    const sorted = sortWithFreeContentFirst(items, {
      isFree: (item) => item.free,
      preferFreeFirst: true,
      compare: (a, b) => a.title.localeCompare(b.title),
    });
    expect(sorted.map((item) => item.id)).toEqual(["f2", "f1", "m1", "m2"]);
  });

  it("uses only secondary compare when preferFreeFirst is false", () => {
    const sorted = sortWithFreeContentFirst(items, {
      isFree: (item) => item.free,
      preferFreeFirst: false,
      compare: (a, b) => a.title.localeCompare(b.title),
    });
    // Alpha Member, Apple Free, Beta Member, Zebra Free
    expect(sorted.map((item) => item.id)).toEqual(["m1", "f2", "m2", "f1"]);
  });
});

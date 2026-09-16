import { describe, expect, it } from "vitest";
import {
  isPaidPatternMutationRoute,
  isPaidSavedPatternReadOnlyCandidate,
  isPaidSavedPatternViewPath,
} from "./savedPatternViewRoute";

describe("savedPatternViewRoute", () => {
  it("treats paid builders and edit query flags as mutation routes", () => {
    expect(isPaidPatternMutationRoute("/patterns/socks/builder?new=1")).toBe(true);
    expect(isPaidPatternMutationRoute("/patterns/socks/edit/?edit=1&project=abc")).toBe(true);
    expect(isPaidPatternMutationRoute("/patterns/sleeveless/builder?edit=choices")).toBe(true);
    expect(isPaidPatternMutationRoute("/patterns/sleeveless/custom-build/design")).toBe(true);
    expect(isPaidPatternMutationRoute("/patterns/sideways-cardigan/builder")).toBe(true);
    expect(isPaidPatternMutationRoute("/patterns/sideways-cardigan/summary/")).toBe(true);
    expect(isPaidPatternMutationRoute("/patterns/drop-shoulder/builder?new=1")).toBe(true);
  });

  it("treats completed pattern pages as view routes", () => {
    expect(isPaidSavedPatternViewPath("/patterns/socks/pattern/")).toBe(true);
    expect(isPaidSavedPatternViewPath("/patterns/sleeveless/pattern/")).toBe(true);
    expect(isPaidSavedPatternViewPath("/patterns/sleeveless/print")).toBe(true);
    expect(isPaidSavedPatternViewPath("/patterns/drop-shoulder/pattern/")).toBe(true);
    expect(isPaidSavedPatternViewPath("/patterns/sideways-cardigan/pattern/")).toBe(true);
    expect(isPaidSavedPatternViewPath("/patterns/hat/pattern/")).toBe(false);
    expect(isPaidSavedPatternViewPath("/patterns/socks/builder")).toBe(false);
  });

  it("requires an explicit project id for the read-only candidate", () => {
    expect(isPaidSavedPatternReadOnlyCandidate("/patterns/socks/pattern/")).toBe(false);
    expect(isPaidSavedPatternReadOnlyCandidate("/patterns/socks/pattern/?project=proj-1")).toBe(
      true,
    );
    expect(
      isPaidSavedPatternReadOnlyCandidate("/patterns/socks/pattern/?project=proj-1&edit=1"),
    ).toBe(false);
  });
});

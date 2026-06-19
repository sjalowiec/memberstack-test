import { describe, expect, it } from "vitest";
import {
  isDropShoulderProductionBlocked,
  isDropShoulderRoute,
} from "./dropShoulderProductionAccess";

describe("isDropShoulderRoute", () => {
  it("matches the drop-shoulder prefix and nested routes", () => {
    expect(isDropShoulderRoute("/patterns/drop-shoulder")).toBe(true);
    expect(isDropShoulderRoute("/patterns/drop-shoulder/")).toBe(true);
    expect(isDropShoulderRoute("/patterns/drop-shoulder/builder")).toBe(true);
    expect(isDropShoulderRoute("/patterns/drop-shoulder/builder/")).toBe(true);
    expect(isDropShoulderRoute("/patterns/drop-shoulder/review")).toBe(true);
    expect(isDropShoulderRoute("/patterns/drop-shoulder/pattern/")).toBe(true);
  });

  it("does not match other pattern routes", () => {
    expect(isDropShoulderRoute("/patterns/sleeveless-express")).toBe(false);
    expect(isDropShoulderRoute("/patterns/drop-shoulder-extra")).toBe(false);
    expect(isDropShoulderRoute("/patterns")).toBe(false);
  });
});

describe("isDropShoulderProductionBlocked", () => {
  it("blocks production custom domains", () => {
    expect(isDropShoulderProductionBlocked("knititnow.com")).toBe(true);
    expect(isDropShoulderProductionBlocked("www.knititnow.com")).toBe(true);
    expect(isDropShoulderProductionBlocked("app.knitbymachine.com")).toBe(true);
  });

  it("allows localhost, Astro dev, and Netlify previews", () => {
    expect(isDropShoulderProductionBlocked("localhost", { isViteDev: true })).toBe(false);
    expect(isDropShoulderProductionBlocked("localhost")).toBe(false);
    expect(isDropShoulderProductionBlocked("127.0.0.1")).toBe(false);
    expect(isDropShoulderProductionBlocked("deploy-preview--kin.netlify.app")).toBe(false);
    expect(isDropShoulderProductionBlocked("unknown-staging.example.com")).toBe(false);
  });
});

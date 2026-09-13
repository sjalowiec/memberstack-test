import { describe, expect, it } from "vitest";
import {
  DROP_SHOULDER_DIAGRAM_REVIEW_PATH,
  isDropShoulderDiagramReviewProductionBlocked,
  isDropShoulderDiagramReviewRoute,
} from "./dropShoulderDiagramReviewAccess";

describe("isDropShoulderDiagramReviewRoute", () => {
  it("matches the review path with or without a trailing slash", () => {
    expect(isDropShoulderDiagramReviewRoute(DROP_SHOULDER_DIAGRAM_REVIEW_PATH)).toBe(true);
    expect(isDropShoulderDiagramReviewRoute(`${DROP_SHOULDER_DIAGRAM_REVIEW_PATH}/`)).toBe(true);
  });

  it("does not match other routes", () => {
    expect(isDropShoulderDiagramReviewRoute("/dev/course-preview")).toBe(false);
    expect(isDropShoulderDiagramReviewRoute("/patterns/drop-shoulder")).toBe(false);
    expect(isDropShoulderDiagramReviewRoute("/dev/drop-shoulder-diagram-review-extra")).toBe(
      false,
    );
  });
});

describe("isDropShoulderDiagramReviewProductionBlocked", () => {
  it("blocks production custom domains", () => {
    expect(isDropShoulderDiagramReviewProductionBlocked("knititnow.com")).toBe(true);
    expect(isDropShoulderDiagramReviewProductionBlocked("www.knititnow.com")).toBe(true);
    expect(isDropShoulderDiagramReviewProductionBlocked("app.knitbymachine.com")).toBe(true);
  });

  it("allows localhost, Astro dev, and Netlify previews", () => {
    expect(isDropShoulderDiagramReviewProductionBlocked("localhost", { isViteDev: true })).toBe(
      false,
    );
    expect(isDropShoulderDiagramReviewProductionBlocked("localhost")).toBe(false);
    expect(isDropShoulderDiagramReviewProductionBlocked("127.0.0.1")).toBe(false);
    expect(isDropShoulderDiagramReviewProductionBlocked("deploy-preview--kin.netlify.app")).toBe(
      false,
    );
  });
});

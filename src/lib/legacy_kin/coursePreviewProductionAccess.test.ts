import { describe, expect, it } from "vitest";
import {
  isCoursePreviewProductionBlocked,
  isCoursePreviewRoute,
} from "./coursePreviewProductionAccess";

describe("isCoursePreviewRoute", () => {
  it("matches the course-preview prefix and nested routes", () => {
    expect(isCoursePreviewRoute("/dev/course-preview")).toBe(true);
    expect(isCoursePreviewRoute("/dev/course-preview/")).toBe(true);
    expect(isCoursePreviewRoute("/dev/course-preview/welcome")).toBe(true);
    expect(isCoursePreviewRoute("/dev/course-preview/welcome/")).toBe(true);
  });

  it("does not match other dev or public routes", () => {
    expect(isCoursePreviewRoute("/dev/other-preview")).toBe(false);
    expect(isCoursePreviewRoute("/courses/")).toBe(false);
    expect(isCoursePreviewRoute("/dev/course-preview-extra")).toBe(false);
  });
});

describe("isCoursePreviewProductionBlocked", () => {
  it("blocks production custom domains", () => {
    expect(isCoursePreviewProductionBlocked("knititnow.com")).toBe(true);
    expect(isCoursePreviewProductionBlocked("www.knititnow.com")).toBe(true);
    expect(isCoursePreviewProductionBlocked("app.knitbymachine.com")).toBe(true);
  });

  it("allows localhost, Astro dev, and Netlify previews", () => {
    expect(isCoursePreviewProductionBlocked("localhost", { isViteDev: true })).toBe(false);
    expect(isCoursePreviewProductionBlocked("localhost")).toBe(false);
    expect(isCoursePreviewProductionBlocked("127.0.0.1")).toBe(false);
    expect(isCoursePreviewProductionBlocked("deploy-preview--kin.netlify.app")).toBe(false);
    expect(isCoursePreviewProductionBlocked("unknown-staging.example.com")).toBe(false);
  });
});

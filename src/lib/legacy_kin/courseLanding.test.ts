import { describe, expect, it } from "vitest";
import {
  courseInterestActiveCampaignTag,
  courseLandingStartHref,
  getCourseLandingBySlug,
} from "./courseLanding";

describe("courseLanding", () => {
  it("builds ActiveCampaign interest tag from course slug", () => {
    expect(courseInterestActiveCampaignTag("beginner-workshop")).toBe(
      "course-interest-beginner-workshop",
    );
  });

  it("loads landing data for a known course slug", () => {
    const landing = getCourseLandingBySlug("lk-150-quick-start");
    expect(landing?.title).toBe("LK-150 Quick Start");
    expect(landing?.contentStatus).toBe("cleaned");
    expect(landing?.contentStatusLabel).toBe("Ready");
    expect(landing?.interestTag).toBe("course-interest-lk-150-quick-start");
  });

  it("returns ready/cleaned landing behavior for Ribber Basic Bootcamp", () => {
    const landing = getCourseLandingBySlug("ribber-basic-bootcamp");
    expect(landing?.title).toBe("Ribber Basic Bootcamp");
    expect(landing?.contentStatus).toBe("cleaned");
    expect(landing?.contentStatusLabel).toBe("Ready");
    expect(landing?.startHref).toMatch(/^\/courses\/legacy\/ribber-basic-bootcamp\//);
  });

  it("falls back to the courses-catalog blurb when the course JSON has no description", () => {
    // not-enough-needles has no description in its cleaned course JSON, so the
    // landing page (and Pagefind) should surface the curated catalog blurb.
    const landing = getCourseLandingBySlug("not-enough-needles");
    expect(landing?.description).toBe(
      "Strategies for when your machine does not have enough needles for the width you want to knit.",
    );
  });

  it("returns undefined for unknown slugs", () => {
    expect(getCourseLandingBySlug("not-a-real-course-slug")).toBeUndefined();
  });

  it("links cleaned courses to the first legacy lesson", () => {
    const href = courseLandingStartHref("lk-150-quick-start");
    expect(href).toMatch(/^\/courses\/legacy\/lk-150-quick-start\//);
  });
});

import { describe, expect, it } from "vitest";
import { validateTipOfTheWeekInput } from "./validation";

const base = {
  tipId: "taming-the-curl-2026-08",
  title: "Tame the Dreaded Stockinette Curl",
  intro: "Stockinette naturally curls at the edges.",
  videoContentId: "339",
  availableFrom: "2026-08-08",
  availableThrough: "2026-08-14",
  status: "active",
  learnPoints: ["Why stockinette curls", "Six techniques you can use"],
  relatedLinks: [
    {
      label: "Wet Blocking",
      href: "/videos/456",
      note: "Blocking basics",
    },
  ],
  tryCopy: "Knit a swatch.",
  sueTipCopy: "Don’t judge on the machine.",
};

describe("validateTipOfTheWeekInput", () => {
  it("saves editable wording and preserves learn/related order", () => {
    const result = validateTipOfTheWeekInput({
      ...base,
      learnPoints: ["A", "B", "C"],
      relatedLinks: [
        { label: "One", href: "/videos/1" },
        { label: "Two", href: "/videos/2" },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.learnPoints).toEqual(["A", "B", "C"]);
    expect(result.value.relatedLinks.map((l) => l.label)).toEqual(["One", "Two"]);
    expect(result.value.tryCopy).toBe("Knit a swatch.");
    expect(result.value.sueTipCopy).toContain("machine");
  });

  it("rejects overlapping scheduled/active ranges", () => {
    const result = validateTipOfTheWeekInput(
      { ...base, status: "scheduled" },
      {
        siblings: [
          {
            id: "other",
            status: "active",
            availableFrom: "2026-08-10",
            availableThrough: "2026-08-20",
          },
        ],
      },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/overlap/i);
  });

  it("rejects fake related destinations", () => {
    const result = validateTipOfTheWeekInput({
      ...base,
      relatedLinks: [{ label: "Bad", href: "https://example.com/x" }],
    });
    expect(result.ok).toBe(false);
  });

  it("requires {date} in the footer template", () => {
    const result = validateTipOfTheWeekInput({
      ...base,
      availabilityFooterTemplate: "Free this week only.",
    });
    expect(result.ok).toBe(false);
  });
});

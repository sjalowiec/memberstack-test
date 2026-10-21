import { describe, expect, it } from "vitest";
import {
  TIP_FEEDBACK_CHOICE_EVENT,
  TIP_GA_CHOICE_PARAM,
  TIP_GA_TIP_ID_PARAM,
  TIP_TOPIC_SUGGESTION_EVENT,
  reportTipFeedbackChoice,
  reportTipTopicSuggestion,
  resetTipOfTheWeekGaForTests,
  shouldReportTipOfTheWeekToProductionGa,
  type TipOfTheWeekGaContext,
} from "./tipOfTheWeekGa";

function productionContext(): { calls: unknown[][]; context: TipOfTheWeekGaContext } {
  const calls: unknown[][] = [];
  return {
    calls,
    context: {
      now: 1_000,
      hostname: "www.knititnow.com",
      isViteDev: false,
      publicSiteEnv: "production",
      measurementIdConfigured: true,
      gtag: (...args: unknown[]) => {
        calls.push(args);
      },
    },
  };
}

describe("Tip of the Week GA environment", () => {
  it("keeps localhost, the dev server, and kin-dev out of production reporting", () => {
    expect(
      shouldReportTipOfTheWeekToProductionGa({
        hostname: "localhost",
        isViteDev: true,
      }),
    ).toBe(false);
    expect(
      shouldReportTipOfTheWeekToProductionGa({
        hostname: "kin-dev.netlify.app",
        isViteDev: false,
      }),
    ).toBe(false);
    expect(
      shouldReportTipOfTheWeekToProductionGa({
        hostname: "www.knititnow.com",
        isViteDev: false,
        publicSiteEnv: "production",
      }),
    ).toBe(true);
  });
});

describe("Tip of the Week GA events", () => {
  it("records the feedback choice and tip id without personal details", () => {
    resetTipOfTheWeekGaForTests();
    const { calls, context } = productionContext();
    expect(reportTipFeedbackChoice("taming-the-curl-2026-08", "not_for_me", context)).toBe(true);
    expect(calls).toEqual([
      [
        "event",
        TIP_FEEDBACK_CHOICE_EVENT,
        {
          [TIP_GA_CHOICE_PARAM]: "not_for_me",
          [TIP_GA_TIP_ID_PARAM]: "taming-the-curl-2026-08",
          transport_type: "beacon",
        },
      ],
    ]);
    expect(JSON.stringify(calls)).not.toContain("@");
    expect(JSON.stringify(calls)).not.toContain("mem_");
  });

  it("records a topic submission without the suggestion text", () => {
    resetTipOfTheWeekGaForTests();
    const { calls, context } = productionContext();
    expect(reportTipTopicSuggestion("taming-the-curl-2026-08", context)).toBe(true);
    expect(calls[0]?.[1]).toBe(TIP_TOPIC_SUGGESTION_EVENT);
    expect(calls[0]?.[2]).toEqual({
      [TIP_GA_TIP_ID_PARAM]: "taming-the-curl-2026-08",
      transport_type: "beacon",
    });
    expect(JSON.stringify(calls[0]?.[2])).not.toContain("topic");
  });

  it("does not call gtag from local or dev, or when the measurement id is missing", () => {
    resetTipOfTheWeekGaForTests();
    const { calls, context } = productionContext();
    expect(
      reportTipFeedbackChoice("tip-a", "helped", {
        ...context,
        hostname: "127.0.0.1",
        isViteDev: true,
      }),
    ).toBe(false);
    expect(
      reportTipTopicSuggestion("tip-a", {
        ...context,
        hostname: "kin-dev.netlify.app",
      }),
    ).toBe(false);
    expect(
      reportTipFeedbackChoice("tip-a", "helped", {
        ...context,
        measurementIdConfigured: false,
      }),
    ).toBe(false);
    expect(calls).toEqual([]);
  });

  it("drops a second delivery of the same choice and still records the other choice", () => {
    resetTipOfTheWeekGaForTests();
    const { calls, context } = productionContext();
    expect(reportTipFeedbackChoice("tip-a", "helped", context)).toBe(true);
    expect(reportTipFeedbackChoice("tip-a", "helped", { ...context, now: 1_200 })).toBe(false);
    expect(reportTipFeedbackChoice("tip-a", "not_for_me", { ...context, now: 1_200 })).toBe(true);
    expect(calls.map((call) => call[2])).toEqual([
      expect.objectContaining({ tip_feedback_choice: "helped" }),
      expect.objectContaining({ tip_feedback_choice: "not_for_me" }),
    ]);
  });

  it("rejects a personal-looking tip id", () => {
    resetTipOfTheWeekGaForTests();
    const { calls, context } = productionContext();
    expect(reportTipFeedbackChoice("sue@example.com", "helped", context)).toBe(false);
    expect(reportTipTopicSuggestion("mem_sb_123", context)).toBe(false);
    expect(calls).toEqual([]);
  });
});

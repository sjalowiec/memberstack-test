import { beforeEach, describe, expect, it, vi } from "vitest";
import { stubLocalStorage } from "./patterns/test/stubLocalStorage";
import {
  TIP_FEEDBACK_CHOICES,
  TIP_REACTION_HISTORY,
  TIP_REACTIONS,
  TIP_TOPIC_EMPTY,
  TIP_TOPIC_PROMPT,
  TIP_TOPIC_THANKS,
  applyTipReactionSelection,
  hydrateTipReactions,
  isTipFeedbackChoice,
  isTipReactionId,
  persistTipReaction,
  readStoredTipReaction,
  selectTipReaction,
  submitTipTopic,
  tipReactionStorageKey,
  TIP_REACTION_ENDPOINT,
  TIP_REACTION_THANKS,
  writeStoredTipReaction,
  type TipReactionButtonEl,
  type TipReactionDomRoot,
  type TipReactionFollowupEl,
} from "./tipOfTheWeekReactions";
import {
  TIP_FEEDBACK_CHOICE_EVENT,
  TIP_GA_CHOICE_PARAM,
  TIP_GA_TIP_ID_PARAM,
  TIP_TOPIC_SUGGESTION_EVENT,
  type TipOfTheWeekGaContext,
} from "./analytics/tipOfTheWeekGa";

function makeButton(id: string): TipReactionButtonEl & { selected: boolean; pressed: string } {
  const state = { selected: false, pressed: "false" };
  return {
    get selected() {
      return state.selected;
    },
    get pressed() {
      return state.pressed;
    },
    getAttribute(name: string) {
      if (name === "data-tip-reaction") return id;
      if (name === "aria-pressed") return state.pressed;
      return null;
    },
    setAttribute(name: string, value: string) {
      if (name === "aria-pressed") state.pressed = value;
    },
    removeAttribute() {},
    classList: {
      add(c: string) {
        if (c === "is-selected") state.selected = true;
      },
      remove(c: string) {
        if (c === "is-selected") state.selected = false;
      },
      contains(c: string) {
        return c === "is-selected" ? state.selected : false;
      },
    },
  };
}

function makeRoot(ids = ["helped", "not_for_me"]) {
  const buttons = ids.map((id) => makeButton(id));
  const thanks = {
    hidden: true,
    textContent: "" as string | null,
    setAttribute: vi.fn(),
  };
  const followup: TipReactionFollowupEl = { hidden: true };
  const root: TipReactionDomRoot = {
    querySelectorAll(sel: string) {
      if (sel.includes("data-tip-reaction")) return buttons;
      return [];
    },
    querySelector(sel: string) {
      if (sel.includes("thanks")) return thanks;
      if (sel.includes("followup")) return followup;
      return null;
    },
  };
  return { root, buttons, thanks, followup };
}

function productionGa(): { calls: unknown[][]; context: TipOfTheWeekGaContext } {
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

describe("tipOfTheWeekReactions", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
  });

  it("offers Helpful and Not for me and still recognizes retired choices", () => {
    expect(TIP_FEEDBACK_CHOICES.map((choice) => choice.label)).toEqual([
      "Helpful",
      "Not for me",
    ]);
    expect(TIP_FEEDBACK_CHOICES.map((choice) => choice.id)).toEqual([
      "helped",
      "not_for_me",
    ]);
    expect(isTipFeedbackChoice("helped")).toBe(true);
    expect(isTipFeedbackChoice("not_for_me")).toBe(true);
    expect(isTipFeedbackChoice("will_try")).toBe(false);
    expect(isTipReactionId("helped")).toBe(true);
    expect(isTipReactionId("not_for_me")).toBe(true);
    expect(isTipReactionId("will_try")).toBe(true);
    expect(isTipReactionId("more_like_this")).toBe(true);
    expect(isTipReactionId("nope")).toBe(false);
    expect(TIP_REACTIONS.map((reaction) => reaction.id)).toEqual([
      "helped",
      "not_for_me",
      "will_try",
      "more_like_this",
    ]);
  });

  it("keeps the retired will_try id and smiling-face label for historical reports", () => {
    const willTry = TIP_REACTION_HISTORY.find((reaction) => reaction.id === "will_try");
    expect(willTry?.emoji).toBe("🙂");
    expect(willTry?.id).toBe("will_try");
    expect(willTry?.label).toContain("going to try it");
  });

  it("highlights only the selected choice and reveals the topic follow-up", () => {
    const { root, buttons, thanks, followup } = makeRoot();
    applyTipReactionSelection(root, "not_for_me");

    expect(buttons[0].selected).toBe(false);
    expect(buttons[1].selected).toBe(true);
    expect(buttons[1].pressed).toBe("true");
    expect(buttons[0].pressed).toBe("false");
    expect(thanks.hidden).toBe(false);
    expect(thanks.textContent).toBe(TIP_REACTION_THANKS);
    expect(followup.hidden).toBe(false);
    expect(TIP_TOPIC_PROMPT).toBe("What topic would you like us to cover?");
  });

  it("updates selection when the visitor changes their choice", () => {
    const { root, buttons } = makeRoot();
    applyTipReactionSelection(root, "helped");
    applyTipReactionSelection(root, "not_for_me");

    expect(buttons.filter((button) => button.selected)).toHaveLength(1);
    expect(buttons[1].selected).toBe(true);
    expect(buttons[0].selected).toBe(false);
  });

  it("stores one reaction per tip id and overwrites on change", () => {
    const tipId = "taming-the-curl-2026-08";
    writeStoredTipReaction(tipId, "helped");
    expect(readStoredTipReaction(tipId)).toBe("helped");
    expect(localStorage.getItem(tipReactionStorageKey(tipId))).toBe("helped");

    writeStoredTipReaction(tipId, "not_for_me");
    expect(readStoredTipReaction(tipId)).toBe("not_for_me");
  });

  it("keeps a retired local choice without presenting it as a current selection", () => {
    const tipId = "tip-a";
    writeStoredTipReaction(tipId, "more_like_this");
    const { root, buttons, thanks, followup } = makeRoot();

    const restored = hydrateTipReactions(root, tipId);
    expect(restored).toBe("more_like_this");
    expect(buttons.every((button) => button.selected === false)).toBe(true);
    expect(thanks.hidden).toBe(true);
    expect(followup.hidden).toBe(true);
    expect(readStoredTipReaction(tipId)).toBe("more_like_this");
  });

  it("hydrates Helpful and does not post again until the choice changes", () => {
    const tipId = "tip-a";
    writeStoredTipReaction(tipId, "helped");
    const { root, buttons, thanks } = makeRoot();
    const fetchImpl = vi.fn();

    const restored = hydrateTipReactions(root, tipId);
    expect(restored).toBe("helped");
    expect(buttons[0].selected).toBe(true);
    expect(thanks.hidden).toBe(false);

    selectTipReaction(root, tipId, "helped", { skipPersist: true, fetchImpl });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(readStoredTipReaction(tipId)).toBe("helped");
  });

  it("saves a choice immediately and ignores a repeated click", () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
    const { root } = makeRoot();
    const ga = productionGa();

    selectTipReaction(root, "tip-a", "helped", {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      gaContext: ga.context,
    });
    selectTipReaction(root, "tip-a", "helped", {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      gaContext: { ...ga.context, now: 2_000 },
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body.reaction).toBe("helped");
    expect(body.topicSuggestion).toBeUndefined();
    expect(ga.calls).toEqual([
      [
        "event",
        TIP_FEEDBACK_CHOICE_EVENT,
        {
          [TIP_GA_CHOICE_PARAM]: "helped",
          [TIP_GA_TIP_ID_PARAM]: "tip-a",
          transport_type: "beacon",
        },
      ],
    ]);
  });

  it("saves Not for me without a topic suggestion", () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
    const { root, buttons, followup } = makeRoot();

    selectTipReaction(root, "tip-a", "not_for_me", {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(buttons[1].selected).toBe(true);
    expect(followup.hidden).toBe(false);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(TIP_REACTION_ENDPOINT);
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body);
    expect(body.reaction).toBe("not_for_me");
    expect(body.topicSuggestion).toBeUndefined();
    expect(readStoredTipReaction("tip-a")).toBe("not_for_me");
  });

  it("persists reactions best-effort to the tip reaction endpoint", () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
    persistTipReaction({
      tipId: "tip-a",
      reaction: "helped",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(TIP_REACTION_ENDPOINT);
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body);
    expect(body.tipId).toBe("tip-a");
    expect(body.reaction).toBe("helped");
    expect(body.visitorId).toBeTruthy();
  });

  it("saves a topic suggestion separately and skips an empty or repeated submit", () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
    const ga = productionGa();

    expect(
      submitTipTopic({
        tipId: "tip-a",
        topic: "   ",
        fetchImpl: fetchImpl as unknown as typeof fetch,
        gaContext: ga.context,
      }),
    ).toBe("empty");
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(ga.calls).toHaveLength(0);
    expect(TIP_TOPIC_EMPTY).toBe("You can leave this blank.");

    expect(
      submitTipTopic({
        tipId: "tip-a",
        topic: "  Button bands  ",
        fetchImpl: fetchImpl as unknown as typeof fetch,
        gaContext: ga.context,
      }),
    ).toBe("saved");
    expect(
      submitTipTopic({
        tipId: "tip-a",
        topic: "Button bands",
        fetchImpl: fetchImpl as unknown as typeof fetch,
        gaContext: { ...ga.context, now: 5_000 },
      }),
    ).toBe("unchanged");

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body.topicSuggestion).toBe("Button bands");
    expect(body.reaction).toBeUndefined();
    expect(ga.calls).toHaveLength(1);
    expect(ga.calls[0]?.[1]).toBe(TIP_TOPIC_SUGGESTION_EVENT);
    expect(JSON.stringify(ga.calls)).not.toContain("Button bands");
    expect(TIP_TOPIC_THANKS).toBe("Thanks. We saved your topic idea.");
  });
});

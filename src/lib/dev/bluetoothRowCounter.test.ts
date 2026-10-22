import { describe, expect, it } from "vitest";
import {
  applyRowCounterKey,
  formatDetectedKeyboardCommand,
  normalizeRowCount,
  pushCommandLog,
  stepRowCount,
} from "./bluetoothRowCounter";

function press(rows: number, key: string, extra: Record<string, unknown> = {}) {
  return applyRowCounterKey(rows, { key, ...extra });
}

describe("stepRowCount", () => {
  it("advances and reverses by one row", () => {
    expect(stepRowCount(0, "advance")).toBe(1);
    expect(stepRowCount(4, "reverse")).toBe(3);
  });

  it("stops at zero", () => {
    expect(stepRowCount(0, "reverse")).toBe(0);
    expect(stepRowCount(1, "reverse")).toBe(0);
    expect(normalizeRowCount(-3)).toBe(0);
    expect(normalizeRowCount(Number.NaN)).toBe(0);
  });
});

describe("applyRowCounterKey", () => {
  it("advances on Right Arrow and Down Arrow", () => {
    expect(press(0, "ArrowRight").rows).toBe(1);
    expect(press(2, "ArrowDown").rows).toBe(3);
  });

  it("reverses on Left Arrow and Up Arrow and stops at zero", () => {
    expect(press(3, "ArrowLeft").rows).toBe(2);
    expect(press(3, "ArrowUp").rows).toBe(2);
    expect(press(0, "ArrowLeft").rows).toBe(0);
    expect(press(0, "ArrowUp").rows).toBe(0);
  });

  it("ignores a held-key repeat", () => {
    const result = press(4, "ArrowRight", { repeat: true, code: "ArrowRight" });
    expect(result.rows).toBe(4);
    expect(result.decision.preventScroll).toBe(true);
    expect(result.decision.command?.direction).toBeNull();
    expect(result.decision.command?.label).toBe("Right Arrow (held, not counted)");
  });

  it("ignores arrows while an input, textarea, select, or contenteditable is focused", () => {
    for (const target of [
      { tagName: "INPUT" },
      { tagName: "textarea" },
      { tagName: "SELECT" },
      { tagName: "DIV", isContentEditable: true },
    ]) {
      const result = press(5, "ArrowRight", { target });
      expect(result.rows).toBe(5);
      expect(result.decision.ignore).toBe(true);
      expect(result.decision.preventScroll).toBe(false);
    }
  });

  it("counts arrows when a button is focused and leaves button activation alone", () => {
    const button = { tagName: "BUTTON" };
    expect(press(1, "ArrowDown", { target: button }).rows).toBe(2);
    const space = press(1, " ", { target: button, code: "Space" });
    expect(space.rows).toBe(1);
    expect(space.decision.ignore).toBe(true);
    expect(press(1, "Enter", { target: button }).decision.ignore).toBe(true);
  });

  it("uses code or keyCode when the key name is unidentified", () => {
    expect(press(0, "Unidentified", { code: "ArrowRight" }).rows).toBe(1);
    expect(press(2, "Unidentified", { code: "", keyCode: 37 }).rows).toBe(1);
    expect(press(1, "Unidentified", { keyCode: 40 }).rows).toBe(2);
  });

  it("prefers the key name over a conflicting keyCode", () => {
    expect(press(5, "ArrowLeft", { keyCode: 39 }).rows).toBe(4);
  });

  it("shows other keys without changing the row", () => {
    const result = press(6, "PageDown", { code: "PageDown" });
    expect(result.rows).toBe(6);
    expect(result.decision.preventScroll).toBe(false);
    expect(result.decision.command?.label).toBe("Page Down");
    expect(formatDetectedKeyboardCommand(result.decision.command!).detail).toBe(
      "key PageDown · code PageDown",
    );
  });

  it("does not count modified arrows and does not cancel the browser shortcut", () => {
    const result = press(3, "ArrowLeft", { altKey: true, code: "ArrowLeft" });
    expect(result.rows).toBe(3);
    expect(result.decision.preventScroll).toBe(false);
    expect(result.decision.command?.label).toBe("Left Arrow (modifier, not counted)");
  });

  it("prevents scrolling for unmodified arrows, including a reverse at zero", () => {
    expect(press(0, "ArrowUp", { code: "ArrowUp" }).decision.preventScroll).toBe(true);
    expect(press(0, "ArrowDown", { code: "ArrowDown" }).decision.preventScroll).toBe(true);
  });
});

describe("command log", () => {
  it("keeps only the most recent entries", () => {
    let log: string[] = [];
    for (let i = 1; i <= 10; i += 1) log = pushCommandLog(log, `key ${i}`);
    expect(log).toEqual(["key 3", "key 4", "key 5", "key 6", "key 7", "key 8", "key 9", "key 10"]);
  });

  it("formats the raw key, code, and keyCode for the pedal display", () => {
    const { decision } = press(0, "ArrowRight", { code: "ArrowRight", keyCode: 39 });
    expect(formatDetectedKeyboardCommand(decision.command!)).toEqual({
      title: "Right Arrow",
      detail: "key ArrowRight · code ArrowRight · keyCode 39",
    });
  });
});

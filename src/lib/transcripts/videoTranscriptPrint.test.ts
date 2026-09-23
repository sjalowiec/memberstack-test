import { afterEach, describe, expect, it, vi } from "vitest";

import { bindTranscriptPrintButton, handleTranscriptPrintClick } from "./videoTranscriptPrint";

const originalDocument = globalThis.document;
const originalWindow = globalThis.window;

afterEach(() => {
  globalThis.document = originalDocument;
  globalThis.window = originalWindow;
  vi.restoreAllMocks();
});

describe("Print Transcript click", () => {
  it("prints without toggling the accordion", () => {
    let open = false;
    const printed: string[] = [];
    globalThis.window = { print: () => printed.push("print") } as Window & typeof globalThis;

    const event = {
      defaultPrevented: false,
      propagationStopped: false,
      target: {
        closest(selector: string) {
          return selector === "[data-print-transcript]" ? this : null;
        },
      },
      preventDefault() {
        this.defaultPrevented = true;
      },
      stopPropagation() {
        this.propagationStopped = true;
      },
    };

    expect(handleTranscriptPrintClick(event as unknown as Event)).toBe(true);
    if (!event.propagationStopped && !event.defaultPrevented) open = !open;

    expect(open).toBe(false);
    expect(event.defaultPrevented).toBe(true);
    expect(event.propagationStopped).toBe(true);
    expect(printed).toEqual(["print"]);
  });

  it("ignores clicks that are not on the print button", () => {
    const printed: string[] = [];
    globalThis.window = { print: () => printed.push("print") } as Window & typeof globalThis;
    const event = {
      target: { closest: () => null },
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    };

    expect(handleTranscriptPrintClick(event as unknown as Event)).toBe(false);
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(event.stopPropagation).not.toHaveBeenCalled();
    expect(printed).toEqual([]);
  });

  it("listens during capture so the summary never receives the click", () => {
    const listeners: Array<{ type: string; capture: boolean }> = [];
    globalThis.document = {
      addEventListener(type: string, _listener: unknown, capture?: boolean) {
        listeners.push({ type, capture: capture === true });
      },
    } as unknown as Document;

    bindTranscriptPrintButton();
    expect(listeners).toEqual([{ type: "click", capture: true }]);
  });
});

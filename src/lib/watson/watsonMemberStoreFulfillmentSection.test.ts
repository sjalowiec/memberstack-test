import { describe, expect, it, vi } from "vitest";

import {
  buildStoreFulfillmentItemApiUrl,
  buildStoreFulfillmentsApiUrl,
  initStoreFulfillmentPanel,
} from "./watsonMemberStoreFulfillmentSection";

type DomElement = {
  hidden: boolean;
  textContent: string;
  classList: { toggle: (name: string, force?: boolean) => void };
  dataset: Record<string, string>;
  value?: string;
  required?: boolean;
  disabled: boolean;
  matches: (selector: string) => boolean;
  closest: (selector: string) => DomElement | null;
  querySelector: (selector: string) => DomElement | null;
  querySelectorAll: (selector: string) => DomElement[];
  setAttribute: (name: string, value: string) => void;
  removeAttribute: (name: string) => void;
  getAttribute: (name: string) => string | null;
  addEventListener: (
    type: string,
    listener: (event?: {
      target?: DomElement;
      preventDefault?: () => void;
    }) => void | Promise<void>,
  ) => void;
  reset?: () => void;
};

function createStatus(): DomElement {
  return {
    hidden: true,
    textContent: "",
    classList: {
      toggle() {},
    },
    dataset: {},
    disabled: false,
    matches: () => false,
    closest: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    setAttribute() {},
    removeAttribute() {},
    getAttribute() {
      return null;
    },
    addEventListener() {},
  };
}

describe("watsonMemberStoreFulfillmentSection", () => {
  it("builds Watson fulfillment API URLs", () => {
    expect(buildStoreFulfillmentsApiUrl("mem_1")).toBe(
      "/api/watson/members/mem_1/fulfillments",
    );
    expect(buildStoreFulfillmentItemApiUrl("abc")).toBe("/api/watson/fulfillments/abc");
  });

  it("confirms before deleting a fulfillment record", async () => {
    const status = createStatus();
    const deleteButton: DomElement = {
      hidden: false,
      textContent: "Delete",
      classList: { toggle() {} },
      dataset: {},
      disabled: false,
      matches(selector) {
        return selector === "[data-watson-fulfillment-delete]";
      },
      closest(selector) {
        if (selector === "[data-watson-fulfillment-item]") {
          return item;
        }
        return null;
      },
      querySelector: () => null,
      querySelectorAll: () => [],
      setAttribute() {},
      removeAttribute() {},
      getAttribute() {
        return null;
      },
      addEventListener() {},
    };

    const item: DomElement = {
      hidden: false,
      textContent: "",
      classList: { toggle() {} },
      dataset: { fulfillmentId: "fulfillment-1" },
      disabled: false,
      matches: () => false,
      closest: () => null,
      querySelector: () => null,
      querySelectorAll: () => [],
      setAttribute() {},
      removeAttribute() {},
      getAttribute() {
        return null;
      },
      addEventListener() {},
    };

    let clickHandler:
      | ((event?: { target?: DomElement; preventDefault?: () => void }) => void | Promise<void>)
      | null = null;

    const root: DomElement = {
      hidden: false,
      textContent: "",
      classList: { toggle() {} },
      dataset: { memberid: "mem_1" },
      disabled: false,
      matches: () => false,
      closest: () => null,
      querySelector(selector) {
        if (selector === "[data-watson-fulfillment-form-status]") {
          return status;
        }
        if (selector === "[data-watson-fulfillment-add-form]") {
          return null;
        }
        return null;
      },
      querySelectorAll(selector) {
        if (
          selector ===
          "[data-watson-fulfillment-add-form], [data-watson-fulfillment-edit-form]"
        ) {
          return [];
        }
        return [];
      },
      setAttribute() {},
      removeAttribute() {},
      getAttribute() {
        return null;
      },
      addEventListener(type, listener) {
        if (type === "click") {
          clickHandler = listener;
        }
      },
    };

    const confirmDelete = vi.fn().mockReturnValue(false);
    const fetchJson = vi.fn();

    initStoreFulfillmentPanel(root as unknown as HTMLElement, {
      confirmDelete,
      fetchJson: fetchJson as unknown as typeof fetch,
    });

    expect(clickHandler).toBeTruthy();
    await clickHandler?.({ target: deleteButton, preventDefault() {} });
    expect(confirmDelete).toHaveBeenCalledWith(
      "Delete this store fulfillment record? This cannot be undone.",
    );
    expect(fetchJson).not.toHaveBeenCalled();
  });
});

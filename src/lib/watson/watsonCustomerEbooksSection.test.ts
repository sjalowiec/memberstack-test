import { describe, expect, it } from "vitest";

import { filterEbookSelectOptions } from "./watsonCustomerEbooksSection";

describe("Watson customer ebooks panel", () => {
  it("filters the approved catalog select by title search", () => {
    const select = {
      options: [
        { value: "", textContent: "Select", hidden: false },
        {
          value: "416",
          textContent: "Cheat Sheets for Hand Manipulated Stitch Patterns",
          hidden: false,
        },
        {
          value: "505",
          textContent: "Machine Knitting Trims and Edges - Single Bed",
          hidden: false,
        },
      ],
    } as unknown as HTMLSelectElement;

    filterEbookSelectOptions(select, "cheat");
    expect(select.options[0]?.hidden).toBe(false);
    expect(select.options[1]?.hidden).toBe(false);
    expect(select.options[2]?.hidden).toBe(true);
  });
});

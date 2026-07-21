import { describe, expect, it, vi } from "vitest";

import {
  buildStoreFulfillmentDisplay,
  calculateShippingDifference,
  createStoreFulfillment,
  deleteStoreFulfillment,
  getCustomerStoreFulfillments,
  normalizeShopifyOrderNumber,
  STORE_FULFILLMENTS_BY_CUSTOMER_SQL,
  updateStoreFulfillment,
  validateBoxCount,
  validateMoneyAmount,
  validateShopifyOrderNumber,
  validateStoreFulfillmentWriteInput,
  validateSupplier,
} from "./storeFulfillments";

const memberId = "mem_customer_1";

const baseRow = {
  id: "fulfillment-1",
  memberid: memberId,
  shopify_order_id: null,
  shopify_order_number: "1234",
  product_description: "Silver Reed SK840",
  product_variant_id: null,
  supplier: "Silver Reed",
  carrier: "UPS",
  tracking_number: "1Z999",
  actual_shipping_cost: "85.50",
  customer_shipping_charge: "100.00",
  box_count: 1,
  ship_date: "2026-07-20",
  supplier_invoice_number: "INV-9",
  destination_state: "OR",
  destination_postal: "97005",
  internal_notes: "Machine + ribber",
  created_at: "2026-07-20T15:00:00.000Z",
  updated_at: null,
};

describe("storeFulfillments validation", () => {
  it("normalizes Shopify order numbers by trimming and removing a leading #", () => {
    expect(normalizeShopifyOrderNumber("  #1234  ")).toBe("1234");
    expect(validateShopifyOrderNumber("#5678")).toEqual({ ok: true, value: "5678" });
    expect(validateShopifyOrderNumber("   ").ok).toBe(false);
  });

  it("requires core fields and rejects negative shipping costs", () => {
    const missing = validateStoreFulfillmentWriteInput({
      memberid: memberId,
      shopifyOrderNumber: "",
      productDescription: "Machine",
      supplierOption: "Silver Reed",
      carrier: "UPS",
      actualShippingCost: "10",
      shipDate: "2026-07-20",
    });
    expect(missing.ok).toBe(false);

    expect(validateMoneyAmount("-1", "Actual shipping cost", { required: true })).toEqual({
      ok: false,
      error: "Actual shipping cost cannot be negative.",
    });
    expect(validateMoneyAmount("12.5", "Actual shipping cost", { required: true })).toEqual({
      ok: true,
      value: 12.5,
    });
  });

  it("rejects invalid box counts and defaults blank to 1", () => {
    expect(validateBoxCount("")).toEqual({ ok: true, value: 1 });
    expect(validateBoxCount(0).ok).toBe(false);
    expect(validateBoxCount(-2).ok).toBe(false);
    expect(validateBoxCount(1.5).ok).toBe(false);
    expect(validateBoxCount("3")).toEqual({ ok: true, value: 3 });
  });

  it("requires free-text supplier when Other is selected", () => {
    expect(validateSupplier("Other", "")).toEqual({
      ok: false,
      error: "Supplier name is required when Other is selected.",
    });
    expect(validateSupplier("Other", "  Acme Knits  ")).toEqual({
      ok: true,
      value: "Acme Knits",
    });
    expect(validateSupplier("Taitexma")).toEqual({ ok: true, value: "Taitexma" });
  });

  it("stores blank tracking numbers as null", () => {
    const result = validateStoreFulfillmentWriteInput({
      memberid: memberId,
      shopifyOrderNumber: "#1001",
      productDescription: "Ribber",
      supplierOption: "Taitexma",
      carrier: "FedEx",
      trackingNumber: "   ",
      actualShippingCost: "40",
      shipDate: "2026-07-21",
      boxCount: "2",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.trackingNumber).toBeNull();
      expect(result.value.shopifyOrderNumber).toBe("1001");
      expect(result.value.boxCount).toBe(2);
    }
  });
});

describe("storeFulfillments shipping difference", () => {
  it("calculates customer charge minus actual cost with surplus and shortfall labels", () => {
    expect(calculateShippingDifference(100, 85.5)).toMatchObject({
      amount: 14.5,
      label: "Shipping collected above cost",
      tone: "surplus",
    });
    expect(calculateShippingDifference(50, 75)).toMatchObject({
      amount: -25,
      label: "Shipping shortfall",
      tone: "shortfall",
    });
    expect(calculateShippingDifference(40, 40)).toMatchObject({
      amount: 0,
      label: "Shipping matches cost",
      tone: "match",
    });
    expect(calculateShippingDifference(null, 40).tone).toBe("unknown");
  });
});

describe("storeFulfillments queries", () => {
  it("creates, updates, and deletes fulfillment records", async () => {
    const createQuery = vi.fn().mockResolvedValueOnce([baseRow]);
    const createResult = await createStoreFulfillment(
      {
        memberid: memberId,
        shopifyOrderNumber: " #1234 ",
        productDescription: " Silver Reed SK840 ",
        supplierOption: "Silver Reed",
        carrier: "UPS",
        trackingNumber: " 1Z999 ",
        actualShippingCost: "85.50",
        customerShippingCharge: "100",
        boxCount: "1",
        shipDate: "2026-07-20",
        supplierInvoiceNumber: "INV-9",
        destinationState: "OR",
        destinationPostal: "97005",
        internalNotes: "Machine + ribber",
      },
      createQuery,
    );

    expect(createResult.ok).toBe(true);
    expect(createQuery.mock.calls[0]?.[1]).toEqual([
      memberId,
      null,
      "1234",
      "Silver Reed SK840",
      null,
      "Silver Reed",
      "UPS",
      "1Z999",
      85.5,
      100,
      1,
      "2026-07-20",
      "INV-9",
      "OR",
      "97005",
      "Machine + ribber",
    ]);

    const updatedRow = {
      ...baseRow,
      actual_shipping_cost: "90.00",
      tracking_number: "1Z888",
      updated_at: "2026-07-21T12:00:00.000Z",
    };
    const updateQuery = vi
      .fn()
      .mockResolvedValueOnce([baseRow])
      .mockResolvedValueOnce([updatedRow]);
    const updateResult = await updateStoreFulfillment(
      {
        id: "fulfillment-1",
        memberid: memberId,
        shopifyOrderNumber: "1234",
        productDescription: "Silver Reed SK840",
        supplierOption: "Silver Reed",
        carrier: "UPS",
        trackingNumber: "1Z888",
        actualShippingCost: "90",
        customerShippingCharge: "100",
        boxCount: 1,
        shipDate: "2026-07-20",
      },
      updateQuery,
    );
    expect(updateResult.ok).toBe(true);
    if (updateResult.ok) {
      expect(updateResult.value.actualShippingCostValue).toBe(90);
      expect(updateResult.value.trackingNumber).toBe("1Z888");
    }

    const deleteQuery = vi.fn().mockResolvedValueOnce([{ id: "fulfillment-1" }]);
    const deleteResult = await deleteStoreFulfillment("fulfillment-1", deleteQuery);
    expect(deleteResult).toEqual({ ok: true, value: { id: "fulfillment-1" } });
  });

  it("allows multiple shipments for one Shopify order when tracking differs", async () => {
    const first = vi.fn().mockResolvedValueOnce([baseRow]);
    const secondRow = {
      ...baseRow,
      id: "fulfillment-2",
      tracking_number: "1Z777",
      actual_shipping_cost: "40.00",
    };
    const second = vi.fn().mockResolvedValueOnce([secondRow]);

    const firstResult = await createStoreFulfillment(
      {
        memberid: memberId,
        shopifyOrderNumber: "1234",
        productDescription: "Silver Reed SK840",
        supplierOption: "Silver Reed",
        carrier: "UPS",
        trackingNumber: "1Z999",
        actualShippingCost: "85.50",
        shipDate: "2026-07-20",
      },
      first,
    );
    const secondResult = await createStoreFulfillment(
      {
        memberid: memberId,
        shopifyOrderNumber: "1234",
        productDescription: "SRP60N Ribber",
        supplierOption: "Silver Reed",
        carrier: "UPS",
        trackingNumber: "1Z777",
        actualShippingCost: "40",
        shipDate: "2026-07-21",
      },
      second,
    );

    expect(firstResult.ok).toBe(true);
    expect(secondResult.ok).toBe(true);
    expect(first.mock.calls[0]?.[1]?.[2]).toBe("1234");
    expect(second.mock.calls[0]?.[1]?.[2]).toBe("1234");
    expect(first.mock.calls[0]?.[1]?.[7]).toBe("1Z999");
    expect(second.mock.calls[0]?.[1]?.[7]).toBe("1Z777");
  });

  it("maps unique-violation errors to a duplicate tracking message", async () => {
    const queryFn = vi.fn().mockRejectedValueOnce({ code: "23505" });
    const result = await createStoreFulfillment(
      {
        memberid: memberId,
        shopifyOrderNumber: "1234",
        productDescription: "Machine",
        supplierOption: "Silver Reed",
        carrier: "UPS",
        trackingNumber: "1Z999",
        actualShippingCost: "10",
        shipDate: "2026-07-20",
      },
      queryFn,
    );
    expect(result).toEqual({
      ok: false,
      error: "A fulfillment with this Shopify order number and tracking number already exists.",
    });
  });

  it("loads customer fulfillments across Memberstack and legacy IDs", async () => {
    const queryFn = vi.fn().mockResolvedValueOnce([baseRow]);
    const rows = await getCustomerStoreFulfillments("mem_customer_1", "LEGACY-1", queryFn);
    expect(queryFn).toHaveBeenCalledWith(STORE_FULFILLMENTS_BY_CUSTOMER_SQL, [
      "mem_customer_1",
      "LEGACY-1",
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.shopifyOrderNumber).toBe("1234");
  });

  it("builds display rows with shipping difference and preserved postal codes", () => {
    const display = buildStoreFulfillmentDisplay({
      ...baseRow,
      destination_postal: "07030",
      customer_shipping_charge: "70",
      actual_shipping_cost: "85",
    });
    expect(display.destinationPostal).toBe("07030");
    expect(display.shippingDifference).toMatchObject({
      amount: -15,
      label: "Shipping shortfall",
      tone: "shortfall",
    });
    expect(display.shipDateValue).toBe("2026-07-20");
  });
});

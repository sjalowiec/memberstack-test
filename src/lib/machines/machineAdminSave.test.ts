import { describe, expect, it } from "vitest";
import type { MachineRecord } from "./machineAdminFields";
import {
  applyMachineSave,
  assertMachineEditIdentity,
  editUrlForMachineId,
  parseEditQueryParam,
  selectMachineForEdit,
} from "./machineAdminSave";

/** Minimal fixtures mirroring the TH860 machine vs TR-850 ribber pair (ids 360 / 393). */
function fixtureCatalog(): MachineRecord[] {
  return [
    {
      machineId: 360,
      brand: "Taitexma",
      model: "TH860",
      productType: "machine",
      sale: {
        forSale: true,
        price: 1449,
        stripePaymentLink: null,
        status: "available",
        availabilityStatus: "backorder",
        expectedDate: null,
        shortDescriptionHtml: "TH860 short — machine only",
        longDescriptionHtml: "TH860 long — machine only",
        shippingNotes: null,
        featured: false,
      },
    },
    {
      machineId: 393,
      brand: "Taitexma",
      model: "TR-850",
      productType: "accessory",
      sale: {
        forSale: true,
        price: 1399,
        stripePaymentLink: null,
        status: "coming-soon",
        availabilityStatus: "available",
        expectedDate: null,
        shortDescriptionHtml: "TR-850 short — ribber only",
        longDescriptionHtml: "TR-850 long — ribber only",
        shippingNotes: null,
        featured: false,
      },
    },
  ];
}

describe("selectMachineForEdit / edit URLs", () => {
  it("edit URL for TR-850 contains 393, not the TH860 id 360", () => {
    const machines = fixtureCatalog();
    const tr = machines.find((m) => m.model === "TR-850")!;
    const th = machines.find((m) => m.model === "TH860")!;
    expect(editUrlForMachineId(tr.machineId as number)).toBe("/admin/machines?edit=393");
    expect(editUrlForMachineId(th.machineId as number)).toBe("/admin/machines?edit=360");
    expect(editUrlForMachineId(393)).not.toContain("360");
  });

  it("loads the correct record after navigating between TH860 and TR-850", () => {
    const machines = fixtureCatalog();

    // Open TH860 first (as if arriving via ?edit=360).
    const routeTh = parseEditQueryParam("?edit=360");
    expect(routeTh).toBe(360);
    const first = selectMachineForEdit(machines, routeTh!);
    expect(first?.model).toBe("TH860");
    expect(first?.machineId).toBe(360);
    expect(String(first?.sale && (first.sale as { longDescriptionHtml?: string }).longDescriptionHtml)).toContain(
      "machine only"
    );

    // Navigate to TR-850 (?edit=393) — must not retain TH860.
    const routeTr = parseEditQueryParam(editUrlForMachineId(393).split("?")[1] ?? "");
    expect(routeTr).toBe(393);
    const second = selectMachineForEdit(machines, routeTr!);
    expect(second?.model).toBe("TR-850");
    expect(second?.machineId).toBe(393);
    expect(second?.productType).toBe("accessory");
    expect(String(second?.sale && (second.sale as { longDescriptionHtml?: string }).longDescriptionHtml)).toContain(
      "ribber only"
    );
    expect(second?.machineId).not.toBe(first?.machineId);
  });

  it("does not resolve TR-850 via partial model matching", () => {
    const machines = fixtureCatalog();
    expect(selectMachineForEdit(machines, 850)).toBeUndefined();
    expect(parseEditQueryParam("?edit=TR-850")).toBeNull();
  });
});

describe("applyMachineSave identity protection", () => {
  it("editing TR-850 cannot alter TH860, even though both are Taitexma standard-gauge", () => {
    const machines = fixtureCatalog();
    const thBefore = structuredClone(machines[0]);

    const result = applyMachineSave(machines, {
      mode: "edit",
      expectedMachineId: 393,
      routeMachineId: 393,
      machine: {
        ...machines[1],
        sale: {
          ...(machines[1].sale as object),
          longDescriptionHtml: "Updated TR-850 ribber copy only",
        },
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const thAfter = result.machines.find((m) => m.machineId === 360);
    const trAfter = result.machines.find((m) => m.machineId === 393);
    expect(thAfter).toEqual(thBefore);
    expect((thAfter?.sale as { longDescriptionHtml?: string })?.longDescriptionHtml).toBe(
      "TH860 long — machine only"
    );
    expect((trAfter?.sale as { longDescriptionHtml?: string })?.longDescriptionHtml).toBe(
      "Updated TR-850 ribber copy only"
    );
  });

  it("rejects save when route id, loaded id, and submitted id do not all match", () => {
    expect(
      assertMachineEditIdentity({
        mode: "edit",
        routeMachineId: 360,
        editingId: 393,
        submittedId: 393,
      }).ok
    ).toBe(false);

    expect(
      assertMachineEditIdentity({
        mode: "edit",
        routeMachineId: 393,
        editingId: 393,
        submittedId: 360,
      }).ok
    ).toBe(false);

    const rejected = applyMachineSave(fixtureCatalog(), {
      mode: "edit",
      expectedMachineId: 393,
      // Stale URL still pointing at the machine after opening the ribber form.
      routeMachineId: 360,
      machine: {
        machineId: 393,
        brand: "Taitexma",
        model: "TR-850",
        productType: "accessory",
        sale: {
          forSale: true,
          price: 1,
          stripePaymentLink: null,
          status: "available",
          availabilityStatus: "available",
          expectedDate: null,
          shortDescriptionHtml: "should not write",
          longDescriptionHtml: "should not write",
          shippingNotes: null,
          featured: false,
        },
      },
    });
    expect(rejected.ok).toBe(false);

    const matched = assertMachineEditIdentity({
      mode: "edit",
      routeMachineId: 393,
      editingId: 393,
      submittedId: 393,
    });
    expect(matched).toEqual({ ok: true, id: 393 });
  });
});

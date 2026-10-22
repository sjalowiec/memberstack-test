import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BLUETOOTH_ROW_COUNTER_PATH,
  isBluetoothRowCounterProductionBlocked,
  isBluetoothRowCounterRoute,
} from "./bluetoothRowCounterAccess";

describe("isBluetoothRowCounterRoute", () => {
  it("matches the experiment path with or without a trailing slash", () => {
    expect(isBluetoothRowCounterRoute(BLUETOOTH_ROW_COUNTER_PATH)).toBe(true);
    expect(isBluetoothRowCounterRoute(`${BLUETOOTH_ROW_COUNTER_PATH}/`)).toBe(true);
  });

  it("does not match other routes", () => {
    expect(isBluetoothRowCounterRoute("/dev/drop-shoulder-diagram-review")).toBe(false);
    expect(isBluetoothRowCounterRoute("/patterns/")).toBe(false);
    expect(isBluetoothRowCounterRoute("/dev/bluetooth-row-counter-extra")).toBe(false);
  });
});

describe("isBluetoothRowCounterProductionBlocked", () => {
  it("blocks production custom domains", () => {
    expect(isBluetoothRowCounterProductionBlocked("knititnow.com")).toBe(true);
    expect(isBluetoothRowCounterProductionBlocked("www.knititnow.com")).toBe(true);
    expect(isBluetoothRowCounterProductionBlocked("app.knitbymachine.com")).toBe(true);
  });

  it("allows localhost, Astro dev, kin-dev, and Netlify previews", () => {
    expect(isBluetoothRowCounterProductionBlocked("localhost", { isViteDev: true })).toBe(false);
    expect(isBluetoothRowCounterProductionBlocked("localhost")).toBe(false);
    expect(isBluetoothRowCounterProductionBlocked("127.0.0.1")).toBe(false);
    expect(isBluetoothRowCounterProductionBlocked("kin-dev.netlify.app")).toBe(false);
    expect(isBluetoothRowCounterProductionBlocked("deploy-preview--kin.netlify.app")).toBe(false);
  });
});

describe("bluetooth row counter production gate", () => {
  it("is wired in middleware and the page", () => {
    const middleware = readFileSync(resolve("src/middleware.ts"), "utf8");
    const page = readFileSync(resolve("src/pages/dev/bluetooth-row-counter.astro"), "utf8");
    expect(middleware).toContain("isBluetoothRowCounterRoute");
    expect(middleware).toContain("isBluetoothRowCounterProductionBlocked");
    expect(page).toContain("isBluetoothRowCounterProductionBlocked");
    expect(page).toContain('status: 404');
  });
});

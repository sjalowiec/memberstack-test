import { afterEach, describe, expect, it, vi } from "vitest";
import { LEGACY_TH160_COURSE_PLAN_ID } from "../../config/legacyCourseEntitlements";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  createAccountMyCoursesController,
  isAccountMyCoursesPayloadReady,
} from "./accountMyCoursesInit";

function loggedOutPayload() {
  return { data: { member: null, app: {}, sessionData: {} } };
}

function loggedInMissingPlans() {
  return {
    data: {
      id: "mem_test",
      auth: { email: "member@example.com" },
    },
  };
}

function loggedInWithLegacyTh160() {
  return {
    data: {
      id: "mem_test",
      auth: { email: "member@example.com" },
      planConnections: [{ planId: LEGACY_TH160_COURSE_PLAN_ID, status: "ACTIVE" }],
    },
  };
}

describe("isAccountMyCoursesPayloadReady", () => {
  it("treats null and logged-out payloads as ready (hide the panel)", () => {
    expect(isAccountMyCoursesPayloadReady(null)).toBe(true);
    expect(isAccountMyCoursesPayloadReady(loggedOutPayload())).toBe(true);
  });

  it("waits when a logged-in member is missing planConnections", () => {
    expect(isAccountMyCoursesPayloadReady(loggedInMissingPlans())).toBe(false);
  });

  it("is ready when a logged-in member has a planConnections array", () => {
    expect(isAccountMyCoursesPayloadReady(loggedInWithLegacyTh160())).toBe(true);
    expect(
      isAccountMyCoursesPayloadReady({
        data: { id: "mem_free", planConnections: [] },
      }),
    ).toBe(true);
  });
});

describe("createAccountMyCoursesController delayed dashboard / login", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("binds auth listeners even when the My Courses panel is not in the DOM yet", () => {
    const windowListeners: Array<{ type: string; listener: () => void }> = [];
    const msEvents: string[] = [];
    const applyView = vi.fn();
    let root: HTMLElement | null = null;

    const controller = createAccountMyCoursesController({
      getRoot: () => root,
      applyView,
      readPayload: async () => loggedInWithLegacyTh160(),
      addWindowListener: (type, listener) => {
        windowListeners.push({ type, listener });
      },
      getMemberstack: () => ({
        on: (event) => {
          msEvents.push(event);
        },
      }),
      startObserver: () => ({ disconnect: vi.fn() }),
    });

    controller.boot();

    expect(windowListeners.map((row) => row.type)).toEqual(["auth:updated"]);
    expect(msEvents).toEqual(["member.login", "member.logout"]);
    expect(applyView).not.toHaveBeenCalled();
  });

  it("hydrates after Memberstack inserts the members-only dashboard", async () => {
    const applyView = vi.fn();
    let root: HTMLElement | null = null;
    let onMutate: (() => void) | null = null;
    const disconnect = vi.fn();

    const controller = createAccountMyCoursesController({
      getRoot: () => root,
      applyView,
      readPayload: async () => loggedInWithLegacyTh160(),
      addWindowListener: () => {},
      getMemberstack: () => ({ on: vi.fn() }),
      startObserver: (cb) => {
        onMutate = cb;
        return { disconnect };
      },
    });

    controller.boot();
    await Promise.resolve();
    expect(applyView).not.toHaveBeenCalled();
    expect(onMutate).toEqual(expect.any(Function));

    root = { id: "my-courses" } as HTMLElement;
    onMutate?.();
    await Promise.resolve();
    await Promise.resolve();

    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(applyView).toHaveBeenCalledTimes(1);
    expect(applyView.mock.calls[0]?.[0]).toBe(root);
    expect(applyView.mock.calls[0]?.[1]).toMatchObject({
      data: { planConnections: [{ planId: LEGACY_TH160_COURSE_PLAN_ID }] },
    });
  });

  it("hydrates on login after the initial page load without a refresh", async () => {
    const applyView = vi.fn();
    const root = { id: "my-courses" } as HTMLElement;
    const windowListeners: Array<{ type: string; listener: () => void }> = [];
    const msHandlers: Record<string, () => void> = {};
    let payload: unknown = loggedOutPayload();

    const controller = createAccountMyCoursesController({
      getRoot: () => root,
      applyView,
      readPayload: async () => payload,
      addWindowListener: (type, listener) => {
        windowListeners.push({ type, listener });
      },
      getMemberstack: () => ({
        on: (event, handler) => {
          msHandlers[event] = () => handler();
        },
      }),
      startObserver: () => ({ disconnect: vi.fn() }),
    });

    controller.boot();
    await Promise.resolve();
    await Promise.resolve();
    expect(applyView).toHaveBeenCalledTimes(1);
    expect(applyView.mock.calls[0]?.[1]).toBeNull();

    payload = loggedInWithLegacyTh160();
    msHandlers["member.login"]?.();
    await Promise.resolve();
    await Promise.resolve();

    expect(applyView).toHaveBeenCalledTimes(2);
    expect(applyView.mock.calls[1]?.[1]).toMatchObject({
      data: { planConnections: [{ planId: LEGACY_TH160_COURSE_PLAN_ID }] },
    });

    windowListeners[0]?.listener();
    await Promise.resolve();
    await Promise.resolve();
    expect(applyView).toHaveBeenCalledTimes(3);
  });

  it("retries when an early logged-in payload is missing planConnections", async () => {
    const applyView = vi.fn();
    const root = { id: "my-courses" } as HTMLElement;
    let payload: unknown = loggedInMissingPlans();
    const windowListeners: Array<() => void> = [];

    const controller = createAccountMyCoursesController({
      getRoot: () => root,
      applyView,
      readPayload: async () => payload,
      addWindowListener: (_type, listener) => {
        windowListeners.push(listener);
      },
      getMemberstack: () => ({ on: vi.fn() }),
      startObserver: () => ({ disconnect: vi.fn() }),
    });

    controller.boot();
    await Promise.resolve();
    await Promise.resolve();
    expect(applyView).not.toHaveBeenCalled();

    payload = loggedInWithLegacyTh160();
    windowListeners[0]?.();
    await Promise.resolve();
    await Promise.resolve();

    expect(applyView).toHaveBeenCalledTimes(1);
    expect(applyView.mock.calls[0]?.[1]).toMatchObject({
      data: { planConnections: [{ planId: LEGACY_TH160_COURSE_PLAN_ID }] },
    });
  });

  it("does not bind duplicate window or Memberstack listeners on a second boot", () => {
    const addWindowListener = vi.fn();
    const msOn = vi.fn();
    const applyView = vi.fn();
    const root = { id: "my-courses" } as HTMLElement;

    const controller = createAccountMyCoursesController({
      getRoot: () => root,
      applyView,
      readPayload: async () => null,
      addWindowListener,
      getMemberstack: () => ({ on: msOn }),
      startObserver: () => ({ disconnect: vi.fn() }),
    });

    controller.boot();
    controller.boot();

    expect(addWindowListener).toHaveBeenCalledTimes(1);
    expect(msOn).toHaveBeenCalledTimes(2);
    expect(msOn.mock.calls.map((call) => call[0])).toEqual(["member.login", "member.logout"]);
  });

  it("does not start a second observer while waiting for the dashboard", () => {
    const startObserver = vi.fn(() => ({ disconnect: vi.fn() }));
    const controller = createAccountMyCoursesController({
      getRoot: () => null,
      applyView: vi.fn(),
      readPayload: async () => loggedInWithLegacyTh160(),
      addWindowListener: vi.fn(),
      getMemberstack: () => null,
      startObserver,
    });

    controller.boot();
    void controller.sync();
    expect(startObserver).toHaveBeenCalledTimes(1);
  });
});

describe("account-my-courses boot source", () => {
  it("binds auth listeners before requiring the panel to exist", () => {
    const source = readFileSync(resolve("src/scripts/account-my-courses.ts"), "utf8");
    expect(source).toContain("createAccountMyCoursesController");
    expect(source).toContain("findAccountMyCoursesRoot");
    expect(source).not.toMatch(/if\s*\(\s*!root\s*\)\s*return\s*;/);
  });
});

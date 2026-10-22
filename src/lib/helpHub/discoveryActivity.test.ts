import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildHelpHubDiscoveryActivityEvent } from "./discoveryActivity";
import {
  appendHelpHubDiscoveryEvent,
  readHelpHubDiscoveryEventFileForTests,
  resetHelpHubDiscoveryActivityBackendForTests,
  useFileHelpHubDiscoveryActivityBackendForTests,
} from "./discoveryActivityStore";

describe("help hub discovery activity", () => {
  afterEach(() => {
    resetHelpHubDiscoveryActivityBackendForTests();
  });

  it("records the action and slug without personal information", () => {
    const built = buildHelpHubDiscoveryActivityEvent(
      {
        eventType: "surprise_me",
        slug: "Newer-Tip",
        identity: "guest",
        sourcePage: "/help-hub?q=sue@example.com",
        memberId: "mem_sb_123",
        email: "sue@example.com",
        question: "Why is my email sue@example.com here?",
        answer: "Do not store this.",
        visitorId: "device-123",
      },
      {
        verifiedMemberId: "mem_sb_123",
        now: "2026-10-17T15:00:00.000Z",
        env: { ALLOW_DEV_PATTERN_USER: "true" },
      },
    );
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.event.slug).toBe("newer-tip");
    expect(built.event.eventType).toBe("surprise_me");
    expect(built.event.identity).toBe("member");
    expect(built.event.sourcePage).toBe("/help-hub");
    expect(built.event.environment).toBe("dev");
    const stored = JSON.stringify(built.event);
    expect(stored).not.toContain("sue@");
    expect(stored).not.toContain("mem_");
    expect(stored).not.toContain("device-123");
    expect(stored).not.toContain("Do not store");
    expect(stored).not.toContain("memberId");
  });

  it("rejects an unknown action and a personal-looking slug", () => {
    expect(
      buildHelpHubDiscoveryActivityEvent({ eventType: "viewed", slug: "sponge-bar" }).ok,
    ).toBe(false);
    expect(
      buildHelpHubDiscoveryActivityEvent({
        eventType: "discovery_open",
        slug: "sue@example.com",
      }).ok,
    ).toBe(false);
  });

  it("writes the event without the question or a member id", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "kin-help-hub-discovery-"));
    useFileHelpHubDiscoveryActivityBackendForTests(dir);
    const built = buildHelpHubDiscoveryActivityEvent(
      {
        eventType: "favorite_save",
        slug: "sponge-bar",
        identity: "guest",
        sourcePage: "/help-hub",
      },
      { now: "2026-10-17T15:04:00.000Z", env: {} },
    );
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    await appendHelpHubDiscoveryEvent(built.event);
    const raw = await readHelpHubDiscoveryEventFileForTests(dir, built.event);
    expect(raw).toContain("favorite_save");
    expect(raw).toContain("sponge-bar");
    expect(raw).not.toContain("memberId");
    expect(raw).not.toContain("@");
    await rm(dir, { recursive: true, force: true });
  });
});

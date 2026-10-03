import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { helpHubLessonPlayerSrc, helpHubLessonSelectionAction } from "./helpHubLessonModal";

const here = dirname(fileURLToPath(import.meta.url));

describe("helpHubLessonSelectionAction", () => {
  it("opens the video only for a qualifying member", () => {
    expect(helpHubLessonSelectionAction("memberAccess")).toBe("video");
  });

  it("shows login or join for visitors and accounts without access", () => {
    expect(helpHubLessonSelectionAction("loggedOut")).toBe("gate");
    expect(helpHubLessonSelectionAction("loggedInNoAccess")).toBe("gate");
  });

  it("does not choose a video while access is still unknown", () => {
    expect(helpHubLessonSelectionAction(null)).toBe("wait");
    expect(helpHubLessonSelectionAction(undefined)).toBe("wait");
  });
});

describe("helpHubLessonPlayerSrc", () => {
  it("keeps a catalog player URL and starts playback", () => {
    expect(helpHubLessonPlayerSrc("https://player.vimeo.com/video/151858696?h=abc")).toBe(
      "https://player.vimeo.com/video/151858696?h=abc&autoplay=1",
    );
  });

  it("rejects anything that is not the Vimeo player", () => {
    expect(helpHubLessonPlayerSrc("https://vimeo.com/151858696")).toBe("");
    expect(helpHubLessonPlayerSrc("http://player.vimeo.com/video/151858696")).toBe("");
    expect(helpHubLessonPlayerSrc("https://evil.example/video/1")).toBe("");
    expect(helpHubLessonPlayerSrc("")).toBe("");
  });
});

describe("Help Hub lesson modal wiring", () => {
  const modalSource = readFileSync(join(here, "helpHubLessonModal.ts"), "utf8");
  const gateSource = readFileSync(
    join(here, "..", "..", "scripts", "helpHubMemberLessonGateClient.ts"),
    "utf8",
  );

  it("loads the catalog player only after the modal opens and traps focus", () => {
    expect(modalSource).toContain("fetchHelpHubLessonPlayerSrc");
    expect(modalSource).toContain("CATALOG_VIDEO_EMBED_API_PATH");
    expect(modalSource).toContain('event.key === "Escape"');
    expect(modalSource).toContain("trapHelpHubToolFocus");
    expect(modalSource).toContain("unlockHelpHubToolPageScroll");
    expect(modalSource).toContain("focusWithoutScroll(opener)");
    const clickStart = modalSource.indexOf('opener.addEventListener("click"');
    const clickBlock = modalSource.slice(clickStart, clickStart + 700);
    expect(clickBlock.indexOf("revealLessonGate(opener)")).toBeGreaterThan(-1);
    expect(clickBlock.indexOf("revealLessonGate(opener)")).toBeLessThan(
      clickBlock.indexOf("openHelpHubLessonModal(dialog, opener)"),
    );
    expect(clickBlock).not.toContain("fetchHelpHubLessonPlayerSrc");
    expect(modalSource).toContain("const src = await fetchHelpHubLessonPlayerSrc(contentId)");
  });

  it("sends login back to the Help Hub entry and closes the video without access", () => {
    expect(gateSource).toContain("initHelpHubLessonModals");
    expect(gateSource).toContain("data-ms-redirect");
    expect(gateSource).toContain("helpHubLessonReturn");
    expect(gateSource).toContain("closeActiveHelpHubLessonModal");
    expect(gateSource).toContain("helpHubLessonAccess");
  });
});

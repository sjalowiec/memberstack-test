import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  helpHubRelatedToolModal,
  helpHubToolDomId,
  helpHubToolLoginReturnPath,
} from "./relatedToolModal";

const here = dirname(fileURLToPath(import.meta.url));

describe("help hub related tool modal", () => {
  it("opens Band Pickup over the entry and leaves other links as navigation", () => {
    expect(helpHubRelatedToolModal("/tools/band-pickup/")).toEqual({
      title: "Band Pickup",
      toolPath: "/tools/band-pickup",
    });
    expect(helpHubRelatedToolModal("/tools/gauge-calculator")).toBeNull();
    expect(helpHubRelatedToolModal("https://knititnow.com/reference/repairs")).toBeNull();
  });

  it("returns login to the Help Hub entry path", () => {
    expect(helpHubToolLoginReturnPath("how-do-i-finish-the-front-edges-of-my-cardigan")).toBe(
      "/help-hub/how-do-i-finish-the-front-edges-of-my-cardigan",
    );
    expect(helpHubToolLoginReturnPath("../admin")).toBe("");
    expect(helpHubToolLoginReturnPath("")).toBe("");
  });

  it("builds a stable id fragment", () => {
    expect(helpHubToolDomId("cat-finishing/How Do I")).toBe("cat-finishing-how-do-i");
  });
});

describe("help hub tool modal markup", () => {
  const relatedTool = readFileSync(
    join(here, "../../components/help-hub/HelpHubRelatedTool.astro"),
    "utf8",
  );
  const calculator = readFileSync(
    join(here, "../../components/tools/BandPickupTool.astro"),
    "utf8",
  );
  const standalone = readFileSync(join(here, "../../pages/tools/band-pickup.astro"), "utf8");

  it("keeps the Help Hub page open and shows the tool title with Close", () => {
    expect(relatedTool).toContain('href={relatedTool.href}');
    expect(relatedTool).toContain("data-help-hub-tool-open");
    expect(relatedTool).toContain('role="dialog"');
    expect(relatedTool).toContain("aria-modal");
    expect(relatedTool).toMatch(/>\s*Close\s*</);
    expect(relatedTool).toContain("modal.title");
    expect(relatedTool).toContain('context="help-hub"');
    expect(relatedTool).toContain("loginReturnPath={loginReturnPath}");
  });

  it("replaces the tools back link inside the modal and keeps the standalone page", () => {
    expect(calculator).toContain("Back to Help Hub");
    expect(calculator).toContain("data-help-hub-tool-close");
    expect(calculator).toContain("<WizardBackLink");
    expect(calculator).toContain("<ToolGate");
    expect(calculator).toContain("<ToolPreviewGate");
    expect(standalone).toContain('context="page"');
    expect(standalone).toContain("<BandPickupTool");
    expect(standalone).not.toContain("Back to Help Hub");
  });
});

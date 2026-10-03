import { describe, expect, it } from "vitest";
import {
  findToolByRequestPath,
  isMemberOnlyToolPath,
  toolRequestPath,
} from "./toolMembership";

describe("tool membership path matching", () => {
  it("treats a trailing slash as the same tool page", () => {
    expect(toolRequestPath("/tools/band-pickup/")).toBe("/tools/band-pickup");
    expect(toolRequestPath("/tools/band-pickup")).toBe("/tools/band-pickup");
  });

  it("finds Band Pickup for the Tools page path and the Help Hub path", () => {
    const fromTools = findToolByRequestPath("/tools/band-pickup");
    const fromHelpHub = findToolByRequestPath("/tools/band-pickup/");

    expect(fromTools?.title).toBe("Band Pickup");
    expect(fromHelpHub).toEqual(fromTools);
    expect(fromTools?.membersonly).toBe(true);
    expect(isMemberOnlyToolPath("/tools/band-pickup/")).toBe(true);
  });

  it("does not mark free tools or off-site links as member tools", () => {
    expect(isMemberOnlyToolPath("/tools/gauge-calculator")).toBe(false);
    expect(isMemberOnlyToolPath("https://knititnow.com/reference/repairs")).toBe(false);
  });
});

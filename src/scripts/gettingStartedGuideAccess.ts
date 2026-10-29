/**
 * Show the guide only after a successful signup, a one-year recognition
 * marker, or a signed-in Memberstack member.
 * Members are not sent to ActiveCampaign.
 * Machine choices stay inside the mounted guide.
 */

import { initGatedVimeoEmbeds } from "./gatedVimeoEmbedClient";
import { initGettingStartedMachineIdentity } from "./gettingStartedMachineIdentity";
import { initGettingStartedSpongeVideoTabs } from "./gettingStartedSpongeVideoTabs";
import {
  guideSignupUnlock,
  readGettingStartedGuideMember,
  resolveGettingStartedGuideAccess,
  signedInMemberFromAccessSnapshot,
} from "../lib/gettingStarted/guideLead";
import {
  buildGettingStartedGuideLeadPayload,
  submitGettingStartedGuideLead,
} from "../lib/gettingStarted/guideLeadClient";
import {
  isGettingStartedGuideRecognized,
  markGettingStartedGuideRecognized,
} from "../lib/gettingStarted/guideLeadHint";

export function guideSectionsAreMounted(doc: ParentNode): boolean {
  return doc.querySelector("[data-gsg-guide][data-gsg-ready]") != null;
}

export function revealGettingStartedGuide(
  doc: Document,
  options: { focus?: boolean } = {},
): void {
  const mount = doc.querySelector<HTMLElement>("[data-gsg-guide]");
  const template = doc.querySelector<HTMLTemplateElement>("#gsg-guide-template");
  const gate = doc.querySelector<HTMLElement>("[data-gsg-gate]");
  if (!mount || !template) return;

  if (mount.getAttribute("data-gsg-ready") !== "true") {
    mount.append(template.content.cloneNode(true));
    mount.hidden = false;
    mount.setAttribute("data-gsg-ready", "true");
    initGettingStartedMachineIdentity(doc);
    initGettingStartedSpongeVideoTabs(mount);
    initGatedVimeoEmbeds(mount);
  }

  if (gate) gate.hidden = true;

  if (options.focus) {
    const heading = mount.querySelector("h2");
    if (heading instanceof HTMLElement) {
      heading.tabIndex = -1;
      heading.focus();
    }
  }
}

function showSignupError(form: HTMLFormElement, message: string): void {
  const error = form.querySelector<HTMLElement>("[data-gsg-signup-error]");
  if (!error) return;
  error.hidden = false;
  error.textContent = message;
}

/** Covers BaseLayout's Memberstack ready wait plus a paid-through lookup. */
const MEMBER_SNAPSHOT_WAIT_MS = 12000;

function waitForSignedInMemberSnapshot(): Promise<{ loggedIn: boolean }> {
  return new Promise((resolve) => {
    let timer = 0;
    const finish = (loggedIn: boolean) => {
      window.removeEventListener("kin:member-access", onEvent);
      window.clearTimeout(timer);
      resolve({ loggedIn });
    };
    const onEvent = (event: Event) => {
      const detail = (event as CustomEvent<{ viewerAccessState?: string }>).detail;
      const decision = signedInMemberFromAccessSnapshot(detail);
      if (decision == null) return;
      finish(decision);
    };
    window.addEventListener("kin:member-access", onEvent);
    const already = signedInMemberFromAccessSnapshot(window.__KIN_MEMBER_ACCESS__);
    if (already != null) {
      finish(already);
      return;
    }
    timer = window.setTimeout(() => {
      finish(signedInMemberFromAccessSnapshot(window.__KIN_MEMBER_ACCESS__) === true);
    }, MEMBER_SNAPSHOT_WAIT_MS);
  });
}

/**
 * Use the site access snapshot when Memberstack has already resolved.
 * Otherwise read getAppAndMember, then wait for the snapshot.
 * This never sends the member to ActiveCampaign.
 */
export async function readGuideMemberBypass(): Promise<{ loggedIn: boolean }> {
  const published = signedInMemberFromAccessSnapshot(window.__KIN_MEMBER_ACCESS__);
  if (published != null) return { loggedIn: published };

  const direct = await readGettingStartedGuideMember();
  if (direct.loggedIn) return direct;

  const afterRead = signedInMemberFromAccessSnapshot(window.__KIN_MEMBER_ACCESS__);
  if (afterRead != null) return { loggedIn: afterRead };

  return waitForSignedInMemberSnapshot();
}

function showGuideSignup(doc: Document): void {
  if (guideSectionsAreMounted(doc)) return;
  const gate = doc.querySelector<HTMLElement>("[data-gsg-gate]");
  if (gate) gate.hidden = false;
}

export function initGettingStartedGuideAccess(doc: Document = document): void {
  const form = doc.querySelector<HTMLFormElement>("[data-gsg-signup]");
  if (!form || form.dataset.gsgBound === "true") return;
  form.dataset.gsgBound = "true";

  const recognized = isGettingStartedGuideRecognized();
  if (recognized) revealGettingStartedGuide(doc);

  window.addEventListener("kin:member-access", (event: Event) => {
    const detail = (event as CustomEvent<{ viewerAccessState?: string }>).detail;
    const decision = signedInMemberFromAccessSnapshot(detail);
    if (decision == null) return;
    if (decision) revealGettingStartedGuide(doc);
    else showGuideSignup(doc);
  });

  if (!guideSectionsAreMounted(doc)) {
    void resolveGettingStartedGuideAccess({
      recognized: false,
      readMember: readGuideMemberBypass,
    })
      .then((access) => {
        if (access === "show-guide") revealGettingStartedGuide(doc);
        else showGuideSignup(doc);
      })
      .catch(() => {
        showGuideSignup(doc);
      });
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (form.dataset.submitting === "true") return;

    const firstName = form.querySelector<HTMLInputElement>("[name=firstName]")?.value ?? "";
    const email = form.querySelector<HTMLInputElement>("[name=email]")?.value ?? "";
    const botField = form.querySelector<HTMLInputElement>("[name=bot-field]")?.value ?? "";
    const built = buildGettingStartedGuideLeadPayload({ firstName, email, botField });
    if ("error" in built) {
      showSignupError(form, built.error);
      return;
    }

    const submitButton = form.querySelector<HTMLButtonElement>("[type=submit]");
    form.dataset.submitting = "true";
    if (submitButton) submitButton.disabled = true;
    const error = form.querySelector<HTMLElement>("[data-gsg-signup-error]");
    if (error) error.hidden = true;

    void submitGettingStartedGuideLead(built)
      .then((result) => {
        const unlock = guideSignupUnlock(result);
        if (!unlock.unlock) {
          showSignupError(form, unlock.error);
          return;
        }
        markGettingStartedGuideRecognized();
        revealGettingStartedGuide(doc, { focus: true });
      })
      .finally(() => {
        form.dataset.submitting = "false";
        if (submitButton && !guideSectionsAreMounted(doc)) submitButton.disabled = false;
      });
  });
}

/**
 * Shows the member keep-access offer after Memberstack resolves.
 * Unresolved auth leaves the block hidden. Checkout stays on the shared
 * one-time course purchase button.
 */
import {
  resolveMemberCourseKeepAccess,
  type MemberCourseKeepAccessView,
} from "../lib/kinCourse/coursePurchase";
import {
  ensureHomeStudyPurchaseContext,
  verifiedHomeStudyCourseIdsForAccess,
} from "../lib/homeStudyPurchaseClient";
import { isKinCourseMemberstackResolved } from "../lib/kinCourse/accessGateState";
import { ensureLegacyPaidThroughContext } from "../lib/memberAccessClient";

export function applyMemberCourseKeepAccess(
  root: HTMLElement,
  view: MemberCourseKeepAccessView,
): void {
  const included = root.querySelector<HTMLElement>('[data-member-keep="included"]');
  const owned = root.querySelector<HTMLElement>('[data-member-keep="owned"]');
  const buy = root.querySelector<HTMLElement>('[data-member-keep="buy"]');
  root.dataset.memberKeep = view.kind;

  if (view.kind === "hidden") {
    root.hidden = true;
    return;
  }

  root.hidden = false;
  if (included) included.hidden = view.kind !== "included";
  if (owned) owned.hidden = view.kind !== "owned";
  if (buy) buy.hidden = view.kind !== "included";
}

async function waitForMemberstackReady({
  attempts = 30,
  delayMs = 200,
} = {}): Promise<{ ready: boolean; payload: unknown }> {
  let lastPayload: unknown = null;
  let waitedForReady = false;
  for (let i = 0; i < attempts; i++) {
    try {
      const ms = window.$memberstackDom;
      const api = ms?.getAppAndMember;
      if (typeof api === "function") {
        if (!waitedForReady && ms.onReady) {
          waitedForReady = true;
          await Promise.race([
            Promise.resolve(ms.onReady).catch(() => undefined),
            new Promise<void>((resolve) => setTimeout(resolve, 4000)),
          ]);
        }
        const payload = await api.call(ms);
        lastPayload = payload;
        if (isKinCourseMemberstackResolved(payload)) {
          return { ready: true, payload };
        }
      }
    } catch {
      /* keep polling until Memberstack is ready */
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return { ready: false, payload: lastPayload };
}

async function paintMemberCourseKeepAccess(root: ParentNode = document): Promise<void> {
  const nodes = [...root.querySelectorAll<HTMLElement>("[data-member-course-keep]")];
  if (!nodes.length) return;

  const res = await waitForMemberstackReady();
  if (!res.ready) {
    nodes.forEach((node) => applyMemberCourseKeepAccess(node, { kind: "hidden" }));
    return;
  }

  await ensureLegacyPaidThroughContext(res.payload);
  await ensureHomeStudyPurchaseContext(res.payload);
  const verifiedHomeStudyCourseIds = verifiedHomeStudyCourseIdsForAccess(res.payload);

  for (const node of nodes) {
    applyMemberCourseKeepAccess(
      node,
      resolveMemberCourseKeepAccess({
        memberOrPayload: res.payload,
        courseSlug: node.dataset.courseSlug ?? null,
        verifiedHomeStudyCourseIds,
      }),
    );
  }
}

const boundRoots = new WeakSet<HTMLElement>();

function bindAuthRefresh(node: HTMLElement): void {
  if (boundRoots.has(node)) return;
  const ms = window.$memberstackDom;
  if (typeof ms?.onAuthChange !== "function") return;
  boundRoots.add(node);
  ms.onAuthChange(() => void paintMemberCourseKeepAccess(document));
}

export function runMemberCourseKeepAccessBoot(): void {
  const start = () => {
    void paintMemberCourseKeepAccess();
    document.querySelectorAll<HTMLElement>("[data-member-course-keep]").forEach((node) => {
      bindAuthRefresh(node);
    });
    window.addEventListener("auth:updated", () => void paintMemberCourseKeepAccess());
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
}

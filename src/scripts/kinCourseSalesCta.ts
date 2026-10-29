/**
 * Button state for a public course sales page.
 *
 * Uses the same access decision as the course player (`canAccessCourse`):
 * active membership, or the course's mapped plan. Unresolved Memberstack
 * stays pending so the wrong button does not flash.
 */
import { canAccessCourse, normalizeCourseAccessLevel, type CourseAccessLevel } from "../lib/courseAccess";
import { videoDevBypass } from "../lib/devBypass";
import { isKinCourseMemberstackResolved } from "../lib/kinCourse/accessGateState";
import { localMemberPreviewBypassIsOn } from "../lib/localMemberPreviewBypass";
import { isMemberLoggedIn } from "../lib/memberAccess";
import { ensureLegacyPaidThroughContext } from "../lib/memberAccessClient";

/** Same three states as the course player gate. */
export type KinCourseSalesCtaState = "pending" | "open" | "loggedOut" | "loggedInNoAccess";

function salesCtaViewer(
  unlocked: boolean,
  memberOrPayload: unknown,
): Exclude<KinCourseSalesCtaState, "pending"> {
  if (unlocked) return "open";
  return isMemberLoggedIn(memberOrPayload) ? "loggedInNoAccess" : "loggedOut";
}

export function resolveKinCourseSalesCta(args: {
  memberstackReady: boolean;
  bypass?: boolean;
  access: CourseAccessLevel;
  memberOrPayload: unknown;
  courseSlug?: string | null;
}): KinCourseSalesCtaState {
  if (args.bypass) return "open";
  if (!args.memberstackReady) return "pending";
  const unlocked = canAccessCourse(args.access, args.memberOrPayload, {
    courseSlug: args.courseSlug,
  });
  return salesCtaViewer(unlocked, args.memberOrPayload);
}

export function applyKinCourseSalesCta(root: HTMLElement, state: KinCourseSalesCtaState): void {
  root.dataset.salesViewer = state;
  for (const name of ["pending", "open", "loggedOut", "loggedInNoAccess"] as const) {
    root.querySelectorAll<HTMLElement>(`[data-sales-cta="${name}"]`).forEach((el) => {
      el.hidden = state !== name;
    });
  }
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
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return { ready: false, payload: lastPayload };
}

async function paintSalesCtas(root: ParentNode = document): Promise<void> {
  const nodes = [...root.querySelectorAll<HTMLElement>("[data-kin-course-sales-cta]")];
  if (!nodes.length) return;

  const bypass = videoDevBypass || localMemberPreviewBypassIsOn();
  if (bypass) {
    nodes.forEach((node) => applyKinCourseSalesCta(node, "open"));
    return;
  }

  const res = await waitForMemberstackReady();
  if (!res.ready) {
    nodes.forEach((node) => applyKinCourseSalesCta(node, "pending"));
    return;
  }

  await ensureLegacyPaidThroughContext(res.payload);

  for (const node of nodes) {
    const access = normalizeCourseAccessLevel(node.dataset.courseAccess, "member");
    const courseSlug = node.dataset.courseSlug ?? null;
    applyKinCourseSalesCta(
      node,
      resolveKinCourseSalesCta({
        memberstackReady: true,
        access,
        memberOrPayload: res.payload,
        courseSlug,
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
  ms.onAuthChange(() => void paintSalesCtas(document));
}

export function runKinCourseSalesCtaBoot(): void {
  const start = () => {
    void paintSalesCtas();
    document.querySelectorAll<HTMLElement>("[data-kin-course-sales-cta]").forEach((node) => {
      bindAuthRefresh(node);
      window.addEventListener("auth:updated", () => void paintSalesCtas());
    });
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
}

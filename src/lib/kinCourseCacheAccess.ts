/**
 * Pre-paint Course 111 access from the same-origin Memberstack cache.
 *
 * `_ms-mem` is the member object the live SDK already persists. Entitlement
 * still uses `canAccessCourse` (membership allow list + SK840 slug mapping).
 * The inline script only embeds those generated IDs; it does not keep a
 * second plan list. Live `getAppAndMember()` remains the final gate.
 */
import {
  LEGACY_COURSE_PLAN_SLUGS,
} from "../config/legacyCourseEntitlements";
import { COURSE_ACCESS_PLAN_IDS } from "../config/memberships";
import { canAccessCourse } from "./courseAccess";
import { isMemberLoggedIn } from "./memberAccess";

export const KIN_COURSE_CACHE_ATTR = "data-kin-course-cache";
export const KIN_COURSE_MS_MEM_KEY = "_ms-mem";

export type KinCourseCacheUi = "open" | "locked" | "unknown";

export type KinCourseCacheAccessVars = {
  courseSlug: string;
  planIds: string[];
  slugByPlan: Record<string, readonly string[]>;
};

export function kinCourseCacheAccessVars(courseSlug: string): KinCourseCacheAccessVars {
  return {
    courseSlug,
    planIds: [...COURSE_ACCESS_PLAN_IDS],
    slugByPlan: { ...LEGACY_COURSE_PLAN_SLUGS },
  };
}

/** Same decision the live gate uses, from a cached member / payload. */
export function kinCourseCacheUiFromMember(
  memberOrPayload: unknown,
  courseSlug: string,
): KinCourseCacheUi {
  if (!isMemberLoggedIn(memberOrPayload)) return "unknown";
  return canAccessCourse("member", memberOrPayload, { courseSlug }) ? "open" : "locked";
}

export function clearKinCourseCachePaint(): void {
  document.documentElement.removeAttribute(KIN_COURSE_CACHE_ATTR);
}

function memberRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const root = value as Record<string, unknown>;
  const nested = root.member;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    return nested as Record<string, unknown>;
  }
  return root;
}

function activePlanIdsFromCachedMember(member: Record<string, unknown>, raw: unknown): string[] {
  const root = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const plans = member.planConnections ?? root.planConnections;
  if (!Array.isArray(plans)) return [];
  const ids: string[] = [];
  for (const conn of plans) {
    if (!conn || typeof conn !== "object" || Array.isArray(conn)) continue;
    const record = conn as Record<string, unknown>;
    if (record.active === false) continue;
    const status = String(record.status ?? "").trim().toUpperCase();
    if (status && status !== "ACTIVE" && status !== "TRIALING") continue;
    const planId = record.planId ?? record.plan ?? record.id;
    if (typeof planId === "string" && planId.trim()) ids.push(planId.trim());
  }
  return ids;
}

/** Inline-script equivalent of `kinCourseCacheUiFromMember` (no TS imports). */
export function kinCourseCacheUiFromInlineLogic(
  memberOrPayload: unknown,
  vars: KinCourseCacheAccessVars,
): KinCourseCacheUi {
  const member = memberRecord(memberOrPayload);
  if (!member) return "unknown";
  const id = member.id ?? member._id;
  if (!(typeof id === "string" ? id.trim() : id)) return "unknown";

  const ids = activePlanIdsFromCachedMember(member, memberOrPayload);
  if (ids.some((planId) => vars.planIds.includes(planId))) return "open";
  const slug = vars.courseSlug.trim();
  if (slug && ids.some((planId) => Boolean(vars.slugByPlan[planId]?.includes(slug)))) {
    return "open";
  }
  return "locked";
}

export function kinCourseCacheAccessInlineScript(courseSlug: string): string {
  const json = JSON.stringify(kinCourseCacheAccessVars(courseSlug)).replace(/</g, "\\u003c");
  return `(function(){try{var v=${json};var raw=localStorage.getItem("${KIN_COURSE_MS_MEM_KEY}");if(!raw)return;var parsed=JSON.parse(raw);var member=parsed&&parsed.member&&typeof parsed.member==="object"&&!Array.isArray(parsed.member)?parsed.member:parsed;if(!member||typeof member!=="object")return;var id=member.id||member._id;if(!(typeof id==="string"?id.trim():id))return;var plans=member.planConnections||parsed.planConnections;var ids=[];if(Array.isArray(plans)){for(var i=0;i<plans.length;i++){var c=plans[i];if(!c||typeof c!=="object")continue;if(c.active===false)continue;var st=String(c.status||"").trim().toUpperCase();if(st&&st!=="ACTIVE"&&st!=="TRIALING")continue;var pid=c.planId||c.plan||c.id;if(typeof pid==="string"&&pid.trim())ids.push(pid.trim());}}var open=false;for(var j=0;j<ids.length;j++){if(v.planIds.indexOf(ids[j])!==-1){open=true;break;}}if(!open&&v.courseSlug){for(var k=0;k<ids.length;k++){var slugs=v.slugByPlan[ids[k]];if(slugs&&slugs.indexOf(v.courseSlug)!==-1){open=true;break;}}}document.documentElement.setAttribute("${KIN_COURSE_CACHE_ATTR}",open?"open":"locked");}catch(e){}})();`;
}

export const KIN_COURSE_CACHE_PAINT_CSS = `
html[${KIN_COURSE_CACHE_ATTR}="open"] .course-111-gate__pending,
html[${KIN_COURSE_CACHE_ATTR}="open"] .course-111-gate [data-gated="locked"] {
  display: none !important;
}
html[${KIN_COURSE_CACHE_ATTR}="open"] .course-111-gate [data-gated="content"] {
  display: flex !important;
  flex-direction: column;
}
html[${KIN_COURSE_CACHE_ATTR}="locked"] .course-111-gate__pending,
html[${KIN_COURSE_CACHE_ATTR}="locked"] .course-111-gate [data-gated="content"] {
  display: none !important;
}
html[${KIN_COURSE_CACHE_ATTR}="locked"] .course-111-gate [data-gated="locked"] {
  display: block !important;
}
html[${KIN_COURSE_CACHE_ATTR}="locked"] [data-gate-copy="loggedOut"] {
  display: none !important;
}
html[${KIN_COURSE_CACHE_ATTR}="locked"] [data-gate-copy="loggedInNoAccess"] {
  display: block !important;
}
`.trim();

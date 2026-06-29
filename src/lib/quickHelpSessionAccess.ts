import { QUICK_HELP_SESSION } from "../config/quickHelpSession";

/** Active Memberstack plan/price connections that grant Quick Help scheduling access. */
export function hasQuickHelpSessionAccess(payload: unknown): boolean {
  const member = memberRecordFromPayload(payload);
  const connections = Array.isArray(member?.planConnections)
    ? (member!.planConnections as Record<string, unknown>[])
    : [];

  for (const conn of connections) {
    const status = String(conn?.status ?? "").toUpperCase();
    if (status && status !== "ACTIVE" && status !== "TRIALING") continue;

    const planId = typeof conn?.planId === "string" ? conn.planId.trim() : "";
    if (planId === QUICK_HELP_SESSION.memberstackPlanId) return true;

    const priceId = typeof conn?.priceId === "string" ? conn.priceId.trim() : "";
    if (priceId === QUICK_HELP_SESSION.memberstackPriceId) return true;
  }

  return false;
}

function memberRecordFromPayload(payload: unknown): Record<string, unknown> | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const root = payload as Record<string, unknown>;
  const data = root.data;
  if (data && typeof data === "object") return data as Record<string, unknown>;
  return root;
}

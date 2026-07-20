/**
 * Identity-safe machine admin save helpers.
 *
 * Product updates are keyed only by the immutable numeric `machineId`.
 * Partial model matches (e.g. both containing "860") must never select a record.
 */
import {
  machineId,
  normalizeMachineForSave,
  type MachineRecord,
} from "./machineAdminFields";

export type MachineSaveMode = "edit" | "new";

export type MachineSaveRequest = {
  machine: MachineRecord;
  /** Immutable id the client intends to write; must equal machine.machineId. */
  expectedMachineId: number;
  mode: MachineSaveMode;
  /**
   * Optional route `?edit=` id. Required for edit mode when provided by the
   * client; must equal expectedMachineId and the submitted record id.
   */
  routeMachineId?: number | null;
};

export type IdentityCheck = {
  mode: MachineSaveMode;
  /** machineId loaded into the form (`editingId`). */
  editingId: number | null;
  /** machineId from the form field / built record. */
  submittedId: number | null;
  /** machineId from the URL `?edit=` param (edit mode). */
  routeMachineId: number | null;
};

export type ApplySaveResult =
  | { ok: true; machines: MachineRecord[] }
  | { ok: false; error: string };

/** Exact-id lookup used by the edit form loader. No fuzzy/partial matching. */
export function selectMachineForEdit(
  machines: MachineRecord[],
  requestedId: number
): MachineRecord | undefined {
  if (!Number.isFinite(requestedId)) return undefined;
  return machines.find((m) => machineId(m) === requestedId);
}

/** Admin edit URL for a single product ù always embeds that product's machineId. */
export function editUrlForMachineId(id: number): string {
  return `/admin/machines?edit=${id}`;
}

/** Parse `?edit=<machineId>` from a query string or search string. */
export function parseEditQueryParam(search: string): number | null {
  const q = search.startsWith("?") ? search.slice(1) : search;
  const raw = new URLSearchParams(q).get("edit");
  if (!raw) return null;
  const id = Number.parseInt(raw, 10);
  return Number.isFinite(id) ? id : null;
}

/**
 * Reject saves when the route id, in-memory editing id, and submitted id diverge.
 * Edit mode requires all three to be the same finite machineId.
 */
export function assertMachineEditIdentity(
  check: IdentityCheck
): { ok: true; id: number } | { ok: false; error: string } {
  const { mode, editingId, submittedId, routeMachineId } = check;

  if (submittedId === null) {
    return { ok: false, error: "Could not determine machineId." };
  }

  if (mode === "new") {
    if (editingId !== null) {
      return {
        ok: false,
        error: "Create mode cannot target an existing editing id. Reload and try again.",
      };
    }
    if (routeMachineId !== null) {
      return {
        ok: false,
        error: `Create mode route id (${routeMachineId}) must be empty, not ${submittedId}.`,
      };
    }
    return { ok: true, id: submittedId };
  }

  // edit
  if (editingId === null) {
    return { ok: false, error: "Edit mode is missing the loaded machineId." };
  }
  if (routeMachineId === null) {
    return {
      ok: false,
      error: "Edit mode requires a route ?edit=<machineId> that matches the loaded record.",
    };
  }
  if (editingId !== submittedId || routeMachineId !== submittedId) {
    return {
      ok: false,
      error: `Identity mismatch: route=${routeMachineId}, loaded=${editingId}, submitted=${submittedId}. Save rejected.`,
    };
  }
  return { ok: true, id: submittedId };
}

/**
 * Apply one create/update by exact machineId. Never updates a different record,
 * even when brand/model strings are similar (e.g. TH860 vs TR-850).
 */
export function applyMachineSave(
  machines: MachineRecord[],
  request: MachineSaveRequest
): ApplySaveResult {
  const normalized = normalizeMachineForSave(request.machine, 0);
  if (!normalized.ok) return normalized;

  const submittedId = machineId(normalized.machine);
  if (submittedId === null) {
    return { ok: false, error: "Machine is missing a numeric machineId." };
  }
  if (submittedId !== request.expectedMachineId) {
    return {
      ok: false,
      error: `Submitted machineId ${submittedId} does not match expectedMachineId ${request.expectedMachineId}.`,
    };
  }

  const identity = assertMachineEditIdentity({
    mode: request.mode,
    editingId: request.mode === "edit" ? request.expectedMachineId : null,
    submittedId,
    routeMachineId:
      request.routeMachineId === undefined
        ? request.mode === "edit"
          ? request.expectedMachineId
          : null
        : request.routeMachineId,
  });
  if (!identity.ok) return identity;

  if (request.mode === "new") {
    if (machines.some((m) => machineId(m) === submittedId)) {
      return {
        ok: false,
        error: `machineId ${submittedId} already exists. Reload and try again.`,
      };
    }
    return { ok: true, machines: [...machines, normalized.machine] };
  }

  const idx = machines.findIndex((m) => machineId(m) === request.expectedMachineId);
  if (idx < 0) {
    return {
      ok: false,
      error: `No machine with machineId ${request.expectedMachineId} exists.`,
    };
  }

  const next = machines.slice();
  next[idx] = normalized.machine;
  return { ok: true, machines: next };
}

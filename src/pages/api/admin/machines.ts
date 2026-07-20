import type { APIRoute } from "astro";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  machineId,
  normalizeMachineForSave,
  type MachineRecord,
} from "../../../lib/machines/machineAdminFields";
import {
  applyMachineSave,
  type MachineSaveMode,
} from "../../../lib/machines/machineAdminSave";

export const prerender = false;

// Canonical reference catalog used by the public Machine Library
// (/reference/machines). Lives at the repo root, not under src/.
const MACHINES_JSON_PATH = join(process.cwd(), "data", "machines.json");

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * The legacy export contains bare `NaN` tokens which are not valid JSON, so we
 * replace them with `null` before parsing. Saving rewrites the file as valid,
 * readable JSON (2-space indent), so future reads are a no-op for that replace.
 */
function readMachinesArray(): MachineRecord[] {
  const raw = readFileSync(MACHINES_JSON_PATH, "utf-8");
  const data = JSON.parse(raw.replace(/\bNaN\b/g, "null")) as unknown;
  if (!Array.isArray(data)) {
    throw new Error("machines.json must contain a JSON array.");
  }
  return data as MachineRecord[];
}

function writeMachinesArray(machines: MachineRecord[]) {
  writeFileSync(MACHINES_JSON_PATH, JSON.stringify(machines, null, 2) + "\n", "utf-8");
}

export const GET: APIRoute = async () => {
  try {
    const machines = readMachinesArray();
    return jsonResponse({ ok: true, machines });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not read machines.json";
    return jsonResponse({ ok: false, error: message }, 500);
  }
};

/**
 * Single-record create/update by exact machineId.
 *
 * Body:
 *   {
 *     machine: MachineRecord,
 *     expectedMachineId: number,
 *     mode: "edit" | "new",
 *     routeMachineId?: number | null
 *   }
 *
 * Rejects when route / expected / submitted ids diverge, or when the write
 * would touch a different record.
 */
export const POST: APIRoute = async ({ request }) => {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return jsonResponse({ ok: false, error: "Content-Type must be application/json" }, 400);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON body" }, 400);
  }

  // Legacy full-array writes are no longer accepted — they could overwrite the
  // wrong product when the client held stale in-memory state.
  if (Array.isArray(body)) {
    return jsonResponse(
      {
        ok: false,
        error:
          "Full-array machine saves are no longer accepted. Send a single-record update with expectedMachineId.",
      },
      400
    );
  }

  if (!body || typeof body !== "object") {
    return jsonResponse({ ok: false, error: "Request body must be a JSON object." }, 400);
  }

  const payload = body as Record<string, unknown>;
  const mode = payload.mode;
  if (mode !== "edit" && mode !== "new") {
    return jsonResponse({ ok: false, error: 'Body must include mode: "edit" | "new".' }, 400);
  }

  const expectedMachineId =
    typeof payload.expectedMachineId === "number"
      ? payload.expectedMachineId
      : Number(payload.expectedMachineId);
  if (!Number.isFinite(expectedMachineId)) {
    return jsonResponse(
      { ok: false, error: "Body must include a numeric expectedMachineId." },
      400
    );
  }

  let routeMachineId: number | null | undefined = undefined;
  if ("routeMachineId" in payload) {
    if (payload.routeMachineId === null || payload.routeMachineId === "") {
      routeMachineId = null;
    } else {
      const n =
        typeof payload.routeMachineId === "number"
          ? payload.routeMachineId
          : Number(payload.routeMachineId);
      routeMachineId = Number.isFinite(n) ? n : null;
    }
  }

  // Normalize once up front so missing machineId fails with a clear 400.
  const pre = normalizeMachineForSave(payload.machine, 0);
  if (!pre.ok) return jsonResponse({ ok: false, error: pre.error }, 400);
  if (machineId(pre.machine) === null) {
    return jsonResponse({ ok: false, error: "Machine is missing a numeric machineId." }, 400);
  }

  try {
    const current = readMachinesArray();
    const applied = applyMachineSave(current, {
      machine: pre.machine,
      expectedMachineId,
      mode: mode as MachineSaveMode,
      routeMachineId,
    });
    if (!applied.ok) return jsonResponse({ ok: false, error: applied.error }, 400);

    writeMachinesArray(applied.machines);
    return jsonResponse({ ok: true, machines: applied.machines });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not write machines.json";
    return jsonResponse({ ok: false, error: message }, 500);
  }
};

import type { APIRoute } from "astro";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  machineId,
  normalizeMachineForSave,
  type MachineRecord,
} from "../../../lib/machines/machineAdminFields";

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

export const GET: APIRoute = async () => {
  try {
    const machines = readMachinesArray();
    return jsonResponse({ ok: true, machines });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not read machines.json";
    return jsonResponse({ ok: false, error: message }, 500);
  }
};

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

  if (!Array.isArray(body)) {
    return jsonResponse(
      { ok: false, error: "Request body must be a JSON array of machines." },
      400
    );
  }

  const seenIds = new Set<number>();
  const machines: MachineRecord[] = [];

  for (let i = 0; i < body.length; i++) {
    const n = normalizeMachineForSave(body[i], i);
    if (!n.ok) return jsonResponse({ ok: false, error: n.error }, 400);

    const id = machineId(n.machine);
    if (id === null) {
      return jsonResponse(
        { ok: false, error: `Machine #${i + 1} is missing a numeric machineId.` },
        400
      );
    }
    if (seenIds.has(id)) {
      return jsonResponse(
        { ok: false, error: `Duplicate machineId "${id}". Each machine id must be unique.` },
        400
      );
    }
    seenIds.add(id);
    machines.push(n.machine);
  }

  try {
    writeFileSync(MACHINES_JSON_PATH, JSON.stringify(machines, null, 2) + "\n", "utf-8");
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not write machines.json";
    return jsonResponse({ ok: false, error: message }, 500);
  }

  return jsonResponse({ ok: true, machines });
};

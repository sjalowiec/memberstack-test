import type { APIRoute } from "astro";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

export const prerender = false;

const execFileAsync = promisify(execFile);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const POST: APIRoute = async () => {
  if (!import.meta.env.DEV) {
    return json(
      {
        success: false,
        exitCode: -1,
        stdout: "",
        stderr: "Pattern validation runner is only available in local development (astro dev).",
      },
      403
    );
  }

  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

  try {
    const { stdout, stderr } = await execFileAsync(npmCmd, ["test"], {
      cwd: process.cwd(),
      maxBuffer: 20 * 1024 * 1024,
      encoding: "utf8",
      env: process.env,
    });
    return json({
      success: true,
      exitCode: 0,
      stdout: stdout ?? "",
      stderr: stderr ?? "",
    });
  } catch (err: unknown) {
    const e = err as {
      stdout?: string;
      stderr?: string;
      code?: number | string;
      message?: string;
    };
    const exitCode = typeof e.code === "number" ? e.code : 1;
    const stderrExtra = e.message && !String(e.stderr ?? "").includes(e.message) ? `\n${e.message}` : "";
    return json({
      success: false,
      exitCode,
      stdout: e.stdout ?? "",
      stderr: (e.stderr ?? "") + stderrExtra,
    });
  }
};

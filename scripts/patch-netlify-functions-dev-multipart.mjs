/**
 * Fix Netlify local Functions Dev multipart handling.
 *
 * @netlify/functions-dev builds Lambda events with:
 *   body = await request.text()
 *   isBase64Encoded = true  (for multipart/form-data)
 *
 * The body is therefore raw text, not base64. The Functions 2.0 bootstrap then
 * base64-decodes it into a corrupted Request (~50 bytes of garbage), which
 * breaks Contact Us on localhost (Astro + Netlify Vite plugin).
 *
 * This patch reads bytes via arrayBuffer() and base64-encodes when required.
 *
 * Safety:
 * - Never fails npm install (always exits 0).
 * - Skips entirely on Netlify CI/production builds.
 * - Skips when the local Dev package file is absent.
 * - Does not modify production runtime dependencies on Netlify.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const logPrefix = "[patch-netlify-functions-dev-multipart]";

function skip(reason) {
  console.log(`${logPrefix} Skip: ${reason}`);
  process.exit(0);
}

// Netlify sets NETLIFY=true during builds. Never patch there.
if (process.env.NETLIFY === "true") {
  skip("Netlify build environment (localhost-only patch)");
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(
  root,
  "node_modules",
  "@netlify",
  "functions-dev",
  "dist",
  "main.js",
);

const MARKER = "/* kbm-multipart-body-fix */";

const OLD = `  const body = await request.text() || null;
  return {
    rawUrl: url.toString(),
    rawQuery: url.search,
    path: url.pathname,
    httpMethod: request.method,
    headers,
    multiValueHeaders,
    queryStringParameters,
    multiValueQueryStringParameters,
    body,
    isBase64Encoded: shouldBase64Encode(request.headers.get("content-type") ?? ""),
    route
  };`;

const NEW = `  ${MARKER}
  const rawBody = Buffer.from(await request.arrayBuffer());
  const isBase64Encoded = shouldBase64Encode(request.headers.get("content-type") ?? "");
  const body = rawBody.length === 0 ? null : isBase64Encoded ? rawBody.toString("base64") : rawBody.toString("utf8");
  return {
    rawUrl: url.toString(),
    rawQuery: url.search,
    path: url.pathname,
    httpMethod: request.method,
    headers,
    multiValueHeaders,
    queryStringParameters,
    multiValueQueryStringParameters,
    body,
    isBase64Encoded,
    route
  };`;

if (!fs.existsSync(target)) {
  skip(`local Netlify Dev target not found (${path.relative(root, target)})`);
}

let source;
try {
  source = fs.readFileSync(target, "utf8");
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  skip(`unable to read target (${message})`);
}

if (source.includes(MARKER)) {
  skip("already applied");
}

if (!source.includes(OLD)) {
  // Package shape changed — do not fail installs.
  skip("target snippet not found; package may have changed");
}

try {
  fs.writeFileSync(target, source.replace(OLD, NEW), "utf8");
  console.log(`${logPrefix} Applied localhost multipart fix`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  skip(`unable to write target (${message})`);
}

process.exit(0);

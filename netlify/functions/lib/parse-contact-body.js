import Busboy from "@fastify/busboy";

const CONTACT_BODY_DEBUG = process.env.CONTACT_BODY_DEBUG === "true";

/**
 * @param {import("@netlify/functions").HandlerEvent | null | undefined} event
 * @returns {boolean}
 */
export function isHandlerEvent(event) {
  return (
    !!event &&
    typeof event === "object" &&
    typeof event.httpMethod === "string" &&
    !!event.headers &&
    "body" in event
  );
}

/**
 * @param {import("@netlify/functions").HandlerEvent} event
 */
export function decodeEventBody(event) {
  if (!event.body) {
    return Buffer.alloc(0);
  }
  if (event.isBase64Encoded) {
    return Buffer.from(event.body, "base64");
  }
  return Buffer.from(event.body, "latin1");
}

/**
 * Request for headers/URL only — do not attach event.body (may be truncated in Netlify Dev).
 * @param {import("@netlify/functions").HandlerEvent} event
 * @returns {Request}
 */
export function handlerEventToRequest(event) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(event.headers || {})) {
    if (value != null) {
      headers.set(key, value);
    }
  }

  const url =
    event.rawUrl ||
    `http://localhost${event.path || "/.netlify/functions/contact"}`;

  const bodyBuffer = decodeEventBody(event);

  return new Request(url, {
    method: event.httpMethod || "POST",
    headers,
    body: bodyBuffer.length > 0 ? bodyBuffer : undefined,
  });
}

/**
 * @param {string} contentType
 */
function extractBoundary(contentType) {
  const match = /boundary=(?:"([^"]+)"|([^\s;]+))/i.exec(contentType);
  return match ? (match[1] || match[2]) : null;
}

/**
 * @param {Buffer} buffer
 * @param {string | null} boundary
 */
function hasClosingMultipartBoundary(buffer, boundary) {
  if (!boundary || buffer.length === 0) {
    return false;
  }
  return buffer.includes(Buffer.from(`--${boundary}--`));
}

/**
 * @param {Request} req
 */
function headersFromRequest(req) {
  /** @type {Record<string, string>} */
  const headers = {};
  req.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });
  return headers;
}

/**
 * @param {Request} req
 */
async function readRequestBodyStream(req) {
  if (!req.body) {
    return Buffer.alloc(0);
  }

  /** @type {Buffer[]} */
  const chunks = [];
  const reader = req.body.getReader();

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    if (value) {
      chunks.push(Buffer.from(value));
    }
  }

  return Buffer.concat(chunks);
}

/**
 * @param {Request} req
 * @param {import("@netlify/functions").HandlerEvent | null | undefined} event
 */
async function collectBodyCandidates(req, event) {
  /** @type {{ source: string, buffer: Buffer, rawBodyLength?: number }[]} */
  const candidates = [];

  if (event && isHandlerEvent(event)) {
    candidates.push({
      source: "event.body",
      buffer: decodeEventBody(event),
      rawBodyLength:
        typeof event.body === "string" ? event.body.length : undefined,
    });
  }

  if (req instanceof Request) {
    if (req.body) {
      try {
        const cloned =
          typeof req.clone === "function" ? req.clone() : req;
        const streamBuffer = await readRequestBodyStream(cloned);
        candidates.push({
          source: "request.body",
          buffer: streamBuffer,
        });
      } catch {
        // ignore
      }
    }

    try {
      const cloned =
        typeof req.clone === "function" ? req.clone() : req;
      const arrayBuffer = Buffer.from(await cloned.arrayBuffer());
      candidates.push({
        source: "request.arrayBuffer",
        buffer: arrayBuffer,
      });
    } catch {
      // ignore
    }
  }

  return candidates;
}

/**
 * @param {{ source: string, buffer: Buffer, rawBodyLength?: number }[]} candidates
 * @param {string | null} boundary
 * @param {number | null} expectedContentLength
 */
function looksLikeMultipartBody(buffer) {
  return buffer.includes(Buffer.from("Content-Disposition:"));
}

function selectBestBodyCandidate(candidates, boundary, expectedContentLength) {
  const scored = candidates
    .filter((c) => c.buffer.length > 0)
    .map((c) => ({
      ...c,
      hasClosing: hasClosingMultipartBoundary(c.buffer, boundary),
    }));

  if (scored.length === 0) {
    return null;
  }

  const withClosing = scored.filter((c) => c.hasClosing);
  if (withClosing.length > 0) {
    withClosing.sort((a, b) => b.buffer.length - a.buffer.length);
    return withClosing[0];
  }

  if (expectedContentLength != null && expectedContentLength > 0) {
    const exact = scored.find((c) => c.buffer.length === expectedContentLength);
    if (exact) {
      return exact;
    }
    scored.sort((a, b) => b.buffer.length - a.buffer.length);
    const longest = scored[0];
    if (longest.buffer.length >= expectedContentLength) {
      return longest;
    }
  }

  // Last resort: parse the longest buffer that still looks like multipart.
  scored.sort((a, b) => b.buffer.length - a.buffer.length);
  const longest = scored[0];
  if (longest && looksLikeMultipartBody(longest.buffer)) {
    return longest;
  }

  return null;
}

/**
 * @param {{ source: string, buffer: Buffer }[]} candidates
 */
function pickLongestCandidate(candidates) {
  const nonEmpty = candidates.filter((c) => c.buffer.length > 0);
  if (nonEmpty.length === 0) {
    return null;
  }
  nonEmpty.sort((a, b) => b.buffer.length - a.buffer.length);
  return nonEmpty[0];
}

/**
 * @param {Record<string, string>} headers
 * @param {Buffer} buffer
 * @returns {Promise<FormData>}
 */
function parseMultipartBuffer(headers, buffer) {
  return new Promise((resolve, reject) => {
    /** @type {{ name: string, value: string }[]} */
    const fields = [];
    /** @type {{ name: string, file: File }[]} */
    const files = [];
    let pendingFiles = 0;
    let busboyFinished = false;

    const finishIfReady = () => {
      if (!busboyFinished || pendingFiles > 0) {
        return;
      }
      const formData = new FormData();
      for (const { name, value } of fields) {
        formData.append(name, value);
      }
      for (const { name, file } of files) {
        formData.append(name, file);
      }
      resolve(formData);
    };

    const busboy = Busboy({ headers });

    busboy.on("field", (name, value) => {
      fields.push({ name, value });
    });

    busboy.on("file", (name, fileStream, info) => {
      pendingFiles += 1;
      /** @type {Buffer[]} */
      const chunks = [];

      fileStream.on("data", (chunk) => {
        chunks.push(Buffer.from(chunk));
      });

      fileStream.on("end", () => {
        const content = Buffer.concat(chunks);
        const mimeType = info.mimeType || "application/octet-stream";
        const filename = info.filename || "upload";
        const file = new File([content], filename, { type: mimeType });
        files.push({ name, file });
        pendingFiles -= 1;
        finishIfReady();
      });

      fileStream.on("error", reject);
    });

    busboy.on("finish", () => {
      busboyFinished = true;
      finishIfReady();
    });

    busboy.on("error", reject);
    busboy.write(buffer);
    busboy.end();
  });
}

/**
 * @param {Buffer} buffer
 */
function formDataFromUrlEncodedBuffer(buffer) {
  const formData = new FormData();
  const text = buffer.toString("utf8");
  for (const [key, value] of new URLSearchParams(text)) {
    formData.append(key, value);
  }
  return formData;
}

/**
 * @param {Record<string, unknown>} debug
 * @param {Buffer} buffer
 */
function logBodyDebug(debug, buffer) {
  if (!CONTACT_BODY_DEBUG) {
    return;
  }

  const tail =
    buffer.length > 0
      ? buffer.subarray(Math.max(0, buffer.length - 200)).toString("latin1")
      : "";

  console.log("[contact] body parse debug:", {
    ...debug,
    last200Latin1: tail,
  });
}

/**
 * Prefer the platform Request.formData() parser; fall back to Busboy on the raw body.
 *
 * @param {Request} req
 * @param {import("@netlify/functions").HandlerEvent | null | undefined} [event]
 * @returns {Promise<FormData>}
 */
async function tryNativeRequestFormData(req) {
  if (!(req instanceof Request) || req.body == null) {
    return null;
  }

  const contentType = (req.headers.get("content-type") || "").toLowerCase();
  if (
    !contentType.includes("multipart/form-data") &&
    !contentType.includes("application/x-www-form-urlencoded")
  ) {
    return null;
  }

  try {
    const cloned = typeof req.clone === "function" ? req.clone() : req;
    return await cloned.formData();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("[contact] Request.formData() failed, using busboy fallback:", message);
    return null;
  }
}

/**
 * @param {Request} req
 * @param {import("@netlify/functions").HandlerEvent | null | undefined} [event]
 * @returns {Promise<FormData>}
 */
export async function parseContactFormData(req, event) {
  const nativeFormData = await tryNativeRequestFormData(req);
  if (nativeFormData) {
    return nativeFormData;
  }

  const contentType = (
    event?.headers?.["content-type"] ||
    event?.headers?.["Content-Type"] ||
    req.headers.get("content-type") ||
    ""
  ).toLowerCase();

  const boundary = extractBoundary(contentType);
  const contentLengthHeader =
    event?.headers?.["content-length"] ||
    event?.headers?.["Content-Length"] ||
    req.headers.get("content-length");
  const expectedContentLength = contentLengthHeader
    ? Number.parseInt(contentLengthHeader, 10)
    : null;

  /** @type {Record<string, unknown>} */
  const debug = {
    contentType,
    boundary: boundary || null,
    boundaryFound: !!boundary,
    isBase64Encoded: !!(event && event.isBase64Encoded),
    expectedContentLength:
      Number.isFinite(expectedContentLength) && expectedContentLength != null
        ? expectedContentLength
        : null,
  };

  const candidates = await collectBodyCandidates(req, event);

  for (const c of candidates) {
    debug[`${c.source}DecodedLength`] = c.buffer.length;
    if (c.rawBodyLength != null) {
      debug[`${c.source}RawLength`] = c.rawBodyLength;
    }
    debug[`${c.source}HasClosing`] = hasClosingMultipartBoundary(
      c.buffer,
      boundary,
    );
  }

  if (contentType.includes("multipart/form-data")) {
    const selected = selectBestBodyCandidate(
      candidates,
      boundary,
      Number.isFinite(expectedContentLength) ? expectedContentLength : null,
    );

    if (!selected) {
      logBodyDebug(
        {
          ...debug,
          bodySource: "none",
          bodyLength: 0,
          hasClosingBoundary: false,
        },
        Buffer.alloc(0),
      );
      throw new Error(
        "Incomplete multipart body (no usable body buffer from request or event)",
      );
    }

    debug.bodySource = selected.source;
    debug.bodyLength = selected.buffer.length;
    debug.hasClosingBoundary = selected.hasClosing;
    logBodyDebug(debug, selected.buffer);

    const headers = event ? { ...event.headers } : headersFromRequest(req);
    try {
      return await parseMultipartBuffer(headers, selected.buffer);
    } catch (parseError) {
      const message =
        parseError instanceof Error ? parseError.message : String(parseError);
      throw new Error(
        `Multipart busboy parse failed (${selected.source}, ${selected.buffer.length} bytes, closing=${selected.hasClosing}): ${message}`,
      );
    }
  }

  const longest = pickLongestCandidate(candidates);
  if (!longest) {
    throw new Error("Empty request body");
  }

  debug.bodySource = longest.source;
  debug.bodyLength = longest.buffer.length;
  logBodyDebug(debug, longest.buffer);

  if (contentType.includes("application/x-www-form-urlencoded")) {
    return formDataFromUrlEncodedBuffer(longest.buffer);
  }

  if (!contentType) {
    if (
      boundary ||
      longest.buffer.includes(Buffer.from("Content-Disposition:"))
    ) {
      if (!hasClosingMultipartBoundary(longest.buffer, boundary)) {
        throw new Error("Incomplete multipart body (missing closing boundary)");
      }
      const headers = event ? { ...event.headers } : headersFromRequest(req);
      return parseMultipartBuffer(headers, longest.buffer);
    }
    return formDataFromUrlEncodedBuffer(longest.buffer);
  }

  throw new Error(`Unsupported Content-Type: ${contentType}`);
}

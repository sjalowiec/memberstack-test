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
 * @param {Buffer} buffer
 */
function looksLikeMultipartBody(buffer) {
  return buffer.includes(Buffer.from("Content-Disposition:"));
}

/**
 * Pick the largest non-empty buffer that looks like multipart (closing boundary not required).
 *
 * @param {{ source: string, buffer: Buffer, rawBodyLength?: number }[]} candidates
 * @param {number | null} expectedContentLength
 */
function selectMultipartBodyCandidate(candidates, expectedContentLength) {
  const scored = candidates.filter((c) => c.buffer.length > 0);

  if (scored.length === 0) {
    return null;
  }

  const multipartLike = scored.filter((c) => looksLikeMultipartBody(c.buffer));
  const pool = multipartLike.length > 0 ? multipartLike : scored;

  if (expectedContentLength != null && expectedContentLength > 0) {
    const exact = pool.find((c) => c.buffer.length === expectedContentLength);
    if (exact) {
      return exact;
    }
  }

  pool.sort((a, b) => b.buffer.length - a.buffer.length);
  return pool[0] || null;
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
 * @param {Buffer} buffer
 * @param {string | null} boundary
 * @returns {FormData}
 */
function extractMultipartFieldsBestEffort(buffer, boundary) {
  const formData = new FormData();
  let resolvedBoundary = boundary;

  if (!resolvedBoundary && buffer.length > 0) {
    const head = buffer.subarray(0, Math.min(256, buffer.length)).toString("latin1");
    const inline = /^--([^\r\n]+)/.exec(head);
    if (inline) {
      resolvedBoundary = inline[1];
    }
  }

  if (!resolvedBoundary) {
    return formData;
  }

  const delimiter = Buffer.from(`--${resolvedBoundary}`);
  /** @type {number[]} */
  const indices = [];
  let searchFrom = 0;

  while (searchFrom < buffer.length) {
    const idx = buffer.indexOf(delimiter, searchFrom);
    if (idx === -1) {
      break;
    }
    indices.push(idx);
    searchFrom = idx + delimiter.length;
  }

  if (indices.length === 0) {
    return formData;
  }

  for (let i = 0; i < indices.length; i += 1) {
    const partStart = indices[i] + delimiter.length;
    const partEnd = i + 1 < indices.length ? indices[i + 1] : buffer.length;
    if (partStart >= partEnd) {
      continue;
    }

    let part = buffer.subarray(partStart, partEnd);
    if (part.length >= 2 && part[0] === 0x2d && part[1] === 0x2d) {
      continue;
    }
    if (part.length >= 2 && part[0] === 0x0d && part[1] === 0x0a) {
      part = part.subarray(2);
    } else if (part.length >= 1 && part[0] === 0x0a) {
      part = part.subarray(1);
    }

    const headerEnd = part.indexOf(Buffer.from("\r\n\r\n"));
    const headerEndLen = 4;
    let bodyStart = -1;
    let headersBuf = part;

    if (headerEnd !== -1) {
      headersBuf = part.subarray(0, headerEnd);
      bodyStart = headerEnd + headerEndLen;
    } else {
      const headerEndLf = part.indexOf(Buffer.from("\n\n"));
      if (headerEndLf !== -1) {
        headersBuf = part.subarray(0, headerEndLf);
        bodyStart = headerEndLf + 2;
      }
    }

    if (bodyStart === -1) {
      continue;
    }

    const headersText = headersBuf.toString("latin1");
    const nameMatch = /name="([^"]+)"/i.exec(headersText);
    if (!nameMatch) {
      continue;
    }
    const fieldName = nameMatch[1];

    let body = part.subarray(bodyStart);
    if (body.length >= 2 && body[body.length - 2] === 0x0d && body[body.length - 1] === 0x0a) {
      body = body.subarray(0, body.length - 2);
    } else if (body.length >= 1 && body[body.length - 1] === 0x0a) {
      body = body.subarray(0, body.length - 1);
    }

    const filenameMatch = /filename="([^"]*)"/i.exec(headersText);
    if (filenameMatch) {
      const mimeMatch = /content-type:\s*([^\r\n]+)/i.exec(headersText);
      const mimeType = mimeMatch ? mimeMatch[1].trim() : "application/octet-stream";
      const filename = filenameMatch[1] || "upload";
      if (body.length > 0) {
        const file = new File([body], filename, { type: mimeType });
        formData.append(fieldName, file);
      }
      continue;
    }

    formData.append(fieldName, body.toString("utf8"));
  }

  return formData;
}

/**
 * @param {Record<string, string>} headers
 * @param {Buffer} buffer
 * @param {{ bestEffort?: boolean }} [options]
 * @returns {Promise<FormData>}
 */
function parseMultipartBuffer(headers, buffer, options = {}) {
  const { bestEffort = true } = options;

  return new Promise((resolve, reject) => {
    /** @type {{ name: string, value: string }[]} */
    const fields = [];
    /** @type {{ name: string, file: File }[]} */
    const files = [];
    let pendingFiles = 0;
    let busboyFinished = false;
    let settled = false;

    const buildFormData = () => {
      const formData = new FormData();
      for (const { name, value } of fields) {
        formData.append(name, value);
      }
      for (const { name, file } of files) {
        formData.append(name, file);
      }
      return formData;
    };

    const finishIfReady = () => {
      if (!busboyFinished || pendingFiles > 0 || settled) {
        return;
      }
      settled = true;
      resolve(buildFormData());
    };

    const settlePartial = (reason) => {
      if (settled) {
        return;
      }
      const partial = buildFormData();
      if (partial.keys().next().done === false) {
        settled = true;
        console.warn(
          "[contact] Busboy settled with partial multipart fields:",
          reason,
        );
        resolve(partial);
        return;
      }

      if (bestEffort) {
        const boundary = extractBoundary(headers["content-type"] || "");
        const extracted = extractMultipartFieldsBestEffort(buffer, boundary);
        if (extracted.keys().next().done === false) {
          settled = true;
          console.warn(
            "[contact] Busboy failed; used best-effort multipart extraction:",
            reason,
          );
          resolve(extracted);
          return;
        }
      }

      if (!settled) {
        settled = true;
        reject(new Error(reason));
      }
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

      fileStream.on("error", (fileError) => {
        pendingFiles = Math.max(0, pendingFiles - 1);
        const message =
          fileError instanceof Error ? fileError.message : String(fileError);
        if (bestEffort) {
          settlePartial(`file stream error: ${message}`);
        } else {
          reject(fileError);
        }
      });
    });

    busboy.on("finish", () => {
      busboyFinished = true;
      finishIfReady();
    });

    busboy.on("error", (error) => {
      const message = error instanceof Error ? error.message : String(error);
      if (bestEffort) {
        busboyFinished = true;
        settlePartial(message);
      } else {
        reject(error);
      }
    });

    try {
      busboy.write(buffer);
      busboy.end();
    } catch (writeError) {
      const message =
        writeError instanceof Error ? writeError.message : String(writeError);
      if (bestEffort) {
        settlePartial(message);
      } else {
        reject(writeError);
      }
    }
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
 * Primary parser: platform Request.formData(). Only returns when parsing succeeds.
 *
 * @param {Request} req
 * @returns {Promise<{ ok: true, formData: FormData } | { ok: false, reason: "skipped" | "failed", message?: string }>}
 */
async function tryNativeRequestFormData(req) {
  if (!(req instanceof Request) || req.body == null) {
    return { ok: false, reason: "skipped" };
  }

  const contentType = (req.headers.get("content-type") || "").toLowerCase();
  if (
    !contentType.includes("multipart/form-data") &&
    !contentType.includes("application/x-www-form-urlencoded")
  ) {
    return { ok: false, reason: "skipped" };
  }

  try {
    const cloned = typeof req.clone === "function" ? req.clone() : req;
    const formData = await cloned.formData();
    console.log("[contact] Request.formData() succeeded (parser: Request.formData)");
    return { ok: true, formData };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      "[contact] Request.formData() failed; Busboy fallback may run:",
      message,
    );
    return { ok: false, reason: "failed", message };
  }
}

/**
 * @param {Request} req
 * @param {import("@netlify/functions").HandlerEvent | null | undefined} [event]
 * @returns {Promise<FormData>}
 */
export async function parseContactFormData(req, event) {
  const contentType = (
    event?.headers?.["content-type"] ||
    event?.headers?.["Content-Type"] ||
    req.headers.get("content-type") ||
    ""
  ).toLowerCase();

  const nativeResult = await tryNativeRequestFormData(req);
  if (nativeResult.ok) {
    return nativeResult.formData;
  }

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
    requestFormData: nativeResult.reason,
    requestFormDataError:
      nativeResult.reason === "failed" ? nativeResult.message : null,
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
    if (nativeResult.reason === "failed") {
      console.log(
        "[contact] Using Busboy fallback (Request.formData threw)",
        { error: nativeResult.message },
      );
    } else {
      console.log(
        "[contact] Using Busboy fallback (Request.formData not used)",
        { reason: nativeResult.reason },
      );
    }

    const selected = selectMultipartBodyCandidate(
      candidates,
      Number.isFinite(expectedContentLength) ? expectedContentLength : null,
    );

    const buffer =
      selected?.buffer ||
      pickLongestCandidate(candidates)?.buffer ||
      Buffer.alloc(0);

    debug.bodySource = selected?.source || (buffer.length > 0 ? "longest" : "none");
    debug.bodyLength = buffer.length;
    debug.hasClosingBoundary = hasClosingMultipartBoundary(buffer, boundary);
    logBodyDebug(debug, buffer);

    if (buffer.length === 0) {
      const extracted = extractMultipartFieldsBestEffort(buffer, boundary);
      if (extracted.keys().next().done === false) {
        console.log(
          "[contact] Parser succeeded via best-effort extraction (empty buffer path)",
        );
        return extracted;
      }
      throw new Error(
        "Multipart body unavailable (no body buffer from request or event)",
      );
    }

    const headers = event ? { ...event.headers } : headersFromRequest(req);
    try {
      const formData = await parseMultipartBuffer(headers, buffer, {
        bestEffort: true,
      });
      console.log(
        "[contact] Parser succeeded via Busboy",
        { source: debug.bodySource, bytes: buffer.length },
      );
      return formData;
    } catch (parseError) {
      const message =
        parseError instanceof Error ? parseError.message : String(parseError);
      const extracted = extractMultipartFieldsBestEffort(buffer, boundary);
      if (extracted.keys().next().done === false) {
        console.warn(
          "[contact] Busboy threw; parser succeeded via best-effort extraction:",
          message,
        );
        return extracted;
      }
      throw new Error(
        `Multipart parse failed (${debug.bodySource}, ${buffer.length} bytes): ${message}`,
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
    console.log(
      "[contact] Parser succeeded via urlencoded buffer",
      { source: longest.source },
    );
    return formDataFromUrlEncodedBuffer(longest.buffer);
  }

  if (!contentType) {
    if (
      boundary ||
      longest.buffer.includes(Buffer.from("Content-Disposition:"))
    ) {
      const headers = event ? { ...event.headers } : headersFromRequest(req);
      const formData = await parseMultipartBuffer(headers, longest.buffer, {
        bestEffort: true,
      });
      console.log(
        "[contact] Parser succeeded via Busboy (inferred multipart)",
        { source: longest.source },
      );
      return formData;
    }
    console.log(
      "[contact] Parser succeeded via urlencoded buffer (no content-type)",
      { source: longest.source },
    );
    return formDataFromUrlEncodedBuffer(longest.buffer);
  }

  throw new Error(`Unsupported Content-Type: ${contentType}`);
}

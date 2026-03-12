/**
 * fal.ai API Relay — Lambda-compatible handler
 *
 * Forwards requests to the fal.ai queue API and returns the response
 * with CORS headers. The server injects FAL_KEY from env so the browser
 * never sees it.
 *
 * Routes:
 *   POST /fal/queue/:modelId          → POST https://queue.fal.run/:modelId
 *   GET  /fal/status/:modelId/:reqId  → GET  https://queue.fal.run/:modelId/requests/:reqId/status
 *   GET  /fal/result/:modelId/:reqId  → GET  https://queue.fal.run/:modelId/requests/:reqId
 *   PUT  /fal/cancel/:modelId/:reqId  → PUT  https://queue.fal.run/:modelId/requests/:reqId/cancel
 *   GET  /fal/image?url=              → proxy output image download
 *
 * Model IDs contain slashes (e.g. fal-ai/clarity-upscaler, fal-ai/topaz/upscale/image).
 * For status/result/cancel routes, the last path segment matching UUID format is
 * the requestId; everything between the action and that segment is the modelId.
 *
 * Lambda deployment: export { handler } and wire to API Gateway.
 *
 * Log level: set FAL_RELAY_LOG=debug for verbose output.
 */

const FAL_ORIGIN = "https://queue.fal.run";

/** Per-request timeouts — prevents hung connections from blocking indefinitely. */
const SUBMIT_TIMEOUT_MS = 30_000;  // 30s for task submission
const POLL_TIMEOUT_MS = 15_000;    // 15s for status poll
const IMAGE_TIMEOUT_MS = 120_000;  // 120s for image download

const LOG_LEVEL = (process.env.FAL_RELAY_LOG || "info").toLowerCase();
const isDebug = LOG_LEVEL === "debug";

function logInfo(...args) {
  console.log(...args);
}
function logDebug(...args) {
  if (isDebug) console.log(...args);
}

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, PUT, OPTIONS",
  "access-control-allow-headers": "content-type, accept, x-fal-key",
  "access-control-max-age": "86400",
};

/** Domains allowed for image proxying. */
const ALLOWED_IMAGE_HOSTS = [
  ".fal.run",
  ".fal.ai",
  ".fal.media",
  "fal.media",
  ".amazonaws.com",
];

function isAllowedImageHost(hostname) {
  return ALLOWED_IMAGE_HOSTS.some((suffix) =>
    suffix.startsWith(".") ? hostname.endsWith(suffix) : hostname === suffix
  );
}

/** UUID pattern — fal.ai request IDs look like UUIDs. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Parse a /fal/ path into { action, modelId, requestId }.
 *
 * Examples:
 *   /fal/queue/fal-ai/clarity-upscaler        → { action: "queue", modelId: "fal-ai/clarity-upscaler" }
 *   /fal/status/fal-ai/clarity-upscaler/UUID   → { action: "status", modelId: "fal-ai/clarity-upscaler", requestId: "UUID" }
 *   /fal/status/fal-ai/topaz/upscale/image/UUID → { action: "status", modelId: "fal-ai/topaz/upscale/image", requestId: "UUID" }
 *   /fal/image                                  → { action: "image" }
 */
function parseFalPath(path) {
  const stripped = path.slice("/fal/".length); // e.g. "queue/fal-ai/clarity-upscaler"
  const segments = stripped.split("/");
  const action = segments[0]; // queue | status | result | cancel | image

  if (action === "image") {
    return { action };
  }

  const rest = segments.slice(1); // everything after the action

  if (action === "queue") {
    // All remaining segments form the modelId
    return { action, modelId: rest.join("/") };
  }

  // status / result / cancel — last UUID-shaped segment is requestId
  if (rest.length < 2) {
    return { action, modelId: rest.join("/") };
  }

  const lastSegment = rest[rest.length - 1];
  if (UUID_RE.test(lastSegment)) {
    return {
      action,
      modelId: rest.slice(0, -1).join("/"),
      requestId: lastSegment,
    };
  }

  // No UUID found — treat everything as modelId
  return { action, modelId: rest.join("/") };
}

/**
 * Lambda-compatible handler.
 *
 * @param {{ method: string, path: string, headers: Record<string,string>, body?: string, queryString?: string }} event
 * @returns {Promise<{ statusCode: number, headers: Record<string,string>, body: string, isBase64Encoded?: boolean }>}
 */
export async function handler(event) {
  const { method, path, headers, body, queryString } = event;

  // Preflight
  if (method === "OPTIONS") {
    logDebug(`[FAL] OPTIONS ${path}`);
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }

  if (!path.startsWith("/fal/")) {
    logDebug(`[FAL] ${method} ${path} → 404`);
    return {
      statusCode: 404,
      headers: { ...CORS_HEADERS, "content-type": "application/json" },
      body: JSON.stringify({ error: "Not found" }),
    };
  }

  const FAL_KEY = headers["x-fal-key"] || process.env.FAL_KEY;
  if (!FAL_KEY) {
    logInfo("[FAL] FAL_KEY not configured (no x-fal-key header and no env var)");
    return {
      statusCode: 500,
      headers: { ...CORS_HEADERS, "content-type": "application/json" },
      body: JSON.stringify({ error: "FAL_KEY not configured — set it in the sidebar or as FAL_KEY env var" }),
    };
  }

  const parsed = parseFalPath(path);
  const { action, modelId, requestId } = parsed;

  // ── Image proxy ──────────────────────────────────────────────────────
  if (action === "image" && method === "GET") {
    const params = new URLSearchParams(queryString || "");
    const imageTarget = params.get("url");
    if (!imageTarget) {
      return {
        statusCode: 400,
        headers: { ...CORS_HEADERS, "content-type": "application/json" },
        body: JSON.stringify({ error: "Missing url parameter" }),
      };
    }
    try {
      const parsedUrl = new URL(imageTarget);
      if (!isAllowedImageHost(parsedUrl.hostname)) {
        return {
          statusCode: 400,
          headers: { ...CORS_HEADERS, "content-type": "application/json" },
          body: JSON.stringify({ error: "Image host not allowed" }),
        };
      }
    } catch {
      return {
        statusCode: 400,
        headers: { ...CORS_HEADERS, "content-type": "application/json" },
        body: JSON.stringify({ error: "Invalid url parameter" }),
      };
    }

    logDebug(`[FAL] image → ${imageTarget.slice(0, 80)}...`);

    let imageResp;
    try {
      imageResp = await fetch(imageTarget, { signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS) });
    } catch (err) {
      console.error(`[FAL] Image fetch failed: ${err.message}`);
      return {
        statusCode: 502,
        headers: { ...CORS_HEADERS, "content-type": "application/json" },
        body: JSON.stringify({ error: `Image fetch failed: ${err.message}` }),
      };
    }

    if (!imageResp.ok) {
      logInfo(`[FAL] Image upstream error: ${imageResp.status}`);
      return {
        statusCode: imageResp.status,
        headers: { ...CORS_HEADERS, "content-type": "application/json" },
        body: JSON.stringify({ error: `Image upstream error: ${imageResp.status}` }),
      };
    }

    const arrayBuf = await imageResp.arrayBuffer();
    const base64 = Buffer.from(arrayBuf).toString("base64");
    const contentType = imageResp.headers.get("content-type") || "image/jpeg";
    logDebug(`[FAL] image ← ${arrayBuf.byteLength} bytes (${contentType})`);

    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, "content-type": contentType },
      body: base64,
      isBase64Encoded: true,
    };
  }

  // ── Build target URL ─────────────────────────────────────────────────
  let targetUrl;
  let timeoutMs;

  if (action === "queue" && method === "POST") {
    // POST /fal/queue/:modelId → POST https://queue.fal.run/:modelId
    targetUrl = `${FAL_ORIGIN}/${modelId}`;
    timeoutMs = SUBMIT_TIMEOUT_MS;
  } else if (action === "status" && method === "GET") {
    // GET /fal/status/:modelId/:requestId → GET https://queue.fal.run/:modelId/requests/:requestId/status
    if (!requestId) {
      return {
        statusCode: 400,
        headers: { ...CORS_HEADERS, "content-type": "application/json" },
        body: JSON.stringify({ error: "Missing requestId" }),
      };
    }
    targetUrl = `${FAL_ORIGIN}/${modelId}/requests/${requestId}/status`;
    timeoutMs = POLL_TIMEOUT_MS;
  } else if (action === "result" && method === "GET") {
    // GET /fal/result/:modelId/:requestId → GET https://queue.fal.run/:modelId/requests/:requestId
    if (!requestId) {
      return {
        statusCode: 400,
        headers: { ...CORS_HEADERS, "content-type": "application/json" },
        body: JSON.stringify({ error: "Missing requestId" }),
      };
    }
    targetUrl = `${FAL_ORIGIN}/${modelId}/requests/${requestId}`;
    timeoutMs = POLL_TIMEOUT_MS;
  } else if (action === "cancel" && method === "PUT") {
    // PUT /fal/cancel/:modelId/:requestId → PUT https://queue.fal.run/:modelId/requests/:requestId/cancel
    if (!requestId) {
      return {
        statusCode: 400,
        headers: { ...CORS_HEADERS, "content-type": "application/json" },
        body: JSON.stringify({ error: "Missing requestId" }),
      };
    }
    targetUrl = `${FAL_ORIGIN}/${modelId}/requests/${requestId}/cancel`;
    timeoutMs = SUBMIT_TIMEOUT_MS;
  } else {
    logDebug(`[FAL] ${method} ${path} → 404 (unknown action: ${action})`);
    return {
      statusCode: 404,
      headers: { ...CORS_HEADERS, "content-type": "application/json" },
      body: JSON.stringify({ error: "Not found" }),
    };
  }

  logDebug(`[FAL] ${method} ${path} → ${targetUrl}`);

  // ── Forward request ──────────────────────────────────────────────────
  const forwardHeaders = {
    "content-type": headers["content-type"] || "application/json",
    accept: headers["accept"] || "application/json",
    authorization: `Key ${FAL_KEY}`,
  };

  const fetchOpts = { method, headers: forwardHeaders, signal: AbortSignal.timeout(timeoutMs) };
  if (body && method !== "GET" && method !== "HEAD") {
    fetchOpts.body = body;
  }

  let upstream;
  try {
    upstream = await fetch(targetUrl, fetchOpts);
  } catch (err) {
    console.error(`[FAL] Upstream fetch failed: ${err.message}`);
    return {
      statusCode: 502,
      headers: { ...CORS_HEADERS, "content-type": "application/json" },
      body: JSON.stringify({ error: `Upstream fetch failed: ${err.message}` }),
    };
  }

  const responseBody = await upstream.text();

  if (method === "POST") {
    logInfo(`[FAL] Task submitted (${upstream.status})`);
    logInfo(`[FAL]   url: ${targetUrl}`);
    logInfo(`[FAL]   body: ${body ? `${body.length} bytes` : "(empty)"}`);
    logInfo(`[FAL]   response: ${responseBody}`);
  } else {
    logDebug(`[FAL] ${method} ← ${upstream.status} (${responseBody.length} bytes)`);
  }

  if (upstream.status >= 400) {
    logInfo(`[FAL] Upstream error ${upstream.status}: ${responseBody}`);
  }

  return {
    statusCode: upstream.status,
    headers: {
      ...CORS_HEADERS,
      "content-type": upstream.headers.get("content-type") || "application/json",
    },
    body: responseBody,
  };
}

/**
 * BFL API Relay — Lambda-compatible handler
 *
 * Forwards requests to the BFL API (api.bfl.ai) and returns the response
 * with CORS headers. BFL's API doesn't set Access-Control-Allow-Origin,
 * so browser clients can't call it directly.
 *
 * Routes:
 *   POST /bfl/:model    → POST https://api.bfl.ai/v1/:model
 *   GET  /bfl/poll?url=  → GET  (BFL polling URL, *.bfl.ai only)
 *   GET  /bfl/image?url= → GET  (BFL output image, allowed domains only)
 *
 * The client sends the BFL API key in the x-key header as normal.
 * This relay passes it through — it holds no secrets.
 *
 * Lambda deployment: export { handler } and wire to API Gateway.
 *
 * Log level: set BFL_RELAY_LOG=debug for verbose output.
 */

const BFL_ORIGIN = "https://api.bfl.ai";

/** Per-request timeouts — prevents hung connections from blocking indefinitely. */
const SUBMIT_TIMEOUT_MS = 30_000; // 30s for task submission
const POLL_TIMEOUT_MS = 15_000;   // 15s for status poll
const IMAGE_TIMEOUT_MS = 60_000;  // 60s for image download

const LOG_LEVEL = (process.env.BFL_RELAY_LOG || "info").toLowerCase();
const isDebug = LOG_LEVEL === "debug";

function logInfo(...args) {
  console.log(...args);
}
function logDebug(...args) {
  if (isDebug) console.log(...args);
}

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type, accept, x-key",
  "access-control-max-age": "86400",
};

/** Domains allowed for image proxying. */
const ALLOWED_IMAGE_HOSTS = [
  ".blob.core.windows.net", // Azure Blob — BFL delivery
  ".bfl.ai",
];

function isAllowedImageHost(hostname) {
  return ALLOWED_IMAGE_HOSTS.some((suffix) => hostname.endsWith(suffix));
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
    logDebug(`[BFL] OPTIONS ${path}`);
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }

  if (!path.startsWith("/bfl/")) {
    logDebug(`[BFL] ${method} ${path} → 404`);
    return {
      statusCode: 404,
      headers: { ...CORS_HEADERS, "content-type": "application/json" },
      body: JSON.stringify({ error: "Not found" }),
    };
  }

  const subpath = path.slice("/bfl".length); // e.g. "/flux-2-pro" or "/poll"
  let targetUrl;

  if (method === "GET" && subpath === "/poll") {
    const params = new URLSearchParams(queryString || "");
    const pollTarget = params.get("url");
    if (!pollTarget) {
      return {
        statusCode: 400,
        headers: { ...CORS_HEADERS, "content-type": "application/json" },
        body: JSON.stringify({ error: "Missing url parameter" }),
      };
    }
    try {
      const parsed = new URL(pollTarget);
      if (!parsed.hostname.endsWith(".bfl.ai")) {
        return {
          statusCode: 400,
          headers: { ...CORS_HEADERS, "content-type": "application/json" },
          body: JSON.stringify({ error: "url must be a *.bfl.ai domain" }),
        };
      }
    } catch {
      return {
        statusCode: 400,
        headers: { ...CORS_HEADERS, "content-type": "application/json" },
        body: JSON.stringify({ error: "Invalid url parameter" }),
      };
    }
    targetUrl = pollTarget;
    logDebug(`[BFL] poll → ${targetUrl}`);
  } else if (method === "GET" && subpath === "/image") {
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
      const parsed = new URL(imageTarget);
      if (!isAllowedImageHost(parsed.hostname)) {
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

    logDebug(`[BFL] image → ${imageTarget.slice(0, 80)}...`);

    let imageResp;
    try {
      imageResp = await fetch(imageTarget, { signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS) });
    } catch (err) {
      console.error(`[BFL] Image fetch failed: ${err.message}`);
      return {
        statusCode: 502,
        headers: { ...CORS_HEADERS, "content-type": "application/json" },
        body: JSON.stringify({ error: `Image fetch failed: ${err.message}` }),
      };
    }

    if (!imageResp.ok) {
      logInfo(`[BFL] Image upstream error: ${imageResp.status}`);
      return {
        statusCode: imageResp.status,
        headers: { ...CORS_HEADERS, "content-type": "application/json" },
        body: JSON.stringify({ error: `Image upstream error: ${imageResp.status}` }),
      };
    }

    const arrayBuf = await imageResp.arrayBuffer();
    const base64 = Buffer.from(arrayBuf).toString("base64");
    const contentType = imageResp.headers.get("content-type") || "image/jpeg";
    logDebug(`[BFL] image ← ${arrayBuf.byteLength} bytes (${contentType})`);

    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, "content-type": contentType },
      body: base64,
      isBase64Encoded: true,
    };
  } else if (method === "GET" && subpath === "/result") {
    const qs = queryString || "";
    targetUrl = `${BFL_ORIGIN}/v1/get_result${qs ? `?${qs}` : ""}`;
  } else {
    targetUrl = `${BFL_ORIGIN}/v1${subpath}`;
  }

  logDebug(`[BFL] ${method} ${path} → ${targetUrl}`);

  const forwardHeaders = {
    "content-type": headers["content-type"] || "application/json",
    accept: headers["accept"] || "application/json",
  };
  if (headers["x-key"]) {
    forwardHeaders["x-key"] = headers["x-key"];
  }

  // Choose timeout based on request type: poll requests are fast, submits are slower
  const isPoll = subpath === "/poll";
  const timeoutMs = isPoll ? POLL_TIMEOUT_MS : SUBMIT_TIMEOUT_MS;
  const fetchOpts = { method, headers: forwardHeaders, signal: AbortSignal.timeout(timeoutMs) };
  if (body && method !== "GET" && method !== "HEAD") {
    fetchOpts.body = body;
  }

  let upstream;
  try {
    upstream = await fetch(targetUrl, fetchOpts);
  } catch (err) {
    console.error(`[BFL] Upstream fetch failed: ${err.message}`);
    return {
      statusCode: 502,
      headers: { ...CORS_HEADERS, "content-type": "application/json" },
      body: JSON.stringify({ error: `Upstream fetch failed: ${err.message}` }),
    };
  }

  const responseBody = await upstream.text();

  if (method === "POST") {
    logInfo(`[BFL] Task submitted (${upstream.status})`);
    logInfo(`[BFL]   url: ${targetUrl}`);
    logInfo(`[BFL]   headers: ${JSON.stringify(forwardHeaders)}`);
    logInfo(`[BFL]   body: ${body}`);
    logInfo(`[BFL]   response: ${responseBody}`);
    // Print curl equivalent for direct comparison
    const curlHeaders = Object.entries(forwardHeaders).map(([k, v]) => `-H '${k}: ${v}'`).join(" ");
    logInfo(`[BFL]   curl: curl -X POST '${targetUrl}' ${curlHeaders} -d '${body}'`);
  } else {
    logDebug(`[BFL] ${method} ← ${upstream.status} (${responseBody.length} bytes)`);
  }

  if (upstream.status >= 400) {
    logInfo(`[BFL] Upstream error ${upstream.status}: ${responseBody}`);
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

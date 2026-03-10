#!/usr/bin/env node
/**
 * BFL Relay — local dev server
 *
 * Thin HTTP wrapper around the Lambda-compatible handler.
 * Run: node apps/illuminator/relay/server.js
 *
 * Set BFL_RELAY_LOG=debug for verbose request logging.
 */

import http from "node:http";
import { handler } from "./handler.js";

const PORT = parseInt(process.env.BFL_RELAY_PORT || "3100", 10);
const isDebug = (process.env.BFL_RELAY_LOG || "info").toLowerCase() === "debug";

const server = http.createServer(async (req, res) => {
  // Collect body for POST requests
  let body = "";
  if (req.method === "POST" || req.method === "PUT") {
    for await (const chunk of req) body += chunk;
  }

  // Parse URL
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // Normalize headers to lowercase keys
  const headers = {};
  for (const [k, v] of Object.entries(req.headers)) {
    headers[k.toLowerCase()] = Array.isArray(v) ? v[0] : v;
  }

  const event = {
    method: req.method,
    path: url.pathname,
    queryString: url.search.slice(1), // strip leading ?
    headers,
    body: body || undefined,
  };

  if (isDebug) console.log(`[BFL Relay] ${req.method} ${req.url}`);

  try {
    const result = await handler(event);
    if (isDebug) console.log(`[BFL Relay]   → ${result.statusCode}`);
    res.writeHead(result.statusCode, result.headers);
    res.end(result.isBase64Encoded ? Buffer.from(result.body, "base64") : result.body);
  } catch (err) {
    console.error("[BFL Relay] Unhandled error:", err);
    res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: err.message }));
  }
});

server.listen(PORT, () => {
  console.log(`[BFL Relay] Listening on http://localhost:${PORT} (log: ${isDebug ? "debug" : "info"})`);
});

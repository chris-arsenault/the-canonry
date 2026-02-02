#!/usr/bin/env node
/**
 * Development Proxy Server
 *
 * Routes all MFE requests through a single origin to avoid CORS issues.
 * This simulates production deployment where all apps are served from path prefixes.
 *
 * Routing:
 *   /                    → canonry (5000)
 *   /name-forge/*        → nameForge (5001)
 *   /cosmographer/*      → cosmographer (5002)
 *   /coherence-engine/*  → coherenceEngine (5003)
 *   /lore-weave/*        → loreWeave (5004)
 *   /archivist/*         → archivist (5005)
 *   /illuminator/*       → illuminator (5006)
 */

import http from 'node:http';
import httpProxy from 'http-proxy';

const PROXY_PORT = 3000;

// Route configuration: path prefix → backend port
// Do NOT strip prefixes - Vite expects them because each MFE has base: '/<app-name>/'
const routes = [
  { prefix: '/name-forge', target: 'http://localhost:5001' },
  { prefix: '/cosmographer', target: 'http://localhost:5002' },
  { prefix: '/coherence-engine', target: 'http://localhost:5003' },
  { prefix: '/lore-weave', target: 'http://localhost:5004' },
  { prefix: '/archivist', target: 'http://localhost:5005' },
  { prefix: '/illuminator', target: 'http://localhost:5006' },
  { prefix: '/chronicler', target: 'http://localhost:5007' },
  { prefix: '/', target: 'http://localhost:5000' },
];

const proxy = httpProxy.createProxyServer({
  ws: true, // Enable WebSocket proxying for HMR
  changeOrigin: true,
});

// Handle proxy errors
proxy.on('error', (err, req, res) => {
  console.error(`Proxy error for ${req.url}:`, err.message);
  if (res.writeHead) {
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end(`Proxy error: ${err.message}\nMake sure all MFE dev servers are running.`);
  }
});

// Log proxied requests
proxy.on('proxyReq', (proxyReq, req) => {
  const route = routes.find(r => req.url.startsWith(r.prefix) && r.prefix !== '/') || routes[routes.length - 1];
  // console.log(`${req.method} ${req.url} → ${route.target}${proxyReq.path}`);
});

function findRoute(url) {
  // Check specific prefixes first (not the catch-all '/')
  for (const route of routes) {
    if (route.prefix !== '/' && url.startsWith(route.prefix)) {
      return route;
    }
  }
  // Fall back to canonry (shell)
  return routes[routes.length - 1];
}

const server = http.createServer((req, res) => {
  const route = findRoute(req.url);
  proxy.web(req, res, { target: route.target });
});

// Handle WebSocket upgrades (for Vite HMR)
server.on('upgrade', (req, socket, head) => {
  const route = findRoute(req.url);
  proxy.ws(req, socket, head, { target: route.target });
});

server.listen(PROXY_PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║              Development Proxy Server                     ║
╠═══════════════════════════════════════════════════════════╣
║  Proxy running at: http://localhost:${PROXY_PORT}                  ║
║                                                           ║
║  Routes:                                                  ║
║    /                    → canonry (5000)                  ║
║    /name-forge/*        → nameForge (5001)                ║
║    /cosmographer/*      → cosmographer (5002)             ║
║    /coherence-engine/*  → coherenceEngine (5003)          ║
║    /lore-weave/*        → loreWeave (5004)                ║
║    /archivist/*         → archivist (5005)                ║
║    /illuminator/*       → illuminator (5006)              ║
║    /chronicler/*        → chronicler (5007)               ║
║                                                           ║
║  Make sure to run 'npm run canonry' first!                ║
╚═══════════════════════════════════════════════════════════╝
`);
});

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

// Unregister any previously installed service worker.
// Image caching is handled by HTTP cache headers (CloudFront).
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    for (const reg of regs) reg.unregister();
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

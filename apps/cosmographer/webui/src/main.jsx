/**
 * Minimal entry point for MFE build.
 *
 * Cosmographer is now an MFE remote only - it does not function as a standalone app.
 * This file exists solely to allow Vite to build the remoteEntry.js for module federation.
 *
 * To use Cosmographer, run The Canonry (apps/canonry/webui).
 */

// Import the remote component so Vite includes it in the build
import "./CosmographerRemote.jsx";

// Show a message if someone tries to run this standalone
const root = document.getElementById("root");
if (root) {
  root.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background: #1e1e2e; color: #e0e0e0; font-family: system-ui, sans-serif; text-align: center; padding: 40px;">
      <h1 style="color: #66ddb3; margin-bottom: 16px;">Cosmographer</h1>
      <p style="color: #888; max-width: 400px;">
        Cosmographer is now part of The Canonry suite and runs as a module federation remote.
      </p>
      <p style="color: #666; margin-top: 16px; font-size: 14px;">
        To use Cosmographer, please run The Canonry instead:<br/>
        <code style="background: #252535; padding: 8px 16px; border-radius: 4px; display: inline-block; margin-top: 8px;">
          cd apps/canonry/webui && npm run dev
        </code>
      </p>
    </div>
  `;
}

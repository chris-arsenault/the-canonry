/**
 * ArchivistRemote - MFE entry point for Archivist
 *
 * Accepts world data as props from the canonry shell.
 * Persistence is handled by canonry's worldStore (per-project IndexedDB).
 */

import './index.css';
import WorldExplorer from './components/WorldExplorer.tsx';
import type { WorldState, LoreData } from './types/world.ts';
import { validateWorldData } from './utils/schemaValidation.ts';

export interface ArchivistRemoteProps {
  worldData?: WorldState | null;
  loreData?: LoreData | null;
}

export default function ArchivistRemote({
  worldData = null,
  loreData = null,
}: ArchivistRemoteProps) {
  if (!worldData) {
    return (
      <div className="archivist-empty-state">
        <div className="archivist-state-content">
          <div className="archivist-state-icon">📜</div>
          <div className="archivist-state-title">No World Data</div>
          <div className="archivist-state-message">
            Run a simulation in Lore Weave and click "View in Archivist" to explore your world.
          </div>
        </div>
      </div>
    );
  }

  const schemaIssues = validateWorldData(worldData);
  if (schemaIssues.length > 0) {
    return (
      <div className="archivist-error-state">
        <div className="archivist-state-content">
          <div className="archivist-state-icon">❌</div>
          <div className="archivist-state-title">
            World data is missing required schema fields
          </div>
          <ul className="archivist-state-list">
            {schemaIssues.map((issue, index) => (
              <li key={`${issue}-${index}`}>{issue}</li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <WorldExplorer
      worldData={worldData}
      loreData={loreData}
    />
  );
}

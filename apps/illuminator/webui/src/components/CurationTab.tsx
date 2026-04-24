/**
 * CurationTab — Three-rail chronicle curation workspace.
 *
 * Left rail: CurationNavigator (era-grouped chronicle list)
 * Center rail: CurationImageSheet (cover + scene images + entity refs)
 * Right rail: DisplayOptionsPanel (layout override controls)
 */

import React, { useState, useEffect, useMemo } from "react";
import { useIlluminatorConfigStore } from "../lib/db/illuminatorConfigStore";
import { useChronicleStore } from "../lib/db/chronicleStore";
import type { StyleLibrary } from "@canonry/world-schema";
import CurationNavigator from "./curation/CurationNavigator";
import CurationImageSheet from "./curation/CurationImageSheet";
import DisplayOptionsPanel from "./curation/DisplayOptionsPanel";
import "./CurationTab.css";

interface CurationTabProps {
  styleLibrary?: StyleLibrary | null;
}

export default function CurationTab({ styleLibrary }: Readonly<CurationTabProps>) {
  const { projectId, simulationRunId } = useIlluminatorConfigStore();

  // Ensure chronicle store is initialized
  const initialize = useChronicleStore((s) => s.initialize);
  const initialized = useChronicleStore((s) => s.initialized);
  const navItems = useChronicleStore((s) => s.navItems);

  useEffect(() => {
    if (simulationRunId && !initialized) {
      initialize(simulationRunId);
    }
  }, [simulationRunId, initialized, initialize]);

  // Selected chronicle
  const [selectedChronicleId, setSelectedChronicleId] = useState<string | null>(null);

  // Derive display name from nav items
  const selectedName = selectedChronicleId ? (navItems[selectedChronicleId]?.name || "") : "";

  // Build style ID → name lookup maps
  const styleNames = useMemo(() => {
    const artistic = new Map<string, string>();
    const composition = new Map<string, string>();
    const palette = new Map<string, string>();
    if (styleLibrary) {
      for (const s of styleLibrary.artisticStyles) artistic.set(s.id, s.name);
      for (const s of styleLibrary.compositionStyles) composition.set(s.id, s.name);
      for (const p of styleLibrary.colorPalettes) palette.set(p.id, p.name);
    }
    return { artistic, composition, palette };
  }, [styleLibrary]);

  if (!simulationRunId) {
    return (
      <div className="illuminator-content">
        <div className="cur-empty-state">No simulation loaded.</div>
      </div>
    );
  }

  return (
    <div className="illuminator-content">
      <div className="cur-workspace">
        <div className="cur-left-rail">
          <CurationNavigator
            selectedChronicleId={selectedChronicleId}
            onSelectChronicle={setSelectedChronicleId}
          />
        </div>
        <div className="cur-center-rail">
          {selectedChronicleId && projectId ? (
            <CurationImageSheet
              chronicleId={selectedChronicleId}
              projectId={projectId}
              styleNames={styleNames}
            />
          ) : (
            <div className="cur-empty-state">Select a chronicle from the left</div>
          )}
        </div>
        <div className="cur-right-rail">
          <DisplayOptionsPanel
            chronicleId={selectedChronicleId}
            chronicleName={selectedName}
            simulationRunId={simulationRunId}
          />
        </div>
      </div>
    </div>
  );
}

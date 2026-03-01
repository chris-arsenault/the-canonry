import type { ChainLinkLore } from "../types/world.ts";
import "./archivist-section.css";
import "./ChainLinkSection.css";
import React from "react";

interface ChainLinkSectionProps {
  lore: ChainLinkLore;
}

export default function ChainLinkSection({ lore }: Readonly<ChainLinkSectionProps>) {
  // Parse the text which is formatted as "observation | clue"
  const parts = lore.text.split("|").map((p) => p.trim());
  const observation = parts[0] || "";
  const clue = parts[1] || "";

  return (
    <div className="archivist-section chain-link-section">
      <div className="archivist-section-hdr">
        <span className="archivist-section-icon">🔍</span>
        <span className="archivist-section-title">Mystery Clue</span>
      </div>

      <div className="chain-link-flow">
        <span className="chain-link-location">{lore.metadata.sourceLocation}</span>
        <span className="chain-link-arrow">→</span>
        <span className="chain-link-location">{lore.targetId}</span>
      </div>

      <div className="chain-link-theme">
        <span className="chain-link-theme-label">Theme:</span>
        <span className="chain-link-theme-badge">
          {lore.metadata.revealedTheme.replace(/_/g, " ")}
        </span>
      </div>

      <div className="chain-link-content">
        <div className="chain-link-observation">
          <div className="chain-link-section-label">Observation</div>
          <div className="archivist-narrative chain-link-text">{observation}</div>
        </div>
        <div className="chain-link-clue">
          <div className="chain-link-section-label">Clue</div>
          <div className="archivist-narrative chain-link-text">{clue}</div>
        </div>
      </div>
    </div>
  );
}

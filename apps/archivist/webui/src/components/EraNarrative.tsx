import React, { useRef } from "react";
import type { EraNarrativeLore } from "../types/world.ts";
import "./archivist-section.css";
import "./EraNarrative.css";

interface EraNarrativeProps {
  lore: EraNarrativeLore;
  onClose: () => void;
}

export default function EraNarrative({ lore, onClose }: Readonly<EraNarrativeProps>) {
  const mouseDownOnOverlay = useRef(false);

  const handleOverlayMouseDown = (e: React.MouseEvent) => {
    mouseDownOnOverlay.current = e.target === e.currentTarget;
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (mouseDownOnOverlay.current && e.target === e.currentTarget) {
      onClose();
    }
  };
  // Extract title from the text (first sentence or before colon)
  const titleMatch = lore.text.match(/^([^:.]+)[:.]/) || lore.text.match(/^(.{0,50})/);
  const title = titleMatch ? titleMatch[1].trim() : "Era Transition";
  const narrative = lore.text;

  return (
    <div
      className="archivist-modal-overlay era-narrative-overlay"
      onMouseDown={handleOverlayMouseDown}
      onClick={handleOverlayClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleOverlayClick(e); }}
    >
      <div className="era-narrative-modal">
        <div className="era-narrative-header">
          <div className="era-narrative-icon">⚔️</div>
          <h2 className="era-narrative-title">{title}</h2>
          <div className="era-narrative-icon">⚔️</div>
        </div>

        <div className="era-narrative-transition">
          <span className="era-narrative-era era-narrative-era-from">{lore.metadata.from}</span>
          <span className="era-narrative-arrow">→</span>
          <span className="era-narrative-era era-narrative-era-to">{lore.metadata.to}</span>
        </div>

        <div className="archivist-narrative era-narrative-content">{narrative}</div>

        <div className="archivist-section-footer era-narrative-footer">
          <span className="era-narrative-tick">Tick {lore.metadata.tick}</span>
          <button onClick={onClose} className="archivist-close-btn era-narrative-close">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

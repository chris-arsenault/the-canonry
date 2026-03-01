import type { DescriptionLore } from "../types/world.ts";
import "./archivist-section.css";
import "./LoreSection.css";
import React from "react";

interface LoreSectionProps {
  lore: DescriptionLore;
}

export default function LoreSection({ lore }: Readonly<LoreSectionProps>) {
  return (
    <div className="archivist-section lore-section">
      <div className="archivist-section-hdr">
        <span className="archivist-section-icon">📖</span>
        <span className="archivist-section-title">Lore</span>
      </div>
      <div className="archivist-narrative lore-content">{lore.text}</div>
    </div>
  );
}

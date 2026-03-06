import React, { useCallback, useRef } from "react";
import type { RelationshipBackstoryLore, WorldState } from "../types/world.ts";
import { getEntityById } from "../utils/dataTransform.ts";
import "./archivist-section.css";
import "./RelationshipStoryModal.css";

interface RelationshipStoryModalProps {
  lore: RelationshipBackstoryLore;
  worldData: WorldState;
  onClose: () => void;
}

/** Parses "backstory | Stakes: ... | Perception: ..." into named parts. */
function parseLoreText(text: string): {
  backstory: string;
  stakes: string;
  perception: string;
} {
  const parts = text.split("|").map((p) => p.trim());
  return {
    backstory: parts[0] || "",
    stakes: parts[1]?.replace(/^Stakes:\s*/i, "") || "",
    perception: parts[2]?.replace(/^Perception:\s*/i, "") || "",
  };
}

function StoryBlock({
  icon,
  title,
  children,
}: Readonly<{ icon: string; title: string; children: React.ReactNode }>) {
  return (
    <div className="rs-block">
      <div className="rs-block-hdr">
        <span className="rs-block-icon">{icon}</span>
        <span className="rs-block-title">{title}</span>
      </div>
      <div className="rs-block-body">{children}</div>
    </div>
  );
}

export default function RelationshipStoryModal({
  lore,
  worldData,
  onClose,
}: Readonly<RelationshipStoryModalProps>) {
  const mouseDownOnOverlay = useRef(false);

  const handleOverlayMouseDown = useCallback((e: React.MouseEvent) => {
    mouseDownOnOverlay.current = e.target === e.currentTarget;
  }, []);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (mouseDownOnOverlay.current && e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose],
  );

  const srcEntity = getEntityById(worldData, lore.relationship.src);
  const dstEntity = getEntityById(worldData, lore.relationship.dst);
  const { backstory, stakes, perception } = parseLoreText(lore.text);

  return (
    <div
      className="relationship-story-overlay"
      onMouseDown={handleOverlayMouseDown}
      onClick={handleOverlayClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleOverlayClick(e); }}
    >
      <div className="relationship-story-modal">
        <div className="relationship-story-header">
          <div className="relationship-story-entities">
            <span className="relationship-story-entity">
              {srcEntity?.name || lore.relationship.src}
            </span>
            <span className="relationship-story-kind">
              {lore.relationship.kind.replace(/_/g, " ")}
            </span>
            <span className="relationship-story-entity">
              {dstEntity?.name || lore.relationship.dst}
            </span>
          </div>
          <button onClick={onClose} className="relationship-story-close">
            x
          </button>
        </div>

        <StoryBlock icon="book" title="How It Began">{backstory}</StoryBlock>
        {stakes && <StoryBlock icon="warning" title="What's at Stake">{stakes}</StoryBlock>}
        {perception && <StoryBlock icon="eye" title="Different Perspectives">{perception}</StoryBlock>}
      </div>
    </div>
  );
}

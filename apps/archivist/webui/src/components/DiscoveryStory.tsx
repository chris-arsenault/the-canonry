import React, { useCallback, useRef } from "react";
import { useExpandSingle } from "@the-canonry/shared-components";
import type { DiscoveryEventLore } from "../types/world.ts";
import "./archivist-section.css";
import "./DiscoveryStory.css";

type SectionKey = "discovery" | "significance";

interface DiscoveryStoryProps {
  lore: DiscoveryEventLore;
  onExplorerClick?: (explorerId: string) => void;
  onClose?: () => void;
  isModal?: boolean;
}

function DiscoveryBlock({
  sectionKey,
  title,
  expandedId,
  onToggle,
  children,
}: Readonly<{
  sectionKey: SectionKey;
  title: string;
  expandedId: string | null;
  onToggle: (id: string) => void;
  children: React.ReactNode;
}>) {
  return (
    <div className="ds-block">
      <button onClick={() => onToggle(sectionKey)} className="ds-block-hdr">
        <span className="ds-block-icon">
          {expandedId === sectionKey ? "\u25BC" : "\u25B6"}
        </span>
        <span className="archivist-section-title">{title}</span>
      </button>
      {expandedId === sectionKey && (
        <div className="archivist-narrative ds-block-body">{children}</div>
      )}
    </div>
  );
}

function ExplorerRow({
  lore,
  onExplorerClick,
}: Readonly<{
  lore: DiscoveryEventLore;
  onExplorerClick?: (id: string) => void;
}>) {
  const isEntityId = /^(npc_|faction_|location_)/.test(lore.metadata.explorer);

  return (
    <div className="discovery-story-meta">
      <div className="discovery-story-meta-row">
        <span className="archivist-label discovery-story-meta-label">Discovered by:</span>
        {isEntityId && onExplorerClick ? (
          <button
            onClick={() => onExplorerClick(lore.metadata.explorer)}
            className="discovery-story-explorer-link"
          >
            {lore.metadata.explorer}
          </button>
        ) : (
          <span className="discovery-story-meta-value">{lore.metadata.explorer}</span>
        )}
      </div>
      <div className="discovery-story-meta-row">
        <span className="archivist-label discovery-story-meta-label">When:</span>
        <span className="discovery-story-meta-value">Tick {lore.metadata.tick}</span>
      </div>
      <div className="discovery-story-meta-row">
        <span className="archivist-label discovery-story-meta-label">Method:</span>
        <span className={`discovery-story-type-badge discovery-story-type-${lore.metadata.discoveryType}`}>
          {lore.metadata.discoveryType}
        </span>
      </div>
    </div>
  );
}

export default function DiscoveryStory({
  lore,
  onExplorerClick,
  onClose,
  isModal = false,
}: Readonly<DiscoveryStoryProps>) {
  const { expandedId, toggle } = useExpandSingle();
  const mouseDownOnOverlay = useRef(false);

  const handleOverlayMouseDown = useCallback((e: React.MouseEvent) => {
    mouseDownOnOverlay.current = e.target === e.currentTarget;
  }, []);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (mouseDownOnOverlay.current && e.target === e.currentTarget) {
        onClose?.();
      }
    },
    [onClose],
  );

  // Default to "discovery" expanded on first render
  const activeId = expandedId ?? "discovery";

  const content = (
    <div className={`archivist-section discovery-story ${isModal ? "discovery-story-modal-content" : ""}`}>
      <div className="archivist-section-hdr">
        <span className="archivist-section-icon">compass</span>
        <span className="archivist-section-title">Discovery Story</span>
      </div>

      <ExplorerRow lore={lore} onExplorerClick={onExplorerClick} />

      <DiscoveryBlock
        sectionKey="discovery"
        title="The Discovery"
        expandedId={activeId}
        onToggle={toggle}
      >
        {lore.text}
      </DiscoveryBlock>

      <DiscoveryBlock
        sectionKey="significance"
        title="Why It Matters"
        expandedId={activeId}
        onToggle={toggle}
      >
        {lore.metadata.significance}
      </DiscoveryBlock>

      {isModal && onClose && (
        <div className="archivist-section-footer discovery-story-footer">
          <button onClick={onClose} className="archivist-close-btn discovery-story-close">
            Close
          </button>
        </div>
      )}
    </div>
  );

  if (isModal && onClose) {
    return (
      <div
        className="archivist-modal-overlay discovery-story-overlay"
        onMouseDown={handleOverlayMouseDown}
        onClick={handleOverlayClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleOverlayClick(e); }}
      >
        <div>{content}</div>
      </div>
    );
  }

  return content;
}

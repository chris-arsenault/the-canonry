import { useState, useRef } from 'react';
import type { DiscoveryEventLore } from '../types/world.ts';
import './DiscoveryStory.css';

interface DiscoveryStoryProps {
  lore: DiscoveryEventLore;
  onExplorerClick?: (explorerId: string) => void;
  onClose?: () => void;  // Optional close handler for modal mode
  isModal?: boolean;  // Whether to render as modal
}

export default function DiscoveryStory({ lore, onExplorerClick, onClose, isModal = false }: DiscoveryStoryProps) {
  const [expandedSection, setExpandedSection] = useState<'discovery' | 'significance' | null>('discovery');
  const mouseDownOnOverlay = useRef(false);

  const handleOverlayMouseDown = (e: React.MouseEvent) => {
    mouseDownOnOverlay.current = e.target === e.currentTarget;
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (mouseDownOnOverlay.current && e.target === e.currentTarget) {
      onClose?.();
    }
  };

  const toggleSection = (section: 'discovery' | 'significance') => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  // Check if explorer is an entity ID (starts with known prefixes)
  const isEntityId = lore.metadata.explorer.match(/^(npc_|faction_|location_)/);

  const content = (
    <div className={`discovery-story ${isModal ? 'discovery-story-modal-content' : ''}`}>
      <div className="discovery-story-header">
        <span className="discovery-story-icon">🧭</span>
        <span className="discovery-story-title">Discovery Story</span>
      </div>

      <div className="discovery-story-meta">
        <div className="discovery-story-meta-row">
          <span className="discovery-story-meta-label">Discovered by:</span>
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
          <span className="discovery-story-meta-label">When:</span>
          <span className="discovery-story-meta-value">Tick {lore.metadata.tick}</span>
        </div>
        <div className="discovery-story-meta-row">
          <span className="discovery-story-meta-label">Method:</span>
          <span className={`discovery-story-type-badge discovery-story-type-${lore.metadata.discoveryType}`}>
            {lore.metadata.discoveryType}
          </span>
        </div>
      </div>

      {/* The Discovery */}
      <div className="discovery-story-section">
        <button
          onClick={() => toggleSection('discovery')}
          className="discovery-story-section-header"
        >
          <span className="discovery-story-section-icon">{expandedSection === 'discovery' ? '▼' : '▶'}</span>
          <span className="discovery-story-section-title">The Discovery</span>
        </button>
        {expandedSection === 'discovery' && (
          <div className="discovery-story-section-content">
            {lore.text}
          </div>
        )}
      </div>

      {/* Why It Matters */}
      <div className="discovery-story-section">
        <button
          onClick={() => toggleSection('significance')}
          className="discovery-story-section-header"
        >
          <span className="discovery-story-section-icon">{expandedSection === 'significance' ? '▼' : '▶'}</span>
          <span className="discovery-story-section-title">Why It Matters</span>
        </button>
        {expandedSection === 'significance' && (
          <div className="discovery-story-section-content">
            {lore.metadata.significance}
          </div>
        )}
      </div>

      {/* Close button for modal mode */}
      {isModal && onClose && (
        <div className="discovery-story-footer">
          <button onClick={onClose} className="discovery-story-close">Close</button>
        </div>
      )}
    </div>
  );

  // Wrap in modal overlay if in modal mode
  if (isModal && onClose) {
    return (
      <div className="discovery-story-overlay" onMouseDown={handleOverlayMouseDown} onClick={handleOverlayClick}>
        <div>
          {content}
        </div>
      </div>
    );
  }

  return content;
}

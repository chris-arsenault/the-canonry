import type { ChainLinkLore } from '../types/world.ts';
import './ChainLinkSection.css';

interface ChainLinkSectionProps {
  lore: ChainLinkLore;
}

export default function ChainLinkSection({ lore }: ChainLinkSectionProps) {
  // Parse the text which is formatted as "observation | clue"
  const parts = lore.text.split('|').map(p => p.trim());
  const observation = parts[0] || '';
  const clue = parts[1] || '';

  return (
    <div className="chain-link-section">
      <div className="chain-link-header">
        <span className="chain-link-icon">🔍</span>
        <span className="chain-link-title">Mystery Clue</span>
      </div>

      <div className="chain-link-flow">
        <span className="chain-link-location">{lore.metadata.sourceLocation}</span>
        <span className="chain-link-arrow">→</span>
        <span className="chain-link-location">{lore.targetId}</span>
      </div>

      <div className="chain-link-theme">
        <span className="chain-link-theme-label">Theme:</span>
        <span className="chain-link-theme-badge">{lore.metadata.revealedTheme.replace(/_/g, ' ')}</span>
      </div>

      <div className="chain-link-content">
        <div className="chain-link-observation">
          <div className="chain-link-section-label">Observation</div>
          <div className="chain-link-text">{observation}</div>
        </div>
        <div className="chain-link-clue">
          <div className="chain-link-section-label">Clue</div>
          <div className="chain-link-text">{clue}</div>
        </div>
      </div>
    </div>
  );
}

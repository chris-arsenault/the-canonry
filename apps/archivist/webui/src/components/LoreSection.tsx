import type { DescriptionLore } from '../types/world.ts';
import './LoreSection.css';

interface LoreSectionProps {
  lore: DescriptionLore;
}

export default function LoreSection({ lore }: LoreSectionProps) {
  return (
    <div className="lore-section">
      <div className="lore-header">
        <span className="lore-icon">📖</span>
        <span className="lore-title">Lore</span>
      </div>
      <div className="lore-content">
        {lore.text}
      </div>
    </div>
  );
}

/**
 * GeneratorListCard - Card display for a single generator in the list view
 */

import React, { useMemo } from 'react';
import { getElementValidation } from '@penguin-tales/shared-components';
import { ErrorBadge, OrphanBadge, EraBadges, EnableToggle } from '../../shared';

/**
 * @param {Object} props
 * @param {Object} props.generator - The generator to display
 * @param {Function} props.onClick - Callback when card is clicked
 * @param {Function} props.onToggle - Callback to toggle enabled state
 * @param {Object} props.usageMap - Schema usage map for validation
 */
export function GeneratorListCard({ generator, onClick, onToggle, usageMap }) {
  const isEnabled = generator.enabled !== false;

  const summary = useMemo(() => {
    const creates = generator.creation?.map((c) => c.kind).filter((v, i, a) => a.indexOf(v) === i) || [];
    const rels = generator.relationships?.length || 0;
    const effects = generator.stateUpdates?.length || 0;
    return { creates, rels, effects };
  }, [generator]);

  // Get validation and usage info
  const validation = useMemo(() =>
    usageMap ? getElementValidation(usageMap, 'generator', generator.id) : { invalidRefs: [], isOrphan: false },
    [usageMap, generator.id]
  );

  const eraUsage = useMemo(() => {
    if (!usageMap?.generators?.[generator.id]) return [];
    return usageMap.generators[generator.id].eras || [];
  }, [usageMap, generator.id]);

  const errorCount = validation.invalidRefs.length;
  const hasErrors = errorCount > 0;
  const isOrphan = validation.isOrphan;

  return (
    <div
      className={`card card-clickable ${!isEnabled ? 'card-disabled' : ''} ${hasErrors ? 'card-error' : ''} ${isOrphan && !hasErrors ? 'card-warning' : ''}`}
      onClick={onClick}
    >
      <div className="card-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="card-title">{generator.name || generator.id}</span>
            <ErrorBadge count={errorCount} />
          </div>
          <div className="card-id">{generator.id}</div>
        </div>
        <EnableToggle
          enabled={isEnabled}
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
        />
      </div>

      <div className="card-stats">
        <div className="card-stat"><span>✨</span> {generator.creation?.length || 0} creates</div>
        <div className="card-stat"><span>🔗</span> {summary.rels} rels</div>
        <div className="card-stat"><span>⚡</span> {summary.effects} effects</div>
      </div>

      <div className="card-badges">
        {summary.creates.slice(0, 3).map((kind) => (
          <span key={kind} className="badge badge-entity-kind">+ {kind}</span>
        ))}
      </div>

      <EraBadges eras={eraUsage} />
      {isOrphan && (
        <div style={{ marginTop: '8px' }}>
          <OrphanBadge isOrphan={isOrphan} />
        </div>
      )}
    </div>
  );
}

export default GeneratorListCard;

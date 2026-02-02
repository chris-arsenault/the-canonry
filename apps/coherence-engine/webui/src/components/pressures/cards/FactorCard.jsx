/**
 * FactorCard - Card display for a feedback factor
 */

import React from 'react';
import { FACTOR_TYPES } from '../constants';

export function FactorCard({ factor, feedbackType, onEdit, onDelete, schema }) {
  const typeConfig = FACTOR_TYPES[factor.type] || {};

  // Generate summary based on factor type
  const getSummary = () => {
    switch (factor.type) {
      case 'entity_count':
        return `${factor.kind}${factor.subtype ? `:${factor.subtype}` : ''}${factor.status ? ` (${factor.status})` : ''}`;
      case 'relationship_count':
        return factor.relationshipKinds?.join(', ') || 'No relationships selected';
      case 'tag_count':
        return factor.tags?.join(', ') || 'No tags selected';
      case 'ratio':
        const num = factor.numerator?.kind || factor.numerator?.relationshipKinds?.join(',') || '?';
        const den = factor.denominator?.kind || factor.denominator?.relationshipKinds?.join(',') || factor.denominator?.type || '?';
        return `${num} / ${den}`;
      case 'status_ratio':
        return `${factor.kind}${factor.subtype ? `:${factor.subtype}` : ''} (${factor.aliveStatus})`;
      case 'cross_culture_ratio':
        return factor.relationshipKinds?.join(', ') || 'No relationships selected';
      default:
        return 'Unknown factor';
    }
  };

  return (
    <div className="nested-card">
      <div className="nested-card-header" onClick={onEdit}>
        <div
          className="nested-card-icon"
          style={{ backgroundColor: `${typeConfig.color}20` }}
        >
          {typeConfig.icon}
        </div>
        <div className="nested-card-info">
          <div className="nested-card-type">{typeConfig.label}</div>
          <div className="nested-card-summary">{getSummary()}</div>
        </div>
        <div
          className="nested-card-coefficient"
          style={{ color: feedbackType === 'positive' ? '#86efac' : '#fca5a5' }}
        >
          {feedbackType === 'positive' ? '+' : '−'}{Math.abs(factor.coefficient)}
          {factor.cap ? ` (cap: ${factor.cap})` : ''}
        </div>
        <div className="nested-card-actions">
          <button
            className="icon-button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            title="Edit"
          >
            ✏️
          </button>
          <button
            className="icon-button delete-button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title="Remove"
          >
            🗑️
          </button>
        </div>
      </div>
    </div>
  );
}

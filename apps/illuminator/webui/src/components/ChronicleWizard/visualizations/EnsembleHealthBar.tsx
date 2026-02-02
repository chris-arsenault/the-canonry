/**
 * EnsembleHealthBar - Visual indicator of cast diversity and health
 *
 * Shows category coverage as a segmented bar with warnings about gaps.
 * Replaces the +cat/+rel badges with a single unified visualization.
 */

import { useMemo } from 'react';
import type { EntityContext } from '../../../lib/chronicleTypes';
import type { ChronicleRoleAssignment } from '../../../lib/chronicleTypes';

interface EnsembleHealthBarProps {
  assignments: ChronicleRoleAssignment[];
  candidates: EntityContext[];
  /** Map from entity kind to category name (for grouping) */
  kindToCategory?: Map<string, string>;
}

// Color mapping for categories
const CATEGORY_COLORS: Record<string, string> = {
  character: '#6366f1',
  person: '#6366f1',
  faction: '#8b5cf6',
  organization: '#8b5cf6',
  location: '#10b981',
  place: '#10b981',
  artifact: '#f59e0b',
  item: '#f59e0b',
  creature: '#ec4899',
  event: '#06b6d4',
  concept: '#84cc16',
};

export default function EnsembleHealthBar({
  assignments,
  candidates,
  kindToCategory,
}: EnsembleHealthBarProps) {
  // Compute category stats
  const stats = useMemo(() => {
    // Get all unique categories from candidates
    const allCategories = new Set<string>();
    const kindMap = kindToCategory || new Map<string, string>();

    for (const candidate of candidates) {
      const category = kindMap.get(candidate.kind) || candidate.kind;
      allCategories.add(category);
    }

    // Count assigned categories
    const assignedCategories = new Map<string, number>();
    for (const assignment of assignments) {
      const category = kindMap.get(assignment.entityKind) || assignment.entityKind;
      assignedCategories.set(category, (assignedCategories.get(category) || 0) + 1);
    }

    // Find missing categories
    const missingCategories: string[] = [];
    for (const category of allCategories) {
      if (!assignedCategories.has(category)) {
        missingCategories.push(category);
      }
    }

    // Calculate coverage percentage
    const coveredCount = assignedCategories.size;
    const totalCount = allCategories.size;
    const coveragePercent = totalCount > 0 ? (coveredCount / totalCount) * 100 : 0;

    return {
      categories: [...allCategories],
      assignedCategories,
      missingCategories,
      coveragePercent,
      coveredCount,
      totalCount,
    };
  }, [assignments, candidates, kindToCategory]);

  const getColor = (category: string): string => {
    return CATEGORY_COLORS[category.toLowerCase()] || 'var(--text-muted)';
  };

  if (stats.totalCount === 0) {
    return null;
  }

  return (
    <div style={{
      background: 'var(--bg-tertiary)',
      borderRadius: '8px',
      padding: '12px',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '8px',
      }}>
        <span style={{
          fontSize: '11px',
          fontWeight: 500,
          color: 'var(--text-primary)',
        }}>
          Ensemble Diversity
        </span>
        <span style={{
          fontSize: '11px',
          color: stats.coveragePercent === 100 ? 'var(--success)' : 'var(--text-muted)',
          fontWeight: 500,
        }}>
          {stats.coveredCount}/{stats.totalCount} categories
        </span>
      </div>

      {/* Segmented bar */}
      <div style={{
        display: 'flex',
        height: '12px',
        borderRadius: '6px',
        overflow: 'hidden',
        background: 'var(--bg-secondary)',
        marginBottom: '8px',
      }}>
        {stats.categories.map((category, i) => {
          const count = stats.assignedCategories.get(category) || 0;
          const isCovered = count > 0;
          const width = `${100 / stats.totalCount}%`;
          const color = getColor(category);

          return (
            <div
              key={category}
              title={`${category}: ${count} assigned`}
              style={{
                width,
                background: isCovered ? color : 'transparent',
                opacity: isCovered ? 1 : 0.3,
                borderRight: i < stats.categories.length - 1 ? '1px solid var(--bg-tertiary)' : 'none',
                transition: 'background 0.2s ease',
              }}
            />
          );
        })}
      </div>

      {/* Category legend */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '6px',
        marginBottom: stats.missingCategories.length > 0 ? '8px' : 0,
      }}>
        {stats.categories.map(category => {
          const count = stats.assignedCategories.get(category) || 0;
          const isCovered = count > 0;
          const color = getColor(category);

          return (
            <div
              key={category}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '9px',
                color: isCovered ? 'var(--text-primary)' : 'var(--text-muted)',
                opacity: isCovered ? 1 : 0.6,
              }}
            >
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '2px',
                background: isCovered ? color : 'var(--bg-secondary)',
                border: isCovered ? 'none' : `1px solid ${color}`,
              }} />
              <span style={{ textTransform: 'capitalize' }}>
                {category}
                {count > 1 && ` (${count})`}
              </span>
            </div>
          );
        })}
      </div>

      {/* Missing categories warning */}
      {stats.missingCategories.length > 0 && (
        <div style={{
          padding: '8px 10px',
          background: 'rgba(245, 158, 11, 0.1)',
          borderRadius: '4px',
          fontSize: '10px',
          color: 'var(--warning)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '6px',
        }}>
          <span style={{ fontSize: '12px' }}>💡</span>
          <span>
            Consider adding:{' '}
            {stats.missingCategories.map((cat, i) => (
              <span key={cat}>
                <span style={{ textTransform: 'capitalize', fontWeight: 500 }}>{cat}</span>
                {i < stats.missingCategories.length - 1 && ', '}
              </span>
            ))}
          </span>
        </div>
      )}

      {/* All covered celebration */}
      {stats.missingCategories.length === 0 && stats.totalCount > 1 && (
        <div style={{
          padding: '8px 10px',
          background: 'rgba(34, 197, 94, 0.1)',
          borderRadius: '4px',
          fontSize: '10px',
          color: 'var(--success)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}>
          <span>✓</span>
          <span>All categories represented - diverse ensemble!</span>
        </div>
      )}
    </div>
  );
}

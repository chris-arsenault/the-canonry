/**
 * ConfluxesIndex - List view for confluxes (rare world forces)
 * Shows rare confluxes first - the point is to find uncommon phenomena
 */

import { useState, useMemo } from 'react';
import type { PageIndexEntry } from '../types/world.ts';
import styles from './ConfluxesIndex.module.css';

/**
 * Map internal source types to in-universe terminology:
 * - system → "Tide" (recurring background force)
 * - action → "Deed" (deliberate act by an entity)
 * - template → "Emergence" (things coming into being)
 */
const SOURCE_TYPE_LABELS: Record<string, string> = {
  system: 'Tide',
  action: 'Deed',
  template: 'Emergence',
};

function getSourceTypeLabel(sourceType: string): string {
  return SOURCE_TYPE_LABELS[sourceType] || sourceType;
}

interface ConfluxesIndexProps {
  confluxPages: PageIndexEntry[];
  onNavigate: (pageId: string) => void;
  /** Whether narrative history chunks are still loading */
  narrativeHistoryLoading?: boolean;
}

type FilterType = 'all' | 'system' | 'action' | 'template';

export default function ConfluxesIndex({
  confluxPages,
  onNavigate,
  narrativeHistoryLoading = false,
}: ConfluxesIndexProps) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [showFrequent, setShowFrequent] = useState(false);

  // Calculate median manifestations for frequency threshold
  const { frequencyThreshold } = useMemo(() => {
    const manifestations = confluxPages
      .filter(p => p.conflux)
      .map(p => p.conflux?.manifestations ?? 0)
      .sort((a, b) => a - b);

    if (manifestations.length === 0) {
      return { frequencyThreshold: 0 };
    }

    const mid = Math.floor(manifestations.length / 2);
    const median = manifestations.length % 2 === 0
      ? (manifestations[mid - 1] + manifestations[mid]) / 2
      : manifestations[mid];

    return {
      frequencyThreshold: median * 2,
    };
  }, [confluxPages]);

  // Filter and sort confluxes - rarest first
  const { filtered, hiddenCount } = useMemo(() => {
    const withConflux = confluxPages.filter((page) => page.conflux);

    // Apply type filter
    const typeFiltered = withConflux.filter((page) => {
      if (filter === 'all') return true;
      return page.conflux?.sourceType === filter;
    });

    // Count how many are "frequent" (> 2x median)
    const frequent = typeFiltered.filter(
      p => (p.conflux?.manifestations ?? 0) > frequencyThreshold
    );

    // Apply frequency filter if not showing frequent
    const frequencyFiltered = showFrequent
      ? typeFiltered
      : typeFiltered.filter(p => (p.conflux?.manifestations ?? 0) <= frequencyThreshold);

    // Sort by manifestations ascending (rarest first)
    const sorted = frequencyFiltered.sort(
      (a, b) => (a.conflux?.manifestations ?? 0) - (b.conflux?.manifestations ?? 0)
    );

    return {
      filtered: sorted,
      hiddenCount: frequent.length,
    };
  }, [confluxPages, filter, showFrequent, frequencyThreshold]);

  // Calculate stats
  const totalConfluxes = confluxPages.filter(p => p.conflux).length;
  const totalTouched = new Set(
    confluxPages
      .filter(p => p.conflux)
      .flatMap(p => p.linkedEntities)
  ).size;

  const getBadgeClassName = (sourceType: string) => {
    switch (sourceType) {
      case 'system': return styles.badgeSystem;
      case 'action': return styles.badgeAction;
      case 'template': return styles.badgeTemplate;
      default: return styles.badge;
    }
  };

  // Show loading state while narrative history chunks are loading
  if (narrativeHistoryLoading) {
    return (
      <div className={styles.container}>
        <h1 className={styles.heading}>Confluxes</h1>
        <p className={styles.description}>
          Confluxes are the recurring forces and phenomena that shape entity fates in this world.
        </p>
        <div className={styles.loading}>
          <div className={styles.loadingSpinner} />
          <div>Loading narrative history...</div>
          <div className={styles.loadingHint}>
            Conflux data depends on complete narrative history. Please wait while the data loads.
          </div>
        </div>
      </div>
    );
  }

  if (totalConfluxes === 0) {
    return (
      <div className={styles.container}>
        <h1 className={styles.heading}>Confluxes</h1>
        <p className={styles.description}>
          Confluxes are the recurring forces and phenomena that shape entity fates in this world.
        </p>
        <div className={styles.empty}>No confluxes detected. Run a simulation to generate narrative history.</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.heading}>Confluxes</h1>
      <p className={styles.description}>
        Confluxes are the rare forces and phenomena that shape entity fates in this world.
        Sorted by rarity - the most unusual manifestations appear first.
      </p>

      <div className={styles.statsBar}>
        <div className={styles.statItem}>
          <span className={styles.statValue}>{filtered.length}</span>
          <span className={styles.statLabel}>Rare Confluxes</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statValue}>{totalConfluxes}</span>
          <span className={styles.statLabel}>Total</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statValue}>{totalTouched}</span>
          <span className={styles.statLabel}>Entities Touched</span>
        </div>
      </div>

      <div className={styles.filterBar}>
        {(['all', 'system', 'action', 'template'] as FilterType[]).map((f) => (
          <button
            key={f}
            className={filter === f ? styles.filterButtonActive : styles.filterButton}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'All' : getSourceTypeLabel(f) + 's'}
          </button>
        ))}
      </div>

      <div className={styles.checkboxRow}>
        <input
          type="checkbox"
          id="showFrequent"
          checked={showFrequent}
          onChange={(e) => setShowFrequent(e.target.checked)}
          className={styles.checkbox}
        />
        <label htmlFor="showFrequent">
          Show frequent confluxes
          {!showFrequent && hiddenCount > 0 && (
            <span className={styles.frequentNote}> ({hiddenCount} hidden)</span>
          )}
        </label>
      </div>

      <div className={styles.list}>
        {filtered.map((page) => {
          const conflux = page.conflux!;
          return (
            <button
              key={page.id}
              className={styles.item}
              onClick={() => onNavigate(page.id)}
            >
              <div className={styles.itemHeader}>
                <span className={styles.itemTitle}>{page.title}</span>
                <span className={getBadgeClassName(conflux.sourceType)}>
                  {getSourceTypeLabel(conflux.sourceType)}
                </span>
              </div>
              <div className={styles.itemMeta}>
                <span>
                  <span className={styles.metaValue}>{conflux.manifestations}</span> manifestations
                </span>
                <span>
                  <span className={styles.metaValue}>{conflux.touchedCount}</span> entities touched
                </span>
              </div>
              {page.summary && (
                <div className={styles.itemSummary}>{page.summary}</div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

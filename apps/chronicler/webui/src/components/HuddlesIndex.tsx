/**
 * HuddlesIndex - List view for huddles (connected entity networks)
 * Shows largest huddles first - the point is to find significant structures
 */

import { useState, useMemo } from 'react';
import type { PageIndexEntry } from '../types/world.ts';
import styles from './HuddlesIndex.module.css';

interface HuddlesIndexProps {
  huddlePages: PageIndexEntry[];
  onNavigate: (pageId: string) => void;
}

export default function HuddlesIndex({
  huddlePages,
  onNavigate,
}: HuddlesIndexProps) {
  const [entityKindFilter, setEntityKindFilter] = useState<string>('all');

  // Get unique entity kinds for filtering
  const entityKinds = useMemo(() => {
    const kinds = new Set<string>();
    for (const page of huddlePages) {
      if (page.huddleType?.entityKind) {
        kinds.add(page.huddleType.entityKind);
      }
    }
    return Array.from(kinds).sort();
  }, [huddlePages]);

  // Filter and sort huddles - largest first
  const filtered = useMemo(() => {
    const withHuddleType = huddlePages.filter((page) => page.huddleType);

    // Apply entity kind filter
    const kindFiltered = entityKindFilter === 'all'
      ? withHuddleType
      : withHuddleType.filter((page) => page.huddleType?.entityKind === entityKindFilter);

    // Sort by largest huddle size descending
    return kindFiltered.sort(
      (a, b) => (b.huddleType?.largestSize ?? 0) - (a.huddleType?.largestSize ?? 0)
    );
  }, [huddlePages, entityKindFilter]);

  // Calculate stats
  const totalHuddleTypes = huddlePages.filter(p => p.huddleType).length;
  const totalInstances = huddlePages
    .filter(p => p.huddleType)
    .reduce((sum, p) => sum + (p.huddleType?.instanceCount ?? 0), 0);
  const totalEntities = huddlePages
    .filter(p => p.huddleType)
    .reduce((sum, p) => sum + (p.huddleType?.totalEntities ?? 0), 0);
  const largestHuddle = Math.max(
    ...huddlePages.filter(p => p.huddleType).map(p => p.huddleType?.largestSize ?? 0),
    0
  );

  if (totalHuddleTypes === 0) {
    return (
      <div className={styles.container}>
        <h1 className={styles.heading}>Huddles</h1>
        <p className={styles.description}>
          Huddles are connected groups of same-kind entities linked by the same relationship type.
        </p>
        <div className={styles.empty}>No huddles detected. A huddle requires at least 3 entities connected by the same relationship type.</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.heading}>Huddles</h1>
      <p className={styles.description}>
        Huddles are connected groups of same-kind entities linked by the same relationship type.
        Sorted by size - the largest huddles appear first.
      </p>

      <div className={styles.statsBar}>
        <div className={styles.statItem}>
          <span className={styles.statValue}>{totalHuddleTypes}</span>
          <span className={styles.statLabel}>Types</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statValue}>{totalInstances}</span>
          <span className={styles.statLabel}>Huddles</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statValue}>{totalEntities}</span>
          <span className={styles.statLabel}>Entities</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statValue}>{largestHuddle}</span>
          <span className={styles.statLabel}>Largest</span>
        </div>
      </div>

      {entityKinds.length > 1 && (
        <div className={styles.filterBar}>
          <button
            className={entityKindFilter === 'all' ? styles.filterButtonActive : styles.filterButton}
            onClick={() => setEntityKindFilter('all')}
          >
            All
          </button>
          {entityKinds.map((kind) => (
            <button
              key={kind}
              className={entityKindFilter === kind ? styles.filterButtonActive : styles.filterButton}
              onClick={() => setEntityKindFilter(kind)}
            >
              {kind.charAt(0).toUpperCase() + kind.slice(1)}s
            </button>
          ))}
        </div>
      )}

      <div className={styles.list}>
        {filtered.map((page) => {
          const huddleType = page.huddleType!;
          return (
            <button
              key={page.id}
              className={styles.item}
              onClick={() => onNavigate(page.id)}
            >
              <div className={styles.itemHeader}>
                <span className={styles.itemTitle}>{page.title}</span>
                <span className={styles.badge}>
                  {huddleType.entityKind}
                </span>
              </div>
              <div className={styles.itemMeta}>
                <span>
                  <span className={styles.metaValue}>{huddleType.instanceCount}</span> {huddleType.instanceCount === 1 ? 'huddle' : 'huddles'}
                </span>
                <span>
                  <span className={styles.metaValue}>{huddleType.largestSize}</span> in largest
                </span>
                <span>
                  <span className={styles.metaValue}>{huddleType.totalEntities}</span> total entities
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

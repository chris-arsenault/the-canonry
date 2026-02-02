/**
 * ChronicleIndex - list view for accepted chronicles
 */

import { useMemo, useState } from 'react';
import type { WikiPage } from '../types/world.ts';
import styles from './ChronicleIndex.module.css';

interface ChronicleIndexProps {
  chronicles: WikiPage[];
  filter:
    | { kind: 'all' }
    | { kind: 'format'; format: 'story' | 'document' }
    | { kind: 'type'; typeId: string };
  onNavigate: (pageId: string) => void;
}

const SORT_OPTIONS = [
  { value: 'updated_desc', label: 'Recently updated' },
  { value: 'era_asc', label: 'Era (earliest)' },
  { value: 'era_desc', label: 'Era (latest)' },
];

function formatChronicleSubtype(typeId: string): string {
  return typeId
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default function ChronicleIndex({
  chronicles,
  filter,
  onNavigate,
}: ChronicleIndexProps) {
  const [sortMode, setSortMode] = useState('era_asc');

  const filtered = useMemo(() => {
    return chronicles
      .filter((page) => page.chronicle)
      .filter((page) => {
        if (filter.kind === 'all') return true;
        if (filter.kind === 'format') return page.chronicle?.format === filter.format;
        if (filter.kind === 'type') return page.chronicle?.narrativeStyleId === filter.typeId;
        return true;
      });
  }, [chronicles, filter]);

  const sorted = useMemo(() => {
    const getEraInfo = (page: WikiPage) => {
      const focalEra = page.chronicle?.temporalContext?.focalEra;
      if (!focalEra) {
        return { order: Number.POSITIVE_INFINITY, name: '', hasEra: false };
      }
      if (typeof focalEra.order === 'number') {
        return { order: focalEra.order, name: focalEra.name || '', hasEra: true };
      }
      if (typeof focalEra.startTick === 'number') {
        return { order: focalEra.startTick, name: focalEra.name || '', hasEra: true };
      }
      return { order: Number.POSITIVE_INFINITY, name: focalEra.name || '', hasEra: true };
    };

    return [...filtered].sort((a, b) => {
      switch (sortMode) {
        case 'era_asc': {
          const eraA = getEraInfo(a);
          const eraB = getEraInfo(b);
          if (eraA.hasEra !== eraB.hasEra) return eraA.hasEra ? -1 : 1;
          if (eraA.order !== eraB.order) return eraA.order - eraB.order;
          return eraA.name.localeCompare(eraB.name);
        }
        case 'era_desc': {
          const eraA = getEraInfo(a);
          const eraB = getEraInfo(b);
          if (eraA.hasEra !== eraB.hasEra) return eraA.hasEra ? -1 : 1;
          if (eraA.order !== eraB.order) return eraB.order - eraA.order;
          return eraB.name.localeCompare(eraA.name);
        }
        case 'updated_desc':
        default:
          return (b.lastUpdated || 0) - (a.lastUpdated || 0);
      }
    });
  }, [filtered, sortMode]);

  const groupedByEra = useMemo(() => {
    const groups = new Map<string, { label: string; order: number; hasEra: boolean; items: WikiPage[] }>();

    const getEraInfo = (page: WikiPage) => {
      const focalEra = page.chronicle?.temporalContext?.focalEra;
      if (!focalEra) {
        return { order: Number.POSITIVE_INFINITY, label: 'Unknown Era', hasEra: false };
      }
      if (typeof focalEra.order === 'number') {
        return { order: focalEra.order, label: focalEra.name || 'Unknown Era', hasEra: true };
      }
      if (typeof focalEra.startTick === 'number') {
        return { order: focalEra.startTick, label: focalEra.name || 'Unknown Era', hasEra: true };
      }
      return { order: Number.POSITIVE_INFINITY, label: focalEra.name || 'Unknown Era', hasEra: true };
    };

    for (const page of sorted) {
      const info = getEraInfo(page);
      if (!groups.has(info.label)) {
        groups.set(info.label, { label: info.label, order: info.order, hasEra: info.hasEra, items: [] });
      }
      groups.get(info.label)?.items.push(page);
    }

    const entries = Array.from(groups.values());
    if (sortMode === 'era_asc' || sortMode === 'era_desc') {
      entries.sort((a, b) => {
        if (a.hasEra !== b.hasEra) return a.hasEra ? -1 : 1;
        if (a.order !== b.order) {
          return sortMode === 'era_asc' ? a.order - b.order : b.order - a.order;
        }
        return a.label.localeCompare(b.label);
      });
    }
    return entries;
  }, [sorted, sortMode]);

  const heading = filter.kind === 'format'
    ? filter.format === 'story'
      ? 'Stories'
      : 'Documents'
    : filter.kind === 'type'
    ? `${formatChronicleSubtype(filter.typeId)} Chronicles`
    : 'Chronicles';

  const description = filter.kind === 'all'
    ? 'Accepted chronicles from Illuminator.'
    : filter.kind === 'format'
    ? `Accepted ${filter.format === 'story' ? 'stories' : 'documents'} from Illuminator.`
    : `Accepted chronicles of type ${formatChronicleSubtype(filter.typeId)}.`;

  if (sorted.length === 0) {
    return (
      <div className={styles.container}>
        <h1 className={styles.heading}>{heading}</h1>
        <p className={styles.description}>{description}</p>
        <div className={styles.empty}>No chronicles found.</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.heading}>{heading}</h1>
      <div className={styles.descriptionRow}>
        <p className={styles.description}>{description}</p>
        <div className={styles.controls}>
          <div className={styles.sortControl}>
            <span className={styles.sortLabel}>Sort</span>
            <select
              className={styles.sortSelect}
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value)}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className={styles.list}>
        {groupedByEra.map((group) => (
          <div key={group.label} className={styles.group}>
            <div className={styles.groupHeader}>{group.label}</div>
            <div className={styles.groupItems}>
              {group.items.map((page) => {
                const eraLabel = page.chronicle?.temporalContext?.focalEra?.name || 'Unknown Era';
                const isMultiEra = page.chronicle?.temporalContext?.isMultiEra;
                const formatLabel = page.chronicle?.format === 'document' ? 'Document' : 'Story';
                const subtypeLabel = page.chronicle?.narrativeStyleId
                  ? formatChronicleSubtype(page.chronicle.narrativeStyleId)
                  : null;
                const primaryEntities = (page.chronicle?.roleAssignments || [])
                  .filter((role) => role.isPrimary)
                  .map((role) => role.entityName)
                  .filter(Boolean);
                const primaryLabel = primaryEntities.length > 0
                  ? primaryEntities.join(', ')
                  : null;
                const summary = page.content?.summary || '';

                return (
                  <button
                    key={page.id}
                    className={styles.item}
                    onClick={() => onNavigate(page.id)}
                  >
                    <div className={styles.itemHeader}>
                      <span className={styles.itemTitle}>{page.title}</span>
                      <div className={styles.badgeGroup}>
                        <span className={styles.badge}>{formatLabel}</span>
                        {subtypeLabel && (
                          <span className={styles.badgeSecondary}>{subtypeLabel}</span>
                        )}
                      </div>
                    </div>
                    <div className={styles.itemMeta}>
                      <span>Era: {eraLabel}</span>
                      {isMultiEra && <span>Multi-era</span>}
                      {primaryLabel && <span>Primary: {primaryLabel}</span>}
                    </div>
                    {summary && (
                      <div className={styles.itemSummary}>{summary}</div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

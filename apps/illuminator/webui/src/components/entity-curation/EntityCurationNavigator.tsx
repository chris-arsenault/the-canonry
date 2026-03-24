/**
 * EntityCurationNavigator — Kind/culture-grouped entity list.
 *
 * Groups entities by kind (top level), then culture (sub-groups).
 * Shows image coverage count per group.
 */

import React, { useMemo, useState } from "react";
import type { EntityNavItem } from "../../lib/db/entityNav";
import "./EntityCurationNavigator.css";

interface KindGroup {
  kind: string;
  cultures: CultureGroup[];
  totalCount: number;
  imageCount: number;
  completeCount: number;
}

interface CultureGroup {
  culture: string;
  items: EntityNavItem[];
  imageCount: number;
  completeCount: number;
}

interface Props {
  entityNavItems: EntityNavItem[];
  selectedKind: string | null;
  selectedCulture: string | null;
  onSelect: (kind: string | null, culture: string | null) => void;
}

export default function EntityCurationNavigator({
  entityNavItems,
  selectedKind,
  selectedCulture,
  onSelect,
}: Readonly<Props>) {
  const [expandedKinds, setExpandedKinds] = useState<Set<string>>(
    () => new Set(),
  );

  const kindGroups = useMemo((): KindGroup[] => {
    const byKind = new Map<string, Map<string, EntityNavItem[]>>();
    for (const entity of entityNavItems) {
      if (!byKind.has(entity.kind)) byKind.set(entity.kind, new Map());
      const cultureMap = byKind.get(entity.kind)!;
      if (!cultureMap.has(entity.culture))
        cultureMap.set(entity.culture, []);
      cultureMap.get(entity.culture)!.push(entity);
    }

    return Array.from(byKind.entries())
      .map(([kind, cultureMap]) => {
        const cultures: CultureGroup[] = Array.from(cultureMap.entries())
          .map(([culture, items]) => ({
            culture,
            items: items.sort((a, b) => a.name.localeCompare(b.name)),
            imageCount: items.filter((e) => e.imageId).length,
            completeCount: items.filter((e) => e.curationComplete).length,
          }))
          .sort((a, b) => a.culture.localeCompare(b.culture));
        return {
          kind,
          cultures,
          totalCount: cultures.reduce((sum, c) => sum + c.items.length, 0),
          imageCount: cultures.reduce((sum, c) => sum + c.imageCount, 0),
          completeCount: cultures.reduce((sum, c) => sum + c.completeCount, 0),
        };
      })
      .sort((a, b) => a.kind.localeCompare(b.kind));
  }, [entityNavItems]);

  const toggleKind = (kind: string) => {
    setExpandedKinds((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  };

  const totalImages = entityNavItems.filter((e) => e.imageId).length;
  const totalComplete = entityNavItems.filter((e) => e.curationComplete).length;

  return (
    <div className="ecn-navigator">
      <button
        className={`ecn-all-btn ${!selectedKind ? "ecn-selected" : ""}`}
        onClick={() => onSelect(null, null)}
      >
        All ({totalImages}/{entityNavItems.length})
        {totalComplete > 0 && (
          <span className="ecn-complete-count" title={`${totalComplete} curated`}> ✓{totalComplete}</span>
        )}
      </button>
      {kindGroups.map((group) => (
        <div key={group.kind} className="ecn-kind-group">
          <button
            className={`ecn-kind-header ${selectedKind === group.kind && !selectedCulture ? "ecn-selected" : ""}`}
            onClick={() => {
              onSelect(group.kind, null);
              if (!expandedKinds.has(group.kind)) toggleKind(group.kind);
            }}
          >
            <span
              className="ecn-expand"
              onClick={(e) => {
                e.stopPropagation();
                toggleKind(group.kind);
              }}
            >
              {expandedKinds.has(group.kind) ? "▾" : "▸"}
            </span>
            {group.kind} ({group.imageCount}/{group.totalCount})
            {group.completeCount > 0 && (
              <span className="ecn-complete-count" title={`${group.completeCount} curated`}> ✓{group.completeCount}</span>
            )}
          </button>
          {expandedKinds.has(group.kind) &&
            group.cultures.map((culture) => (
              <button
                key={culture.culture}
                className={`ecn-culture-item ${selectedKind === group.kind && selectedCulture === culture.culture ? "ecn-selected" : ""}`}
                onClick={() => onSelect(group.kind, culture.culture)}
              >
                {culture.culture} ({culture.imageCount}/{culture.items.length})
                {culture.completeCount > 0 && (
                  <span className="ecn-complete-count" title={`${culture.completeCount} curated`}> ✓{culture.completeCount}</span>
                )}
              </button>
            ))}
        </div>
      ))}
    </div>
  );
}

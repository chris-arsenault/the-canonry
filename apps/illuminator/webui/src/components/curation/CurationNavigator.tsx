/**
 * CurationNavigator — Era-grouped chronicle list with keyboard navigation.
 *
 * Reads directly from chronicleStore's navItems/navOrder.
 * Groups chronicles by focalEraName, sorted by era order.
 */

import React, { useMemo, useCallback, useState, useEffect } from "react";
import { useChronicleStore } from "../../lib/db/chronicleStore";
import type { ChronicleNavItem } from "../../lib/db/chronicleNav";
import "./CurationNavigator.css";

interface EraGroup {
  eraName: string;
  eraOrder: number;
  items: ChronicleNavItem[];
}

interface CurationNavigatorProps {
  selectedChronicleId: string | null;
  onSelectChronicle: (id: string) => void;
}

const FORMAT_ICONS: Record<string, string> = {
  story: "☰",
  document: "▣",
};

export default function CurationNavigator({
  selectedChronicleId,
  onSelectChronicle,
}: Readonly<CurationNavigatorProps>) {
  const navItems = useChronicleStore((s) => s.navItems);
  const navOrder = useChronicleStore((s) => s.navOrder);

  const eraGroups = useMemo((): EraGroup[] => {
    const groups = new Map<string, EraGroup>();
    for (const id of navOrder) {
      const item = navItems[id];
      if (!item) continue;
      const eraName = item.focalEraName || "Unknown Era";
      const eraOrder = item.focalEraOrder ?? item.focalEraStartTick ?? Infinity;
      if (!groups.has(eraName)) {
        groups.set(eraName, { eraName, eraOrder, items: [] });
      }
      groups.get(eraName)!.items.push(item);
    }
    return Array.from(groups.values()).sort((a, b) => a.eraOrder - b.eraOrder);
  }, [navItems, navOrder]);

  const [expandedEras, setExpandedEras] = useState<Set<string>>(() => new Set());

  // Auto-expand era containing selected chronicle
  useEffect(() => {
    if (!selectedChronicleId) return;
    for (const group of eraGroups) {
      if (group.items.some((item) => item.chronicleId === selectedChronicleId)) {
        setExpandedEras((prev) => {
          if (prev.has(group.eraName)) return prev;
          const next = new Set(prev);
          next.add(group.eraName);
          return next;
        });
        break;
      }
    }
  }, [selectedChronicleId, eraGroups]);

  const toggleEra = useCallback((eraName: string) => {
    setExpandedEras((prev) => {
      const next = new Set(prev);
      if (next.has(eraName)) next.delete(eraName);
      else next.add(eraName);
      return next;
    });
  }, []);

  // Keyboard navigation: arrow up/down moves through visible items
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      e.preventDefault();

      const visible: string[] = [];
      for (const group of eraGroups) {
        if (expandedEras.has(group.eraName)) {
          for (const item of group.items) visible.push(item.chronicleId);
        }
      }
      if (visible.length === 0) return;

      const currentIdx = selectedChronicleId ? visible.indexOf(selectedChronicleId) : -1;
      const nextIdx =
        e.key === "ArrowDown"
          ? Math.min(currentIdx + 1, visible.length - 1)
          : Math.max(currentIdx - 1, 0);
      onSelectChronicle(visible[nextIdx]);
    },
    [eraGroups, expandedEras, selectedChronicleId, onSelectChronicle]
  );

  if (eraGroups.length === 0) {
    return <div className="cnav-empty">No chronicles found</div>;
  }

  return (
    <div className="cnav-list" onKeyDown={handleKeyDown} tabIndex={0} role="listbox">
      {eraGroups.map((group) => (
        <div key={group.eraName}>
          <button className="cnav-era-header" onClick={() => toggleEra(group.eraName)}>
            <span className="cnav-collapse-icon">
              {expandedEras.has(group.eraName) ? "\u25BC" : "\u25B6"}
            </span>
            {group.eraName}
          </button>
          {expandedEras.has(group.eraName) &&
            group.items.map((item) => (
              <button
                key={item.chronicleId}
                className={`cnav-item${selectedChronicleId === item.chronicleId ? " cnav-item-active" : ""}`}
                onClick={() => onSelectChronicle(item.chronicleId)}
                role="option"
                aria-selected={selectedChronicleId === item.chronicleId}
              >
                {item.curationComplete && (
                  <span className="cnav-complete-icon" title="Curation complete">✓</span>
                )}
                <span className="cnav-format-icon">{FORMAT_ICONS[item.format || ""] || ""}</span>
                <span className="cnav-item-name" title={item.name}>
                  {item.name}
                </span>
                {item.imageRefTotalCount > 0 && (
                  <span className="cnav-image-count" title={`${item.imageRefCompleteCount} of ${item.imageRefTotalCount} images complete`}>
                    {item.imageRefCompleteCount}/{item.imageRefTotalCount}
                  </span>
                )}
              </button>
            ))}
        </div>
      ))}
    </div>
  );
}

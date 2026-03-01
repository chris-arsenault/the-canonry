/**
 * ChronicleNavList - Scrollable, virtualized nav list of chronicle + era narrative cards.
 */

import React, { useCallback } from "react";
import { ChronicleItemCard } from "./ChronicleItemCard";
import { EraNarrativeItemCard } from "./EraNarrativeItemCard";
import type { CombinedNavItem, ChronicleNavItem, EraNarrativeNavItem } from "./chroniclePanelTypes";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GroupedItems {
  label: string;
  items: CombinedNavItem[];
}

export interface ChronicleNavListProps {
  filteredItems: CombinedNavItem[];
  visibleItems: CombinedNavItem[];
  groupByType: boolean;
  groupedItems: GroupedItems[] | null;
  selectedItemId: string | null;
  onSelectItem: (id: string) => void;
  navListRef: React.RefObject<HTMLDivElement | null>;
  navLoadMoreRef: React.RefObject<HTMLDivElement | null>;
  hasMore: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isEraNarrative(item: CombinedNavItem): item is EraNarrativeNavItem {
  return item.itemType === "era_narrative";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ChronicleNavList({
  filteredItems,
  visibleItems,
  groupByType,
  groupedItems,
  selectedItemId,
  onSelectItem,
  navListRef,
  navLoadMoreRef,
  hasMore,
}: ChronicleNavListProps) {
  const renderItem = useCallback(
    (item: CombinedNavItem) => {
      if (isEraNarrative(item)) {
        return (
          <EraNarrativeItemCard
            key={item.id}
            item={item}
            isSelected={item.id === selectedItemId}
            onClick={() => onSelectItem(item.id)}
          />
        );
      }
      return (
        <ChronicleItemCard
          key={item.id}
          item={item as ChronicleNavItem}
          isSelected={item.id === selectedItemId}
          onClick={() => onSelectItem(item.id)}
        />
      );
    },
    [selectedItemId, onSelectItem],
  );

  return (
    <div ref={navListRef} className="chron-nav">
      {filteredItems.length === 0 && (
        <div className="chron-nav-empty">
          <div className="chron-nav-empty-title">No chronicles match your filters</div>
          <div className="chron-nav-empty-hint">
            Adjust filters or clear search to see more.
          </div>
        </div>
      )}

      {filteredItems.length > 0 && groupByType && groupedItems &&
        groupedItems.map((group) => (
          <div key={group.label} className="chron-nav-group">
            <div className="chron-nav-group-header">
              <span>{group.label}</span>
              <span className="chron-nav-group-count">{group.items.length}</span>
            </div>
            {group.items.map(renderItem)}
          </div>
        ))}

      {filteredItems.length > 0 &&
        !(groupByType && groupedItems) &&
        visibleItems.map(renderItem)}

      {hasMore && (
        <div ref={navLoadMoreRef} className="chron-nav-load-more">
          Loading more...
        </div>
      )}
    </div>
  );
}

export default ChronicleNavList;

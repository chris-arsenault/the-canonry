/**
 * ContentPalette — Filterable, sortable list of available content items.
 *
 * Right pane of the two-pane content tree layout.
 * Items can be clicked to add to the selected folder, or dragged
 * onto the tree container via react-dnd (shared context with react-arborist).
 */

import React, { useState, useMemo } from "react";
import { useDrag } from "react-dnd";
import type { PersistedEntity } from "../../lib/db/illuminatorDb";
import type { ChronicleRecord } from "../../lib/chronicleTypes";
import type { StaticPage } from "../../lib/staticPageTypes";
import type { EraNarrativeRecord } from "../../lib/eraNarrativeTypes";
import type { ContentNodeType } from "../../lib/preprint/prePrintTypes";
import { resolveActiveContent } from "../../lib/db/eraNarrativeRepository";
import { countWords } from "../../lib/db/staticPageRepository";

type TypeFilter = "all" | "entity" | "chronicle" | "era_narrative" | "static_page";
type SortBy = "name" | "type" | "words";

export interface PaletteItem {
  type: ContentNodeType;
  contentId: string;
  name: string;
  subtitle: string;
  wordCount: number;
}

/** react-dnd item type for palette → tree drag */
export const PALETTE_ITEM_TYPE = "PALETTE_CONTENT_ITEM";

/** Payload shape carried by dragged palette items */
export interface PaletteItemDragPayload {
  type: ContentNodeType;
  contentId: string;
  name: string;
}

interface ContentPaletteProps {
  entities: PersistedEntity[];
  chronicles: ChronicleRecord[];
  staticPages: StaticPage[];
  eraNarratives: EraNarrativeRecord[];
  usedIds: Set<string>;
  selectedFolderId: string | null;
  onAddContent: (item: { type: ContentNodeType; contentId: string; name: string }) => void;
}

const TYPE_ICONS: Record<string, string> = {
  entity: "{}",
  chronicle: "\u2016",
  static_page: "[]",
  era_narrative: "\u25C6",
};

const TYPE_FILTER_LABELS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "era_narrative", label: "Narratives" },
  { value: "chronicle", label: "Chronicles" },
  { value: "entity", label: "Entities" },
  { value: "static_page", label: "Pages" },
];

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: "name", label: "Name" },
  { value: "type", label: "Type" },
  { value: "words", label: "Words" },
];

/** Individual draggable palette row — needs its own component for the useDrag hook. */
function PaletteItemRow({
  item,
  disabled,
  onClick,
}: {
  item: PaletteItem;
  disabled: boolean;
  onClick: () => void;
}) {
  const [{ isDragging }, dragRef] = useDrag<PaletteItemDragPayload, void, { isDragging: boolean }>({
    type: PALETTE_ITEM_TYPE,
    item: { type: item.type, contentId: item.contentId, name: item.name },
    canDrag: !disabled,
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  });

  return (
    <div
      ref={dragRef}
      className={`preprint-palette-item${disabled ? " disabled" : ""}${isDragging ? " dragging" : ""}`}
      onClick={onClick}
      title={disabled ? "Select a folder first" : "Drag to tree or click to add"}
    >
      <span className="preprint-palette-item-icon">{TYPE_ICONS[item.type] || "?"}</span>
      <span className="preprint-palette-item-name">{item.name}</span>
      <span className="preprint-palette-item-sub">{item.subtitle}</span>
      <span className="preprint-palette-item-wc" title="Word count">
        {item.wordCount.toLocaleString()}w
      </span>
    </div>
  );
}

export default function ContentPalette({
  entities,
  chronicles,
  staticPages,
  eraNarratives,
  usedIds,
  selectedFolderId,
  onAddContent,
}: ContentPaletteProps) {
  const [filter, setFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [sortBy, setSortBy] = useState<SortBy>("type");

  const allItems = useMemo<PaletteItem[]>(() => {
    const items: PaletteItem[] = [];

    for (const e of entities) {
      if (!e.description || usedIds.has(e.id) || e.kind === "era") continue;
      items.push({
        type: "entity",
        contentId: e.id,
        name: e.name,
        subtitle: `${e.kind}${e.subtype ? " / " + e.subtype : ""}`,
        wordCount: countWords(e.description || ""),
      });
    }

    for (const c of chronicles) {
      if (c.status !== "complete" && c.status !== "assembly_ready") continue;
      if (usedIds.has(c.chronicleId)) continue;
      const content = c.finalContent || c.assembledContent || "";
      items.push({
        type: "chronicle",
        contentId: c.chronicleId,
        name: c.title || "Untitled Chronicle",
        subtitle: `${c.format} \u2022 ${c.focusType}`,
        wordCount: countWords(content),
      });
    }

    for (const n of eraNarratives) {
      if (n.status !== "complete" && n.status !== "step_complete") continue;
      if (usedIds.has(n.narrativeId)) continue;
      const { content } = resolveActiveContent(n);
      items.push({
        type: "era_narrative",
        contentId: n.narrativeId,
        name: n.eraName,
        subtitle: `${n.tone} \u2022 era narrative`,
        wordCount: countWords(content || ""),
      });
    }

    for (const p of staticPages) {
      if (p.status !== "published" || usedIds.has(p.pageId)) continue;
      items.push({
        type: "static_page",
        contentId: p.pageId,
        name: p.title,
        subtitle: `${p.wordCount.toLocaleString()} words`,
        wordCount: p.wordCount,
      });
    }

    return items;
  }, [entities, chronicles, eraNarratives, staticPages, usedIds]);

  const filteredItems = useMemo(() => {
    let items = allItems;

    // Type filter
    if (typeFilter !== "all") {
      items = items.filter((i) => i.type === typeFilter);
    }

    // Text filter
    if (filter) {
      const lower = filter.toLowerCase();
      items = items.filter(
        (i) => i.name.toLowerCase().includes(lower) || i.subtitle.toLowerCase().includes(lower)
      );
    }

    // Sort
    items = [...items].sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "words") return b.wordCount - a.wordCount;
      // 'type': group by type, then name
      if (a.type !== b.type) return a.type.localeCompare(b.type);
      return a.name.localeCompare(b.name);
    });

    return items;
  }, [allItems, typeFilter, filter, sortBy]);

  const handleClick = (item: PaletteItem) => {
    if (!selectedFolderId) return;
    onAddContent({ type: item.type, contentId: item.contentId, name: item.name });
  };

  return (
    <div className="preprint-palette">
      <div className="preprint-palette-controls">
        <input
          type="text"
          className="preprint-input preprint-palette-search"
          placeholder="Search content..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <div className="preprint-palette-filters">
          {TYPE_FILTER_LABELS.map((tf) => (
            <button
              key={tf.value}
              className={`preprint-palette-chip ${typeFilter === tf.value ? "active" : ""}`}
              onClick={() => setTypeFilter(tf.value)}
            >
              {tf.label}
            </button>
          ))}
          <select
            className="preprint-palette-sort"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            title="Sort order"
          >
            {SORT_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="preprint-palette-list">
        {filteredItems.length === 0 && (
          <div className="preprint-palette-empty">
            {allItems.length === 0
              ? "All content has been placed in the tree."
              : "No items match the current filters."}
          </div>
        )}
        {filteredItems.map((item) => (
          <PaletteItemRow
            key={`${item.type}-${item.contentId}`}
            item={item}
            disabled={!selectedFolderId}
            onClick={() => handleClick(item)}
          />
        ))}
      </div>

      <div className="preprint-palette-footer">
        {filteredItems.length} of {allItems.length} items
        {!selectedFolderId && allItems.length > 0 && (
          <span className="preprint-palette-hint"> — select a folder to add</span>
        )}
      </div>
    </div>
  );
}

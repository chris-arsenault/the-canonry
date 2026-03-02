/**
 * CategorySection - Collapsible section for grouping items by category
 */

import React from 'react';
import type { Optional } from '../types/optionality.js';

interface CategorySectionProps {
  readonly id: Optional<string>;
  readonly icon: Optional<string>;
  readonly label: string;
  readonly items: unknown[];
  readonly expanded: boolean;
  readonly onToggleExpand: (e?: React.MouseEvent | React.KeyboardEvent) => void;
  readonly allEnabled: Optional<boolean>;
  readonly onToggleAll: Optional<() => void>;
  readonly renderItem: (item: unknown, index: number) => React.ReactNode;
  readonly gridClassName: Optional<string>;
  readonly className: Optional<string>;
}

/**
 * @param {Object} props
 * @param {string} [props.id] - Optional category identifier
 * @param {string} props.icon - Emoji icon for the category
 * @param {string} props.label - Category label
 * @param {Array} props.items - Items in this category
 * @param {boolean} props.expanded - Whether the section is expanded
 * @param {Function} props.onToggleExpand - Callback to toggle expansion
 * @param {boolean} props.allEnabled - Whether all items are enabled
 * @param {Function} props.onToggleAll - Callback to toggle all items
 * @param {Function} props.renderItem - Render function for each item
 * @param {string} [props.gridClassName] - Custom grid class name
 * @param {string} [props.className] - Additional class names
 */
export function CategorySection({
  id: _id,
  icon,
  label,
  items,
  expanded,
  onToggleExpand,
  allEnabled,
  onToggleAll,
  renderItem,
  gridClassName = 'list-grid',
  className = '',
}: CategorySectionProps) {
  return (
    <div className={`category-section ${className}`.trim()}>
      <div className="category-header" onClick={onToggleExpand} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onToggleExpand(e); }} >
        <span className={`category-expand ${expanded ? 'category-expand-open' : ''}`}>
          &gt;
        </span>
        <span className="category-icon">{icon}</span>
        <span className="category-title">{label}</span>
        <span className="badge-count">{items.length}</span>
        <button
          className={`btn-switch-category ${allEnabled ? 'btn-switch-category-active' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleAll();
          }}
        >
          {allEnabled ? 'All On' : 'All Off'}
        </button>
      </div>
      {expanded && (
        <div className={gridClassName}>
          {items.map(renderItem)}
        </div>
      )}
    </div>
  );
}

export default CategorySection;

/**
 * CategorySection - Collapsible section for grouping items by category
 */

import React from 'react';

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
  id,
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
}) {
  return (
    <div className={`category-section ${className}`.trim()}>
      <div className="category-header" onClick={onToggleExpand}>
        <span className={`category-expand ${expanded ? 'category-expand-open' : ''}`}>
          &gt;
        </span>
        <span className="category-icon">{icon}</span>
        <span className="category-title">{label}</span>
        <span className="badge-count">{items.length}</span>
        <button
          className={`btn-toggle-category ${allEnabled ? 'btn-toggle-category-active' : ''}`}
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

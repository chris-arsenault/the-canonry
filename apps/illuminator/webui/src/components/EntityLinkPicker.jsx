/**
 * EntityLinkPicker - Modal for inserting [[Entity Name]] links
 *
 * Shows a searchable list of entities from the world data
 * and inserts wiki-style links at the cursor position.
 */

import { useState, useMemo, useRef } from 'react';

export default function EntityLinkPicker({ entities, onSelect, onClose }) {
  const [search, setSearch] = useState('');
  const mouseDownOnOverlay = useRef(false);

  const handleOverlayMouseDown = (e) => {
    mouseDownOnOverlay.current = e.target === e.currentTarget;
  };

  const handleOverlayClick = (e) => {
    if (mouseDownOnOverlay.current && e.target === e.currentTarget) {
      onClose();
    }
  };

  const filteredEntities = useMemo(() => {
    if (!entities?.length) return [];

    const searchLower = search.toLowerCase();
    return entities
      .filter((entity) => {
        if (!search) return true;
        return (
          entity.name.toLowerCase().includes(searchLower) ||
          entity.kind.toLowerCase().includes(searchLower) ||
          (entity.subtype && entity.subtype.toLowerCase().includes(searchLower))
        );
      })
      .slice(0, 50); // Limit results for performance
  }, [entities, search]);

  const handleSelect = (entity) => {
    onSelect(`[[${entity.name}]]`);
    onClose();
  };

  return (
    <div className="static-page-modal-overlay" onMouseDown={handleOverlayMouseDown} onClick={handleOverlayClick}>
      <div className="static-page-modal">
        <div className="static-page-modal-header">
          <h3>Insert Entity Link</h3>
          <button className="static-page-modal-close" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="static-page-modal-body">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search entities..."
            className="static-page-search-input"
            autoFocus
          />

          <div className="entity-link-list">
            {filteredEntities.length === 0 ? (
              <div className="entity-link-empty">
                {search ? 'No entities match your search' : 'No entities available'}
              </div>
            ) : (
              filteredEntities.map((entity) => (
                <button
                  key={entity.id}
                  className="entity-link-item"
                  onClick={() => handleSelect(entity)}
                >
                  <span className="entity-link-name">{entity.name}</span>
                  <span className="entity-link-meta">
                    {entity.subtype || entity.kind}
                    {entity.culture && ` • ${entity.culture}`}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

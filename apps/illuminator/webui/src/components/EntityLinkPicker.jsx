/**
 * EntityLinkPicker - Modal for inserting [[Entity Name]] links
 *
 * Shows a searchable list of entities from the world data
 * and inserts wiki-style links at the cursor position.
 */

import React, { useState, useMemo } from "react";
import PropTypes from "prop-types";
import { ModalShell } from "@penguin-tales/shared-components";
import { useEntityNavList } from "../lib/db/entitySelectors";

export default function EntityLinkPicker({ onSelect, onClose }) {
  const entities = useEntityNavList();
  const [search, setSearch] = useState("");

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
    <ModalShell onClose={onClose} title="Insert Entity Link" className="entity-link-picker-modal">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search entities..."
        className="static-page-search-input"
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
      />

      <div className="entity-link-list">
        {filteredEntities.length === 0 ? (
          <div className="entity-link-empty">
            {search ? "No entities match your search" : "No entities available"}
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
    </ModalShell>
  );
}

EntityLinkPicker.propTypes = {
  onSelect: PropTypes.func,
  onClose: PropTypes.func,
};

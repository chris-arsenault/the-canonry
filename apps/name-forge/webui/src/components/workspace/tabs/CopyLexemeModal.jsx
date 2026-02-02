import { useState, useRef } from 'react';

/**
 * Generate a unique ID with culture prefix, avoiding conflicts
 */
function generateUniqueId(cultureId, sourceId, existingIds) {
  const suffix = sourceId.replace(/^[^_]+_/, '');
  let newId = `${cultureId}_${suffix}`;
  let counter = 1;
  while (existingIds.includes(newId)) {
    newId = `${cultureId}_${suffix}_${counter}`;
    counter++;
  }
  return newId;
}

/**
 * Copy Lexeme List Modal - copy lexeme lists from another culture
 */
export function CopyLexemeModal({ cultureId, allCultures, existingListIds, onCopy, onClose }) {
  const [selectedCulture, setSelectedCulture] = useState(null);
  const [selectedLists, setSelectedLists] = useState(new Set());
  const mouseDownOnOverlay = useRef(false);

  const handleOverlayMouseDown = (e) => {
    mouseDownOnOverlay.current = e.target === e.currentTarget;
  };

  const handleOverlayClick = (e) => {
    if (mouseDownOnOverlay.current && e.target === e.currentTarget) {
      onClose();
    }
  };

  const otherCultures = Object.entries(allCultures || {})
    .filter(([id]) => id !== cultureId)
    .map(([id, config]) => ({
      id,
      name: config.name || id,
      lexemeLists: config.naming?.lexemeLists || {}
    }));

  const selectedCultureLists = selectedCulture
    ? Object.entries(allCultures[selectedCulture]?.naming?.lexemeLists || {})
    : [];

  const toggleList = (listId) => {
    const newSelected = new Set(selectedLists);
    if (newSelected.has(listId)) {
      newSelected.delete(listId);
    } else {
      newSelected.add(listId);
    }
    setSelectedLists(newSelected);
  };

  const selectAll = () => {
    setSelectedLists(new Set(selectedCultureLists.map(([id]) => id)));
  };

  const selectNone = () => {
    setSelectedLists(new Set());
  };

  const handleCopy = () => {
    if (selectedLists.size === 0) return;

    const sourceCulture = allCultures[selectedCulture];
    const copiedLists = {};
    const usedIds = [...existingListIds];

    selectedLists.forEach(listId => {
      const sourceList = sourceCulture?.naming?.lexemeLists?.[listId];
      if (sourceList) {
        const newId = generateUniqueId(cultureId, listId, usedIds);
        usedIds.push(newId);

        copiedLists[newId] = {
          ...sourceList,
          id: newId,
          description: sourceList.description
            ? `${sourceList.description} (copied from ${selectedCulture})`
            : `Copied from ${selectedCulture}`
        };
      }
    });

    onCopy(copiedLists);
  };

  return (
    <div className="modal-overlay" onMouseDown={handleOverlayMouseDown} onClick={handleOverlayClick}>
      <div className="modal-content copy-modal">
        <div className="tab-header mb-md">
          <h3 className="mt-0">Copy Lexeme Lists from Another Culture</h3>
          <button className="secondary" onClick={onClose}>×</button>
        </div>

        <div className="copy-modal-body">
          <div className="form-group">
            <label>Source Culture</label>
            <select
              value={selectedCulture || ''}
              onChange={(e) => {
                setSelectedCulture(e.target.value || null);
                setSelectedLists(new Set());
              }}
            >
              <option value="">Select a culture...</option>
              {otherCultures.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} ({Object.keys(c.lexemeLists).length} lists)
                </option>
              ))}
            </select>
          </div>

          {selectedCulture && selectedCultureLists.length > 0 && (
            <div className="form-group">
              <div className="flex justify-between align-center mb-sm">
                <label className="mb-0">Select Lists to Copy</label>
                <div className="flex gap-sm">
                  <button className="secondary sm" onClick={selectAll}>All</button>
                  <button className="secondary sm" onClick={selectNone}>None</button>
                </div>
              </div>
              <div className="copy-list-grid">
                {selectedCultureLists.map(([listId, list]) => (
                  <label key={listId} className="copy-list-item">
                    <input
                      type="checkbox"
                      checked={selectedLists.has(listId)}
                      onChange={() => toggleList(listId)}
                    />
                    <div className="copy-list-item-info">
                      <strong>{listId}</strong>
                      <span className="text-muted text-small">
                        {list.entries?.length || 0} entries
                        {list.source === 'llm' && ' • LLM'}
                        {list.source === 'manual' && ' • Manual'}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {selectedCulture && selectedCultureLists.length === 0 && (
            <p className="text-muted">No lexeme lists in this culture.</p>
          )}

          {selectedLists.size > 0 && (
            <div className="copy-preview">
              <h4>Will Copy {selectedLists.size} List{selectedLists.size > 1 ? 's' : ''}</h4>
              <p className="text-small text-muted">
                Lists will be renamed with "{cultureId}_" prefix.
              </p>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="secondary" onClick={onClose}>Cancel</button>
          <button
            className="primary"
            onClick={handleCopy}
            disabled={selectedLists.size === 0}
          >
            Copy {selectedLists.size > 0 ? `${selectedLists.size} List${selectedLists.size > 1 ? 's' : ''}` : 'Lists'}
          </button>
        </div>
      </div>
    </div>
  );
}

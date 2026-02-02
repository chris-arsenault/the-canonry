import React from 'react';

/**
 * DomainSelector - Left panel for selecting domains to optimize
 */
export default function DomainSelector({
  domainsByCulture,
  allDomains,
  selectedDomains,
  expandedCultures,
  onToggleDomain,
  onToggleCulture,
  onToggleAllInCulture,
  onSelectAll,
  onDeselectAll,
}) {
  return (
    <div className="optimizer-sidebar">
      <div className="optimizer-sidebar-header">
        <h3 className="mt-0 mb-sm text-small">Select Domains</h3>
        <div className="flex gap-sm">
          <button onClick={onSelectAll} className="secondary btn-xs">
            Select All
          </button>
          <button onClick={onDeselectAll} className="secondary btn-xs">
            Clear
          </button>
        </div>
        <div className="mt-sm text-small text-muted">
          {selectedDomains.size} of {allDomains.length} selected
        </div>
      </div>

      <div className="optimizer-sidebar-list">
        {Object.entries(domainsByCulture).map(([cultureId, { name, domains }]) => {
          const isExpanded = expandedCultures.has(cultureId);
          const allSelected = domains.every(d => selectedDomains.has(d.id));
          const someSelected = domains.some(d => selectedDomains.has(d.id));

          return (
            <div key={cultureId} className="mb-sm">
              <div className="culture-row">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={el => { if (el) el.indeterminate = someSelected && !allSelected; }}
                  onChange={() => onToggleAllInCulture(cultureId)}
                  onClick={(e) => e.stopPropagation()}
                  className="accent-ice"
                />
                <span
                  onClick={() => onToggleCulture(cultureId)}
                  className="culture-row-label"
                >
                  {isExpanded ? '▼' : '▶'} {name || cultureId}
                  <span className="text-muted font-normal ml-sm">
                    ({domains.length})
                  </span>
                </span>
              </div>

              {isExpanded && (
                <div className="domain-list">
                  {domains.map(domain => (
                    <div
                      key={domain.id}
                      className={`domain-row ${selectedDomains.has(domain.id) ? 'selected' : ''}`}
                      onClick={() => onToggleDomain(domain.id)}
                    >
                      <input
                        type="checkbox"
                        checked={selectedDomains.has(domain.id)}
                        onChange={() => onToggleDomain(domain.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="accent-gold"
                      />
                      <span>{domain.id}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {allDomains.length === 0 && (
          <div className="empty-message">
            No domains found. Create domains in the Workshop tab first.
          </div>
        )}
      </div>
    </div>
  );
}

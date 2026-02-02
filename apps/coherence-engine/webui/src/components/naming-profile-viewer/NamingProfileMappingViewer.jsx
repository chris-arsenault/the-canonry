/**
 * NamingProfileMappingViewer - Shows how naming profiles map to entity creation
 *
 * Displays:
 * 1. Which generators create which entity kinds (with culture inheritance info)
 * 2. For each kind/culture, which naming profile strategy group applies
 * 3. Warnings for gaps where naming may fail (no matching profile)
 */

import React, { useState, useMemo } from 'react';
import './naming-profile-viewer.css';
import { analyzeNamingMappings } from './utils';

export default function NamingProfileMappingViewer({ generators = [], schema = {} }) {
  const [showInherited, setShowInherited] = useState(false);

  const { mappings, warnings } = useMemo(
    () => analyzeNamingMappings(generators, schema),
    [generators, schema]
  );

  // Group by generator for display
  const groupedMappings = useMemo(() => {
    const groups = {};
    for (const m of mappings) {
      if (!groups[m.generatorId]) {
        groups[m.generatorId] = {
          generatorId: m.generatorId,
          generatorName: m.generatorName,
          items: [],
        };
      }
      groups[m.generatorId].items.push(m);
    }
    return Object.values(groups);
  }, [mappings]);

  // Filter warnings - show all by default, but can filter to just explicit cultures
  const displayWarnings = showInherited
    ? warnings
    : warnings.filter(w => w.cultureSource === 'explicit' || w.reason === 'No matching strategy group');

  const successCount = mappings.filter(m => m.match).length;
  const warningCount = warnings.filter(w => w.reason === 'No matching strategy group').length;

  if (mappings.length === 0) {
    return (
      <div className="naming-profile-container">
        <div className="naming-profile-header">
          <div className="naming-profile-title">
            <span>Naming Profile Mappings</span>
          </div>
        </div>
        <div className="naming-profile-empty-state">
          No generators with entity creation defined. Add generators to see naming profile mappings.
        </div>
      </div>
    );
  }

  return (
    <div className="naming-profile-container">
      <div className="naming-profile-header">
        <div className="naming-profile-title">
          <span>Naming Profile Mappings</span>
        </div>
        <div className="naming-profile-stats">
          <div className="naming-profile-stat-item">
            <span className="naming-profile-stat-value text-success">{successCount}</span>
            <span>matched</span>
          </div>
          <div className="naming-profile-stat-item">
            <span className={`naming-profile-stat-value ${warningCount > 0 ? 'text-danger' : 'text-muted'}`}>{warningCount}</span>
            <span>missing</span>
          </div>
          <label className="cursor-pointer flex items-center gap-xs">
            <input
              type="checkbox"
              checked={showInherited}
              onChange={(e) => setShowInherited(e.target.checked)}
            />
            <span>Show inherited cultures</span>
          </label>
        </div>
      </div>

      <div className="naming-profile-content">
        {/* Warnings section */}
        {displayWarnings.length > 0 && (
          <div className="naming-profile-section">
            <div className="naming-profile-section-title">
              <span className="naming-profile-warning-icon">Warning</span>
              <span>Naming May Fail ({displayWarnings.length})</span>
            </div>
            <div className="naming-profile-warning-list">
              {displayWarnings.slice(0, 10).map((w, i) => (
                <div key={`${w.generatorId}-${w.cultureId}-${i}`} className="naming-profile-warning-item">
                  <span className="naming-profile-warning-icon">!</span>
                  <span>
                    <strong>{w.generatorName}</strong> creates <strong>{w.entityKind}</strong>
                    {w.subtype && `:${w.subtype}`} for culture <strong>{w.cultureName}</strong>
                    {' '}- {w.reason}
                  </span>
                </div>
              ))}
              {displayWarnings.length > 10 && (
                <div className="text-muted" style={{ padding: 'var(--spacing-md) var(--spacing-lg)' }}>
                  ... and {displayWarnings.length - 10} more
                </div>
              )}
            </div>
          </div>
        )}

        {/* Mappings table */}
        <div className="naming-profile-section">
          <div className="naming-profile-section-title">
            <span>Entity Creation to Naming Profile</span>
          </div>
          <table className="naming-profile-mapping-table">
            <thead>
              <tr>
                <th className="naming-profile-table-header">Generator</th>
                <th className="naming-profile-table-header">Entity Kind</th>
                <th className="naming-profile-table-header">Culture</th>
                <th className="naming-profile-table-header">Naming Profile</th>
              </tr>
            </thead>
            <tbody>
              {groupedMappings.slice(0, 20).flatMap((group) => {
                // Filter items based on showInherited toggle
                const filteredItems = showInherited
                  ? group.items
                  : group.items.filter(m => m.cultureSource === 'explicit' || m.cultureSource === 'any');
                // If no explicit cultures, show first inherited one as representative
                const displayItems = filteredItems.length > 0
                  ? filteredItems
                  : group.items.slice(0, 1);
                return displayItems.map((m, idx) => (
                    <tr
                      key={`${m.generatorId}-${m.cultureId}-${m.entityKind}-${idx}`}
                      className={`naming-profile-table-row ${(!m.match && m.hasNamingProfile) ? 'naming-profile-warning-row' : ''}`}
                    >
                      <td className="naming-profile-table-cell naming-profile-generator-cell">
                        {idx === 0 ? m.generatorName : ''}
                      </td>
                      <td className="naming-profile-table-cell">
                        <span className="naming-profile-kind-badge">{m.entityKind}</span>
                        {m.subtype && <span className="naming-profile-kind-badge" style={{ backgroundColor: 'transparent' }}>{m.subtype}</span>}
                      </td>
                      <td className="naming-profile-table-cell">
                        <div className="naming-profile-culture-cell">
                          <span className="naming-profile-culture-dot" style={{ backgroundColor: m.cultureColor }} />
                          <span>{m.cultureName}</span>
                          {m.cultureSource === 'inherited' && (
                            <span className="naming-profile-badge naming-profile-badge-inherited">inherited</span>
                          )}
                        </div>
                      </td>
                      <td className="naming-profile-table-cell">
                        {m.match ? (
                          <span className="naming-profile-badge naming-profile-badge-match">
                            {m.match.profileName || m.match.profileId}
                            {m.match.groupName && ` / ${m.match.groupName}`}
                          </span>
                        ) : !m.hasNamingProfile ? (
                          <span className="naming-profile-badge naming-profile-badge-missing">
                            No profiles configured
                          </span>
                        ) : (
                          <span className="naming-profile-badge naming-profile-badge-missing">
                            No matching group
                          </span>
                        )}
                      </td>
                    </tr>
                  ));
              })}
            </tbody>
          </table>
          {groupedMappings.length > 20 && (
            <div className="text-muted text-center text-xs p-md">
              Showing first 20 generators. Total: {groupedMappings.length}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export { NamingProfileMappingViewer };

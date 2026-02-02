/**
 * ConfigurationSummary - Displays a summary of all configuration for the simulation
 *
 * Shows what data has been configured in canonry and is available for the simulation.
 */

import React from 'react';

export default function ConfigurationSummary({
  schema,
  eras,
  pressures,
  generators,
  seedEntities,
  seedRelationships,
  validation,
  onNavigateToRun,
}) {
  return (
    <div className="lw-container">
      <div className="lw-header">
        <h1 className="lw-title">Configuration Summary</h1>
        <p className="lw-subtitle">
          Review the world configuration before running the simulation
        </p>
      </div>

      {/* Validation Status */}
      <div className={`lw-validation-box ${validation.isValid ? 'valid' : 'invalid'}`}>
        <div className={`lw-validation-title ${validation.isValid ? 'valid' : 'invalid'}`}>
          {validation.isValid ? 'Configuration is ready' : 'Configuration incomplete'}
        </div>

        {validation.issues.length > 0 && (
          <ul className="lw-validation-list">
            {validation.issues.map((issue, i) => (
              <li key={i} className="lw-validation-item error">{issue}</li>
            ))}
          </ul>
        )}

        {validation.warnings.length > 0 && (
          <ul className="lw-validation-list" style={{ marginTop: validation.issues.length > 0 ? '8px' : 0 }}>
            {validation.warnings.map((warning, i) => (
              <li key={i} className="lw-validation-item warning">{warning}</li>
            ))}
          </ul>
        )}
      </div>

      {/* Stats Overview */}
      <div className="lw-stats-grid">
        <StatCard label="Entity Kinds" value={validation.stats.entityKinds} />
        <StatCard label="Relationship Kinds" value={validation.stats.relationshipKinds} />
        <StatCard label="Cultures" value={validation.stats.cultures} />
        <StatCard label="Eras" value={validation.stats.eras} />
        <StatCard label="Pressures" value={validation.stats.pressures} />
        <StatCard label="Generators" value={validation.stats.generators} />
        <StatCard label="Seed Entities" value={validation.stats.seedEntities} />
        <StatCard label="Seed Relationships" value={validation.stats.seedRelationships} />
      </div>

      {/* Eras Detail */}
      <div className="lw-section">
        <h2 className="lw-section-title">Eras ({eras.length})</h2>
        {eras.length === 0 ? (
          <div className="lw-empty-state" style={{ height: 'auto', padding: '20px' }}>
            No eras defined. Configure eras in the Coherence Engine tab.
          </div>
        ) : (
          eras.map((era) => (
            <div key={era.id} className="lw-detail-card">
              <div className="lw-detail-header">
                <span className="lw-detail-name">{era.name || era.id}</span>
                <span className="lw-detail-id">{era.id}</span>
              </div>
              {era.summary && (
                <div className="lw-detail-description">{era.summary}</div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Cultures */}
      <div className="lw-section">
        <h2 className="lw-section-title">Cultures ({schema.cultures.length})</h2>
        {schema.cultures.length === 0 ? (
          <div className="lw-empty-state" style={{ height: 'auto', padding: '20px' }}>
            No cultures defined. Configure cultures in the Enumerist tab.
          </div>
        ) : (
          <div className="lw-item-list">
            {schema.cultures.map((culture) => (
              <span
                key={culture.id}
                className="lw-item-badge"
                style={{
                  borderColor: culture.color || 'var(--lw-border-color)',
                  color: culture.color || 'var(--lw-text-secondary)',
                }}
              >
                {culture.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Entity Kinds */}
      <div className="lw-section">
        <h2 className="lw-section-title">Entity Kinds ({schema.entityKinds.length})</h2>
        {schema.entityKinds.length === 0 ? (
          <div className="lw-empty-state" style={{ height: 'auto', padding: '20px' }}>
            No entity kinds defined. Configure entity kinds in the Enumerist tab.
          </div>
        ) : (
          <div className="lw-item-list">
            {schema.entityKinds.map((ek) => (
              <span key={ek.kind || ek.id} className="lw-item-badge">
                {ek.name || ek.kind || ek.id}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Generators */}
      <div className="lw-section">
        <h2 className="lw-section-title">Generators ({generators.length})</h2>
        {generators.length === 0 ? (
          <div className="lw-empty-state" style={{ height: 'auto', padding: '20px' }}>
            No generators defined. Configure generators in the Coherence Engine tab.
          </div>
        ) : (
          <div className="lw-item-list">
            {generators.map((gen) => (
              <span key={gen.id} className="lw-item-badge">
                {gen.name || gen.id}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Pressures */}
      <div className="lw-section">
        <h2 className="lw-section-title">Pressures ({pressures.length})</h2>
        {pressures.length === 0 ? (
          <div className="lw-empty-state" style={{ height: 'auto', padding: '20px' }}>
            No pressures defined. Configure pressures in the Coherence Engine tab.
          </div>
        ) : (
          <div className="lw-item-list">
            {pressures.map((pressure) => (
              <span key={pressure.id} className="lw-item-badge">
                {pressure.name || pressure.id}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Run Button */}
      <button
        className={`lw-btn lw-btn-primary ${!validation.isValid ? 'disabled' : ''}`}
        onClick={onNavigateToRun}
        disabled={!validation.isValid}
      >
        Continue to Run
      </button>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="lw-stat-card">
      <div className="lw-stat-card-label">{label}</div>
      <div className={`lw-stat-card-value ${value === 0 ? 'zero' : ''}`}>
        {value}
      </div>
    </div>
  );
}

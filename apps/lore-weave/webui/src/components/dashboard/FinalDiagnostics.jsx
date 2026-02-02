/**
 * FinalDiagnostics - Tabbed view of simulation results
 */

import React, { useState } from 'react';

const ACCENT_COLOR = '#a78bfa'; // Keep for JS template bar calculations

export default function FinalDiagnostics({
  entityBreakdown,
  catalystStats,
  relationshipBreakdown,
  notableEntities
}) {
  const [activeTab, setActiveTab] = useState('entities');

  const hasDiagnostics = entityBreakdown || catalystStats || relationshipBreakdown || notableEntities;

  if (!hasDiagnostics) {
    return null;
  }

  return (
    <div className="lw-panel">
      <div className="lw-panel-header">
        <div className="lw-panel-title">
          <span>📋</span>
          Final Diagnostics
        </div>
      </div>

      {/* Tab navigation */}
      <div className="lw-filter-tabs">
        {['entities', 'relationships', 'agents', 'notable'].map(tab => (
          <button
            key={tab}
            className={`lw-filter-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div className="lw-panel-content">
        {activeTab === 'entities' && entityBreakdown && (
          <EntityBreakdownTab entityBreakdown={entityBreakdown} />
        )}
        {activeTab === 'relationships' && relationshipBreakdown && (
          <RelationshipBreakdownTab relationshipBreakdown={relationshipBreakdown} />
        )}
        {activeTab === 'agents' && catalystStats && (
          <AgentsTab catalystStats={catalystStats} />
        )}
        {activeTab === 'notable' && notableEntities && (
          <NotableEntitiesTab notableEntities={notableEntities} />
        )}
      </div>
    </div>
  );
}

function EntityBreakdownTab({ entityBreakdown }) {
  return (
    <div>
      <div style={{ marginBottom: '12px', fontSize: '13px', color: 'var(--lw-text-secondary)' }}>
        Total: {entityBreakdown.totalEntities} entities
      </div>
      <div className="lw-flex-col lw-gap-sm">
        {Object.entries(entityBreakdown.byKind).map(([kind, data]) => (
          <div key={kind} className="lw-metric-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontWeight: 600, color: 'var(--lw-text-primary)' }}>{kind}</span>
              <span style={{ color: ACCENT_COLOR }}>{data.total}</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {Object.entries(data.bySubtype).map(([subtype, count]) => (
                <span key={subtype} className="lw-badge" style={{ backgroundColor: 'var(--lw-bg-tertiary)', color: 'var(--lw-text-muted)' }}>
                  {subtype}: {count}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RelationshipBreakdownTab({ relationshipBreakdown }) {
  return (
    <div>
      <div style={{ marginBottom: '12px', fontSize: '13px', color: 'var(--lw-text-secondary)' }}>
        Total: {relationshipBreakdown.totalRelationships} relationships
      </div>
      <div className="lw-flex-col lw-gap-sm">
        {relationshipBreakdown.byKind.map((rel) => (
          <div key={rel.kind} className="lw-pressure-gauge">
            <span className="lw-pressure-name" style={{ width: '180px' }}>{rel.kind}</span>
            <div className="lw-pressure-bar">
              <div className="lw-pressure-fill" style={{ width: `${rel.percentage}%`, backgroundColor: ACCENT_COLOR }} />
            </div>
            <span className="lw-pressure-value">
              {rel.count} ({rel.percentage.toFixed(1)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AgentsTab({ catalystStats }) {
  const [showUnused, setShowUnused] = useState(false);
  const unusedCount = catalystStats.unusedActions?.length || 0;

  return (
    <div>
      <div className="lw-metric-grid">
        <div className="lw-metric-card">
          <div className="lw-metric-name">Total Agents</div>
          <div className="lw-metric-value">{catalystStats.totalAgents}</div>
        </div>
        <div className="lw-metric-card">
          <div className="lw-metric-name">Active Agents</div>
          <div className="lw-metric-value">{catalystStats.activeAgents}</div>
        </div>
        <div className="lw-metric-card">
          <div className="lw-metric-name">Total Actions</div>
          <div className="lw-metric-value">{catalystStats.totalActions}</div>
        </div>
        <div className="lw-metric-card">
          <div className="lw-metric-name">Unique Actors</div>
          <div className="lw-metric-value">{catalystStats.uniqueActors}</div>
        </div>
      </div>

      {catalystStats.topAgents.length > 0 && (
        <div style={{ marginTop: '16px' }}>
          <div style={{ fontSize: '12px', color: 'var(--lw-text-muted)', marginBottom: '8px' }}>
            Top Agents by Actions
          </div>
          <div className="lw-flex-col lw-gap-sm">
            {catalystStats.topAgents.map((agent, i) => (
              <div
                key={agent.id}
                className="lw-template-item"
                style={{ borderLeft: `3px solid ${i === 0 ? ACCENT_COLOR : 'var(--lw-border-color)'}` }}
              >
                <span className="lw-template-name" style={{ width: 'auto', flex: 1 }}>
                  {agent.name}
                  <span style={{ marginLeft: '8px', fontSize: '11px', color: 'var(--lw-text-muted)' }}>
                    ({agent.kind})
                  </span>
                </span>
                <span className="lw-template-count">{agent.actionCount}×</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {unusedCount > 0 && (
        <div style={{ marginTop: '16px' }}>
          <div
            className="lw-unused-header"
            onClick={() => setShowUnused(!showUnused)}
          >
            <span className="lw-unused-toggle">{showUnused ? '▼' : '▶'}</span>
            <span className="lw-unused-title">Unused Actions ({unusedCount})</span>
          </div>
          {showUnused && (
            <div className="lw-unused-list">
              {catalystStats.unusedActions.map(action => (
                <div key={action.actionId} className="lw-template-item" style={{ borderLeft: '3px solid var(--lw-text-muted)' }}>
                  <span className="lw-template-name" style={{ width: 'auto', flex: 1 }}>
                    {action.actionName}
                    <span style={{ marginLeft: '8px', fontSize: '11px', color: 'var(--lw-text-muted)' }}>
                      ({action.actionId})
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NotableEntitiesTab({ notableEntities }) {
  return (
    <div>
      {notableEntities.mythic.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '12px', color: '#fbbf24', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>⭐</span> Mythic ({notableEntities.mythic.length})
          </div>
          <div className="lw-flex-col lw-gap-sm">
            {notableEntities.mythic.map(e => (
              <div key={e.id} className="lw-template-item" style={{ borderLeft: '3px solid #fbbf24' }}>
                <span style={{ flex: 1, color: 'var(--lw-text-primary)' }}>{e.name}</span>
                <span style={{ fontSize: '11px', color: 'var(--lw-text-muted)' }}>
                  {e.kind}:{e.subtype}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {notableEntities.renowned.length > 0 && (
        <div>
          <div style={{ fontSize: '12px', color: '#a78bfa', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>★</span> Renowned ({notableEntities.renowned.length})
          </div>
          <div className="lw-flex-col lw-gap-sm">
            {notableEntities.renowned.slice(0, 10).map(e => (
              <div key={e.id} className="lw-template-item" style={{ borderLeft: '3px solid #a78bfa' }}>
                <span style={{ flex: 1, color: 'var(--lw-text-primary)' }}>{e.name}</span>
                <span style={{ fontSize: '11px', color: 'var(--lw-text-muted)' }}>
                  {e.kind}:{e.subtype}
                </span>
              </div>
            ))}
            {notableEntities.renowned.length > 10 && (
              <div style={{ fontSize: '12px', color: 'var(--lw-text-muted)', textAlign: 'center' }}>
                +{notableEntities.renowned.length - 10} more
              </div>
            )}
          </div>
        </div>
      )}

      {notableEntities.mythic.length === 0 && notableEntities.renowned.length === 0 && (
        <div className="lw-empty-state">
          <span className="lw-empty-icon">🌟</span>
          <span>No notable entities yet</span>
        </div>
      )}
    </div>
  );
}

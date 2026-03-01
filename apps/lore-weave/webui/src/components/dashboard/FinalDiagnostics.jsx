/**
 * FinalDiagnostics - Tabbed view of simulation results
 */

import React, { useState } from "react";
import PropTypes from "prop-types";
import "./FinalDiagnostics.css";

const ACCENT_COLOR = "#a78bfa"; // Keep for JS template bar calculations

export default function FinalDiagnostics({
  entityBreakdown,
  catalystStats,
  relationshipBreakdown,
  notableEntities,
}) {
  const [activeTab, setActiveTab] = useState("entities");

  const hasDiagnostics =
    entityBreakdown || catalystStats || relationshipBreakdown || notableEntities;

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
        {["entities", "relationships", "agents", "notable"].map((tab) => (
          <button
            key={tab}
            className={`lw-filter-tab ${activeTab === tab ? "active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div className="lw-panel-content">
        {activeTab === "entities" && entityBreakdown && (
          <EntityBreakdownTab entityBreakdown={entityBreakdown} />
        )}
        {activeTab === "relationships" && relationshipBreakdown && (
          <RelationshipBreakdownTab relationshipBreakdown={relationshipBreakdown} />
        )}
        {activeTab === "agents" && catalystStats && <AgentsTab catalystStats={catalystStats} />}
        {activeTab === "notable" && notableEntities && (
          <NotableEntitiesTab notableEntities={notableEntities} />
        )}
      </div>
    </div>
  );
}

function EntityBreakdownTab({ entityBreakdown }) {
  return (
    <div>
      <div className="fd-total-label">
        Total: {entityBreakdown.totalEntities} entities
      </div>
      <div className="lw-flex-col lw-gap-sm">
        {Object.entries(entityBreakdown.byKind).map(([kind, data]) => (
          <div key={kind} className="lw-metric-card">
            <div className="fd-kind-header">
              <span className="fd-kind-name">{kind}</span>
              <span className="fd-kind-count">{data.total}</span>
            </div>
            <div className="fd-subtype-list">
              {Object.entries(data.bySubtype).map(([subtype, count]) => (
                <span
                  key={subtype}
                  className="lw-badge fd-subtype-badge"
                >
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
      <div className="fd-total-label">
        Total: {relationshipBreakdown.totalRelationships} relationships
      </div>
      <div className="lw-flex-col lw-gap-sm">
        {relationshipBreakdown.byKind.map((rel) => (
          <div key={rel.kind} className="lw-pressure-gauge">
            <span className="lw-pressure-name fd-rel-name">
              {rel.kind}
            </span>
            <div className="lw-pressure-bar">
              <div
                className="lw-pressure-fill fd-rel-fill"
                style={{ '--fd-rel-fill-width': `${rel.percentage}%` }}
              />
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
        <div className="lw-section-spacer">
          <div className="lw-section-label">
            Top Agents by Actions
          </div>
          <div className="lw-flex-col lw-gap-sm">
            {catalystStats.topAgents.map((agent, i) => (
              <div
                key={agent.id}
                className="lw-template-item fd-agent-item"
                style={{
                  '--fd-agent-border-left': `3px solid ${i === 0 ? ACCENT_COLOR : "var(--lw-border-color)"}`,
                }}
              >
                <span className="lw-template-name fd-agent-name">
                  {agent.name}
                  <span className="fd-agent-kind">
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
        <div className="lw-section-spacer">
          <div className="lw-unused-header" onClick={() => setShowUnused(!showUnused)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }} >
            <span className="lw-unused-toggle">{showUnused ? "▼" : "▶"}</span>
            <span className="lw-unused-title">Unused Actions ({unusedCount})</span>
          </div>
          {showUnused && (
            <div className="lw-unused-list">
              {catalystStats.unusedActions.map((action) => (
                <div
                  key={action.actionId}
                  className="lw-template-item fd-unused-item"
                >
                  <span className="lw-template-name fd-unused-name">
                    {action.actionName}
                    <span className="fd-unused-kind">
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
        <div className="fd-mythic-section">
          <div className="fd-mythic-label">
            <span>⭐</span> Mythic ({notableEntities.mythic.length})
          </div>
          <div className="lw-flex-col lw-gap-sm">
            {notableEntities.mythic.map((e) => (
              <div
                key={e.id}
                className="lw-template-item fd-mythic-item"
              >
                <span className="fd-entity-name">{e.name}</span>
                <span className="fd-entity-type">
                  {e.kind}:{e.subtype}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {notableEntities.renowned.length > 0 && (
        <div>
          <div className="fd-renowned-label">
            <span>★</span> Renowned ({notableEntities.renowned.length})
          </div>
          <div className="lw-flex-col lw-gap-sm">
            {notableEntities.renowned.slice(0, 10).map((e) => (
              <div
                key={e.id}
                className="lw-template-item fd-renowned-item"
              >
                <span className="fd-entity-name">{e.name}</span>
                <span className="fd-entity-type">
                  {e.kind}:{e.subtype}
                </span>
              </div>
            ))}
            {notableEntities.renowned.length > 10 && (
              <div className="fd-more-label">
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

FinalDiagnostics.propTypes = {
  entityBreakdown: PropTypes.object,
  catalystStats: PropTypes.object,
  relationshipBreakdown: PropTypes.object,
  notableEntities: PropTypes.object,
};

EntityBreakdownTab.propTypes = {
  entityBreakdown: PropTypes.object,
};

RelationshipBreakdownTab.propTypes = {
  relationshipBreakdown: PropTypes.object,
};

AgentsTab.propTypes = {
  catalystStats: PropTypes.object,
};

NotableEntitiesTab.propTypes = {
  notableEntities: PropTypes.object,
};

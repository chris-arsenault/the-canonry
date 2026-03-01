/**
 * RelationshipKindEditor - Edit relationship kinds
 */

import React, { useMemo, useState, useCallback } from "react";
import PropTypes from "prop-types";
import {
  ExpandableCard,
  FormGroup,
  SectionHeader,
  EmptyState,
} from "@the-canonry/shared-components";
import {
  ToolUsageBadges as UsageBadges,
  getRelationshipKindUsageSummary,
} from "@the-canonry/shared-components";
import "./schema-editor-shared.css";
import "./RelationshipKindEditor.css";

export default function RelationshipKindEditor({
  relationshipKinds,
  entityKinds,
  onChange,
  schemaUsage = {},
}) {
  const [expandedRels, setExpandedRels] = useState({});

  const getStableKey = (rel) => rel._key || rel.kind;

  const toggleRel = useCallback((stableKey) => {
    setExpandedRels((prev) => ({ ...prev, [stableKey]: !prev[stableKey] }));
  }, []);

  const addRelationship = () => {
    const stableKey = `rel_${Date.now()}`;
    const newRel = {
      kind: stableKey,
      description: "New Relationship",
      srcKinds: [],
      dstKinds: [],
      cullable: true,
      decayRate: "medium",
      polarity: "neutral",
      _key: stableKey,
    };
    onChange([...relationshipKinds, newRel]);
    setExpandedRels((prev) => ({ ...prev, [stableKey]: true }));
  };

  const updateRel = (relKind, updates) => {
    const existing = relationshipKinds.find((r) => r.kind === relKind);
    if (existing?.isFramework) return;
    onChange(relationshipKinds.map((r) => (r.kind === relKind ? { ...r, ...updates } : r)));
  };

  const deleteRel = (relKind) => {
    const existing = relationshipKinds.find((r) => r.kind === relKind);
    if (existing?.isFramework) return;
    if (confirm("Delete this relationship kind?")) {
      onChange(relationshipKinds.filter((r) => r.kind !== relKind));
    }
  };

  const toggleEntityKind = (relKind, field, entityKindId) => {
    const rel = relationshipKinds.find((r) => r.kind === relKind);
    if (!rel || rel.isFramework) return;
    const current = rel[field] || [];
    const updated = current.includes(entityKindId)
      ? current.filter((k) => k !== entityKindId)
      : [...current, entityKindId];
    updateRel(relKind, { [field]: updated });
  };

  const getSummary = (rel) => {
    const srcNames =
      rel.srcKinds?.length > 0
        ? rel.srcKinds
            .map((k) => entityKinds.find((ek) => ek.kind === k)?.description || k)
            .slice(0, 2)
        : ["Any"];
    const dstNames =
      rel.dstKinds?.length > 0
        ? rel.dstKinds
            .map((k) => entityKinds.find((ek) => ek.kind === k)?.description || k)
            .slice(0, 2)
        : ["Any"];
    return { srcNames, dstNames };
  };

  const renderHeaderActions = () => (
    <button className="btn btn-primary" onClick={addRelationship}>
      + Add Relationship
    </button>
  );

  const renderRelationshipActions = (rel, srcNames, dstNames, isFramework) => (
    <>
      <UsageBadges usage={getRelationshipKindUsageSummary(schemaUsage, rel.kind)} compact />
      {isFramework && <span className="badge badge-info">framework</span>}
      {rel.cullable === false && <span className="badge badge-info">protected</span>}
      <div className="text-muted text-small rke-actions-flow">
        {srcNames.map((name, i) => (
          <span key={i} className="badge">
            {name}
          </span>
        ))}
        {rel.srcKinds?.length > 2 && <span>+{rel.srcKinds.length - 2}</span>}
        <span>→</span>
        {dstNames.map((name, i) => (
          <span key={i} className="badge">
            {name}
          </span>
        ))}
        {rel.dstKinds?.length > 2 && <span>+{rel.dstKinds.length - 2}</span>}
      </div>
    </>
  );

  return (
    <div className="editor-container rke-container">
      <SectionHeader
        title="Relationship Kinds"
        description="Define how entities can be connected to each other."
        count={relationshipKinds.length}
        actions={renderHeaderActions()}
      />

      {relationshipKinds.length === 0 ? (
        <EmptyState
          icon="🔗"
          title="No relationship kinds defined"
          description="Add one to connect entities."
        />
      ) : (
        <div className="list-stack">
          {relationshipKinds.map((rel) => {
            const stableKey = getStableKey(rel);
            const isExpanded = expandedRels[stableKey];
            const { srcNames, dstNames } = getSummary(rel);
            const isFramework = Boolean(rel.isFramework);

            return (
              <ExpandableCard
                key={stableKey}
                expanded={isExpanded}
                onToggle={toggleRel}
                toggleId={stableKey}
                title={rel.description}
                subtitle={rel.kind}
                actions={renderRelationshipActions(rel, srcNames, dstNames, isFramework)}
              >
                {/* Display Name and Kind ID */}
                <div className="rke-name-row">
                  <FormGroup label="Display Name">
                    <input
                      className="input"
                      value={rel.description}
                      disabled={isFramework}
                      onChange={(e) => updateRel(rel.kind, { description: e.target.value })}
                      placeholder="Relationship display name"
                    />
                  </FormGroup>
                  <FormGroup label="Kind ID">
                    <input
                      className="input"
                      value={rel.kind}
                      disabled={isFramework}
                      onChange={(e) => {
                        const newKind = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "");
                        if (
                          newKind &&
                          !relationshipKinds.some((r) => r.kind === newKind && r.kind !== rel.kind)
                        ) {
                          updateRel(rel.kind, { kind: newKind });
                        }
                      }}
                      placeholder="relationship_kind_id"
                    />
                  </FormGroup>
                </div>

                {/* Entity Kind Constraints */}
                <div className="nested-section-compact">
                  <div className="label rke-constraint-label">
                    Entity Kind Constraints
                  </div>
                  {entityKinds.length === 0 ? (
                    <div className="text-muted text-small">
                      Define entity kinds first to set constraints.
                    </div>
                  ) : (
                    <div className="rke-constraint-row">
                      <div className="rke-constraint-col">
                        <div className="rke-constraint-header">
                          <span className="text-small text-muted">Source</span>
                          {rel.srcKinds?.length === 0 && (
                            <span className="text-muted text-small">any</span>
                          )}
                        </div>
                        <div className="chip-list rke-chip-list-flush">
                          {entityKinds.map((ek) => (
                            <div
                              key={ek.kind}
                              className={`chip chip-clickable ${rel.srcKinds?.includes(ek.kind) ? "chip-active" : ""} ${isFramework ? "se-chip-framework" : ""}`}
                              onClick={() => toggleEntityKind(rel.kind, "srcKinds", ek.kind)}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }}
                            >
                              {ek.description}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="text-dim rke-arrow">
                        →
                      </div>
                      <div className="rke-constraint-col">
                        <div className="rke-constraint-header">
                          <span className="text-small text-muted">Destination</span>
                          {rel.dstKinds?.length === 0 && (
                            <span className="text-muted text-small">any</span>
                          )}
                        </div>
                        <div className="chip-list rke-chip-list-flush">
                          {entityKinds.map((ek) => (
                            <div
                              key={ek.kind}
                              className={`chip chip-clickable ${rel.dstKinds?.includes(ek.kind) ? "chip-active" : ""} ${isFramework ? "se-chip-framework" : ""}`}
                              onClick={() => toggleEntityKind(rel.kind, "dstKinds", ek.kind)}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }}
                            >
                              {ek.description}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Maintenance Settings */}
                <div className="nested-section-compact">
                  <div className="label rke-maintenance-label">
                    Maintenance Settings
                  </div>
                  <div className="rke-maintenance-row">
                    <div className="rke-maintenance-field">
                      <span className="text-small text-muted">Decay</span>
                      <select
                        className="input se-select-compact"
                        value={rel.decayRate || "medium"}
                        disabled={isFramework}
                        onChange={(e) => updateRel(rel.kind, { decayRate: e.target.value })}
                      >
                        <option value="none">None</option>
                        <option value="slow">Slow</option>
                        <option value="medium">Medium</option>
                        <option value="fast">Fast</option>
                      </select>
                    </div>
                    <div className="rke-maintenance-field">
                      <span className="text-small text-muted">Polarity</span>
                      <select
                        className="input se-select-compact"
                        value={rel.polarity || "neutral"}
                        disabled={isFramework}
                        onChange={(e) => updateRel(rel.kind, { polarity: e.target.value })}
                        title="Affects narrative event types"
                      >
                        <option value="positive">Positive</option>
                        <option value="neutral">Neutral</option>
                        <option value="negative">Negative</option>
                      </select>
                    </div>
                    <label className="rke-cullable-label">
                      <input
                        type="checkbox"
                        checked={rel.cullable !== false}
                        disabled={isFramework}
                        onChange={(e) => updateRel(rel.kind, { cullable: e.target.checked })}
                        className="se-checkbox-sm"
                      />
                      <span className="text-small">Cullable</span>
                    </label>
                  </div>
                </div>

                {/* Narrative Verbs */}
                <div className="nested-section-compact">
                  <div className="label rke-verbs-label">
                    Narrative Verbs
                  </div>
                  <div className="text-muted text-small rke-verbs-hint">
                    Verbs used in narrative event descriptions when this relationship is formed or
                    ended.
                  </div>
                  <div className="rke-verbs-row">
                    <FormGroup label="Formed" className="rke-verb-form">
                      <input
                        className="input"
                        value={rel.verbs?.formed || ""}
                        disabled={isFramework}
                        onChange={(e) =>
                          updateRel(rel.kind, {
                            verbs: { ...rel.verbs, formed: e.target.value },
                          })
                        }
                        placeholder="e.g., joined, allied with"
                      />
                    </FormGroup>
                    <FormGroup label="Ended" className="rke-verb-form">
                      <input
                        className="input"
                        value={rel.verbs?.ended || ""}
                        disabled={isFramework}
                        onChange={(e) =>
                          updateRel(rel.kind, {
                            verbs: { ...rel.verbs, ended: e.target.value },
                          })
                        }
                        placeholder="e.g., left, broke ties with"
                      />
                    </FormGroup>
                  </div>
                </div>

                {/* Delete */}
                <div className="danger-zone">
                  <button
                    className="btn btn-danger"
                    onClick={() => deleteRel(rel.kind)}
                    disabled={isFramework}
                  >
                    Delete Relationship
                  </button>
                </div>
              </ExpandableCard>
            );
          })}
        </div>
      )}
    </div>
  );
}

RelationshipKindEditor.propTypes = {
  relationshipKinds: PropTypes.array.isRequired,
  entityKinds: PropTypes.array.isRequired,
  onChange: PropTypes.func.isRequired,
  schemaUsage: PropTypes.object,
};

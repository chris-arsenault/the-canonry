/**
 * RelationshipKindEditor - Edit relationship kinds
 */

import React, { useMemo, useState } from 'react';
import { ExpandableCard, FormGroup, SectionHeader, EmptyState } from '@penguin-tales/shared-components';
import { ToolUsageBadges as UsageBadges, getRelationshipKindUsageSummary } from '@penguin-tales/shared-components';

export default function RelationshipKindEditor({
  relationshipKinds,
  entityKinds,
  onChange,
  schemaUsage = {},
}) {
  const [expandedRels, setExpandedRels] = useState({});

  const getStableKey = (rel) => rel._key || rel.kind;

  const toggleRel = (stableKey) => {
    setExpandedRels((prev) => ({ ...prev, [stableKey]: !prev[stableKey] }));
  };

  const addRelationship = () => {
    const stableKey = `rel_${Date.now()}`;
    const newRel = {
      kind: stableKey,
      description: 'New Relationship',
      srcKinds: [],
      dstKinds: [],
      cullable: true,
      decayRate: 'medium',
      polarity: 'neutral',
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
    if (confirm('Delete this relationship kind?')) {
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
    const srcNames = rel.srcKinds?.length > 0
      ? rel.srcKinds.map((k) => entityKinds.find((ek) => ek.kind === k)?.description || k).slice(0, 2)
      : ['Any'];
    const dstNames = rel.dstKinds?.length > 0
      ? rel.dstKinds.map((k) => entityKinds.find((ek) => ek.kind === k)?.description || k).slice(0, 2)
      : ['Any'];
    return { srcNames, dstNames };
  };

  const flexFormStyle = useMemo(() => ({ flex: 1 }), []);

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
      <div className="text-muted text-small" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {srcNames.map((name, i) => (
          <span key={i} className="badge">{name}</span>
        ))}
        {rel.srcKinds?.length > 2 && <span>+{rel.srcKinds.length - 2}</span>}
        <span>→</span>
        {dstNames.map((name, i) => (
          <span key={i} className="badge">{name}</span>
        ))}
        {rel.dstKinds?.length > 2 && <span>+{rel.dstKinds.length - 2}</span>}
      </div>
    </>
  );

  return (
    <div className="editor-container" style={{ maxWidth: '900px' }}>
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
                onToggle={() => toggleRel(stableKey)}
                title={rel.description}
                subtitle={rel.kind}
                actions={renderRelationshipActions(rel, srcNames, dstNames, isFramework)}
              >
                {/* Display Name and Kind ID */}
                <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
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
                        const newKind = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
                        if (newKind && !relationshipKinds.some((r) => r.kind === newKind && r.kind !== rel.kind)) {
                          updateRel(rel.kind, { kind: newKind });
                        }
                      }}
                      placeholder="relationship_kind_id"
                    />
                  </FormGroup>
                </div>

                {/* Entity Kind Constraints */}
                <div className="nested-section-compact">
                  <div className="label" style={{ marginBottom: '8px' }}>Entity Kind Constraints</div>
                  {entityKinds.length === 0 ? (
                    <div className="text-muted text-small">Define entity kinds first to set constraints.</div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span className="text-small text-muted">Source</span>
                          {rel.srcKinds?.length === 0 && <span className="text-muted text-small">any</span>}
                        </div>
                        <div className="chip-list" style={{ marginBottom: 0 }}>
                          {entityKinds.map((ek) => (
                            <div
                              key={ek.kind}
                              className={`chip chip-clickable ${rel.srcKinds?.includes(ek.kind) ? 'chip-active' : ''}`}
                              onClick={() => toggleEntityKind(rel.kind, 'srcKinds', ek.kind)}
                              style={isFramework ? { pointerEvents: 'none', opacity: 0.6 } : undefined}
                            >
                              {ek.description}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="text-dim" style={{ fontSize: '16px' }}>→</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span className="text-small text-muted">Destination</span>
                          {rel.dstKinds?.length === 0 && <span className="text-muted text-small">any</span>}
                        </div>
                        <div className="chip-list" style={{ marginBottom: 0 }}>
                          {entityKinds.map((ek) => (
                            <div
                              key={ek.kind}
                              className={`chip chip-clickable ${rel.dstKinds?.includes(ek.kind) ? 'chip-active' : ''}`}
                              onClick={() => toggleEntityKind(rel.kind, 'dstKinds', ek.kind)}
                              style={isFramework ? { pointerEvents: 'none', opacity: 0.6 } : undefined}
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
                  <div className="label" style={{ marginBottom: '8px' }}>Maintenance Settings</div>
                  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="text-small text-muted">Decay</span>
                      <select
                        className="input"
                        style={{ width: 'auto', padding: '6px 10px' }}
                        value={rel.decayRate || 'medium'}
                        disabled={isFramework}
                        onChange={(e) => updateRel(rel.kind, { decayRate: e.target.value })}
                      >
                        <option value="none">None</option>
                        <option value="slow">Slow</option>
                        <option value="medium">Medium</option>
                        <option value="fast">Fast</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="text-small text-muted">Polarity</span>
                      <select
                        className="input"
                        style={{ width: 'auto', padding: '6px 10px' }}
                        value={rel.polarity || 'neutral'}
                        disabled={isFramework}
                        onChange={(e) => updateRel(rel.kind, { polarity: e.target.value })}
                        title="Affects narrative event types"
                      >
                        <option value="positive">Positive</option>
                        <option value="neutral">Neutral</option>
                        <option value="negative">Negative</option>
                      </select>
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={rel.cullable !== false}
                        disabled={isFramework}
                        onChange={(e) => updateRel(rel.kind, { cullable: e.target.checked })}
                        style={{ width: '14px', height: '14px' }}
                      />
                      <span className="text-small">Cullable</span>
                    </label>
                  </div>
                </div>

                {/* Narrative Verbs */}
                <div className="nested-section-compact">
                  <div className="label" style={{ marginBottom: '8px' }}>Narrative Verbs</div>
                  <div className="text-muted text-small" style={{ marginBottom: '8px' }}>
                    Verbs used in narrative event descriptions when this relationship is formed or ended.
                  </div>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <FormGroup label="Formed" style={flexFormStyle}>
                      <input
                        className="input"
                        value={rel.verbs?.formed || ''}
                        disabled={isFramework}
                        onChange={(e) => updateRel(rel.kind, {
                          verbs: { ...rel.verbs, formed: e.target.value }
                        })}
                        placeholder="e.g., joined, allied with"
                      />
                    </FormGroup>
                    <FormGroup label="Ended" style={flexFormStyle}>
                      <input
                        className="input"
                        value={rel.verbs?.ended || ''}
                        disabled={isFramework}
                        onChange={(e) => updateRel(rel.kind, {
                          verbs: { ...rel.verbs, ended: e.target.value }
                        })}
                        placeholder="e.g., left, broke ties with"
                      />
                    </FormGroup>
                  </div>
                </div>

                {/* Delete */}
                <div className="danger-zone">
                  <button className="btn btn-danger" onClick={() => deleteRel(rel.kind)} disabled={isFramework}>
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

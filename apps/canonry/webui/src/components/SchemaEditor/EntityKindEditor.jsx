/**
 * EntityKindEditor - Edit entity kinds (id, name, subtypes, statuses)
 *
 * This is the authoritative place to define entity kinds.
 * Semantic planes are edited in Cosmographer.
 */

import React, { useState, useMemo } from 'react';
import { ExpandableCard, FormGroup, FormRow, SectionHeader, EmptyState, AddItemButton } from '@penguin-tales/shared-components';
import { ToolUsageBadges as UsageBadges, getEntityKindUsageSummary } from '@penguin-tales/shared-components';
import { ENTITY_CATEGORIES } from '@canonry/world-schema';

/**
 * Compute naming profile usage for each entity kind
 */
function computeNamingProfileUsage(namingData) {
  const usage = {};

  Object.entries(namingData || {}).forEach(([cultureId, cultureConfig]) => {
    const profiles = cultureConfig?.profiles || [];

    profiles.forEach((profile) => {
      const groups = profile.strategyGroups || [];

      groups.forEach((group) => {
        const cond = group.conditions || {};
        const entityKinds = cond.entityKinds || [];

        if (entityKinds.length === 0) {
          if (!usage['*']) usage['*'] = { profiles: [] };
          usage['*'].profiles.push({
            cultureId,
            profileId: profile.id,
            groupName: group.name || 'Default',
          });
        } else {
          entityKinds.forEach((kind) => {
            if (!usage[kind]) usage[kind] = { profiles: [] };
            usage[kind].profiles.push({
              cultureId,
              profileId: profile.id,
              groupName: group.name,
            });
          });
        }
      });
    });
  });

  return usage;
}

const DEFAULT_KIND_COLORS = [
  '#6FB1FC',
  '#FC6B6B',
  '#6BFC9C',
  '#FCA86B',
  '#C76BFC',
  '#FCD76B',
  '#60A5FA',
  '#A78BFA',
];

const DEFAULT_KIND_COLOR_MAP = {
  npc: '#6FB1FC',
  faction: '#FC6B6B',
  location: '#6BFC9C',
  rule: '#FCA86B',
  ability: '#C76BFC',
  occurrence: '#FCD76B',
  era: '#FFD700',
};

function getDefaultKindColor(kind, index) {
  return DEFAULT_KIND_COLOR_MAP[kind] || DEFAULT_KIND_COLORS[index % DEFAULT_KIND_COLORS.length];
}

function generateId(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

/**
 * Get usage info for a specific subtype
 */
function getSubtypeUsage(schemaUsage, entityKind, subtypeId) {
  const subtypeUsage = schemaUsage?.subtypes?.[entityKind]?.[subtypeId];
  if (!subtypeUsage) {
    return { generators: 0, systems: 0, seeds: 0, total: 0 };
  }
  const generators = subtypeUsage.generators?.length || 0;
  const systems = subtypeUsage.systems?.length || 0;
  const seeds = subtypeUsage.seeds?.length || 0;
  return { generators, systems, seeds, total: generators + systems + seeds };
}

export default function EntityKindEditor({ entityKinds, onChange, schemaUsage = {}, namingData = {} }) {
  const [expandedKinds, setExpandedKinds] = useState({});
  const [newSubtype, setNewSubtype] = useState({});
  const [newStatus, setNewStatus] = useState({});

  const namingProfileUsage = useMemo(
    () => computeNamingProfileUsage(namingData),
    [namingData]
  );

  const getNamingProfileCount = (kind) => {
    const specific = namingProfileUsage[kind]?.profiles?.length || 0;
    const wildcard = namingProfileUsage['*']?.profiles?.length || 0;
    return specific + wildcard;
  };

  const getStableKey = (ek) => ek._key || ek.kind;

  const toggleKind = (stableKey) => {
    setExpandedKinds((prev) => ({ ...prev, [stableKey]: !prev[stableKey] }));
  };

  const addEntityKind = () => {
    const stableKey = `kind_${Date.now()}`;
    const newKind = {
      kind: stableKey,
      description: 'New Entity Kind',
      subtypes: [],
      statuses: [{ id: 'active', name: 'Active', isTerminal: false }],
      defaultStatus: 'active',
      style: { color: getDefaultKindColor(stableKey, entityKinds.length) },
      _key: stableKey,
    };
    onChange([...entityKinds, newKind]);
    setExpandedKinds((prev) => ({ ...prev, [stableKey]: true }));
  };

  const updateKind = (kindKey, updates) => {
    const existing = entityKinds.find((k) => k.kind === kindKey);
    if (existing?.isFramework) return;
    onChange(entityKinds.map((k) => (k.kind === kindKey ? { ...k, ...updates } : k)));
  };

  const updateKindStyle = (kindKey, updates) => {
    const kind = entityKinds.find((k) => k.kind === kindKey);
    if (!kind) return;
    updateKind(kindKey, { style: { ...(kind.style || {}), ...updates } });
  };

  const deleteKind = (kindKey) => {
    const kind = entityKinds.find((k) => k.kind === kindKey);
    if (kind?.isFramework) return;
    if (confirm('Delete this entity kind? This cannot be undone.')) {
      onChange(entityKinds.filter((k) => k.kind !== kindKey));
    }
  };

  const addSubtype = (kindKey) => {
    if (entityKinds.find((k) => k.kind === kindKey)?.isFramework) return;
    const name = newSubtype[kindKey]?.trim();
    if (!name) return;
    const ek = entityKinds.find((k) => k.kind === kindKey);
    if (!ek) return;
    const subtype = { id: generateId(name), name };
    updateKind(kindKey, { subtypes: [...ek.subtypes, subtype] });
    setNewSubtype((prev) => ({ ...prev, [kindKey]: '' }));
  };

  const removeSubtype = (kindKey, subtypeId) => {
    if (entityKinds.find((k) => k.kind === kindKey)?.isFramework) return;
    const ek = entityKinds.find((k) => k.kind === kindKey);
    if (!ek) return;
    updateKind(kindKey, { subtypes: ek.subtypes.filter((s) => s.id !== subtypeId) });
  };

  const addStatus = (kindKey) => {
    if (entityKinds.find((k) => k.kind === kindKey)?.isFramework) return;
    const name = newStatus[kindKey]?.trim();
    if (!name) return;
    const ek = entityKinds.find((k) => k.kind === kindKey);
    if (!ek) return;
    const status = { id: generateId(name), name, isTerminal: false, polarity: 'neutral' };
    updateKind(kindKey, { statuses: [...ek.statuses, status] });
    setNewStatus((prev) => ({ ...prev, [kindKey]: '' }));
  };

  const removeStatus = (kindKey, statusId) => {
    if (entityKinds.find((k) => k.kind === kindKey)?.isFramework) return;
    const ek = entityKinds.find((k) => k.kind === kindKey);
    if (!ek) return;
    updateKind(kindKey, { statuses: ek.statuses.filter((s) => s.id !== statusId) });
  };

  const toggleStatusTerminal = (kindKey, statusId) => {
    if (entityKinds.find((k) => k.kind === kindKey)?.isFramework) return;
    const ek = entityKinds.find((k) => k.kind === kindKey);
    if (!ek) return;
    updateKind(kindKey, {
      statuses: ek.statuses.map((s) =>
        s.id === statusId ? { ...s, isTerminal: !s.isTerminal } : s
      ),
    });
  };

  const updateStatusPolarity = (kindKey, statusId, polarity) => {
    if (entityKinds.find((k) => k.kind === kindKey)?.isFramework) return;
    const ek = entityKinds.find((k) => k.kind === kindKey);
    if (!ek) return;
    updateKind(kindKey, {
      statuses: ek.statuses.map((s) =>
        s.id === statusId ? { ...s, polarity } : s
      ),
    });
  };

  const updateStatusTransitionVerb = (kindKey, statusId, transitionVerb) => {
    if (entityKinds.find((k) => k.kind === kindKey)?.isFramework) return;
    const ek = entityKinds.find((k) => k.kind === kindKey);
    if (!ek) return;
    updateKind(kindKey, {
      statuses: ek.statuses.map((s) =>
        s.id === statusId ? { ...s, transitionVerb: transitionVerb || undefined } : s
      ),
    });
  };

  const toggleSubtypeAuthority = (kindKey, subtypeId) => {
    if (entityKinds.find((k) => k.kind === kindKey)?.isFramework) return;
    const ek = entityKinds.find((k) => k.kind === kindKey);
    if (!ek) return;
    updateKind(kindKey, {
      subtypes: ek.subtypes.map((s) =>
        s.id === subtypeId ? { ...s, isAuthority: !s.isAuthority } : s
      ),
    });
  };

  const renderHeaderActions = () => (
    <button className="btn btn-primary" onClick={addEntityKind}>
      + Add Entity Kind
    </button>
  );

  const renderKindActions = (kind, profileCount, isFramework) => (
    <>
      <UsageBadges usage={getEntityKindUsageSummary(schemaUsage, kind.kind)} compact />
      {isFramework && <span className="badge badge-info">framework</span>}
      {profileCount > 0 && (
        <span
          className="badge badge-warning"
          title={`Used in ${profileCount} naming profile group${profileCount !== 1 ? 's' : ''}`}
        >
          ✎ {profileCount}
        </span>
      )}
      <span className="text-muted text-small">
        {kind.subtypes.length} subtypes, {kind.statuses.length} statuses
      </span>
    </>
  );

  return (
    <div className="editor-container" style={{ maxWidth: '900px' }}>
      <SectionHeader
        title="Entity Kinds"
        description="Define the types of entities that exist in your world."
        count={entityKinds.length}
        actions={renderHeaderActions()}
      />

      {entityKinds.length === 0 ? (
        <EmptyState
          icon="📦"
          title="No entity kinds defined"
          description="Add one to get started."
        />
      ) : (
        <div className="list-stack">
          {entityKinds.map((ek, index) => {
            const stableKey = getStableKey(ek);
            const isExpanded = expandedKinds[stableKey];
            const profileCount = getNamingProfileCount(ek.kind);
            const kindColor = ek.style?.color;
            const isFramework = Boolean(ek.isFramework);

            return (
              <ExpandableCard
                key={stableKey}
                expanded={isExpanded}
                onToggle={() => toggleKind(stableKey)}
                title={ek.description}
                subtitle={ek.kind}
                actions={renderKindActions(ek, profileCount, isFramework)}
              >
                {/* Display Name and Kind ID */}
                <FormRow>
                  <FormGroup label="Display Name">
                    <input
                      className="input"
                      value={ek.description}
                      disabled={isFramework}
                      onChange={(e) => updateKind(ek.kind, { description: e.target.value })}
                      placeholder="Entity kind display name"
                    />
                  </FormGroup>
                  <FormGroup label="Kind ID">
                    <input
                      className="input"
                      value={ek.kind}
                      disabled={isFramework}
                      onChange={(e) => {
                        const newKind = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
                        if (newKind && !entityKinds.some((k) => k.kind === newKind && k.kind !== ek.kind)) {
                          updateKind(ek.kind, { kind: newKind });
                        }
                      }}
                      placeholder="entity_kind_id"
                    />
                  </FormGroup>
                  <FormGroup label="Color">
                    <input
                      className="input"
                      type="color"
                      value={kindColor ?? '#000000'}
                      disabled={isFramework}
                      onChange={(e) => updateKindStyle(ek.kind, { color: e.target.value })}
                    />
                    {!kindColor && (
                      <div style={{ fontSize: '11px', color: '#fca5a5', marginTop: '4px' }}>
                        Color required
                      </div>
                    )}
                  </FormGroup>
                  <FormGroup label="Category" tooltip="Abstract category for narrative style recommendations">
                    <select
                      className="input"
                      value={ek.category || ''}
                      disabled={isFramework}
                      onChange={(e) => updateKind(ek.kind, { category: e.target.value || undefined })}
                    >
                      <option value="">-- Not set --</option>
                      {Object.entries(ENTITY_CATEGORIES).map(([categoryId, categoryInfo]) => (
                        <option key={categoryId} value={categoryId}>
                          {categoryInfo.name}
                        </option>
                      ))}
                    </select>
                  </FormGroup>
                </FormRow>

                {/* Subtypes */}
                <div className="section">
                  <div className="section-title">Subtypes</div>
                  <div className="chip-list">
                    {ek.subtypes.map((subtype) => {
                      const usage = getSubtypeUsage(schemaUsage, ek.kind, subtype.id);
                      const isUnused = usage.total === 0;
                      const tooltipParts = [];
                      if (usage.generators > 0) tooltipParts.push(`${usage.generators} generator${usage.generators !== 1 ? 's' : ''}`);
                      if (usage.systems > 0) tooltipParts.push(`${usage.systems} system${usage.systems !== 1 ? 's' : ''}`);
                      if (usage.seeds > 0) tooltipParts.push(`${usage.seeds} seed${usage.seeds !== 1 ? 's' : ''}`);
                      const tooltip = tooltipParts.length > 0 ? tooltipParts.join(', ') : 'Not used by any generator, system, or seed';

                      return (
                        <div
                          key={subtype.id}
                          className={`chip ${isUnused ? 'chip-unused' : ''}`}
                          title={tooltip}
                        >
                          <input
                            type="checkbox"
                            checked={subtype.isAuthority || false}
                            disabled={isFramework}
                            onChange={() => toggleSubtypeAuthority(ek.kind, subtype.id)}
                            title="Authority subtype (for leadership/succession events)"
                          />
                          <span className="chip-content">
                            {subtype.name}
                            {subtype.isAuthority && <span className="badge badge-warning" style={{ marginLeft: '4px', fontSize: '9px' }}>👑</span>}
                            {usage.total > 0 && (
                              <span className="chip-usage-indicators">
                                {usage.generators > 0 && <span className="usage-dot generator" title={`${usage.generators} generator${usage.generators !== 1 ? 's' : ''}`}>G</span>}
                                {usage.systems > 0 && <span className="usage-dot system" title={`${usage.systems} system${usage.systems !== 1 ? 's' : ''}`}>S</span>}
                                {usage.seeds > 0 && <span className="usage-dot seed" title={`${usage.seeds} seed${usage.seeds !== 1 ? 's' : ''}`}>E</span>}
                              </span>
                            )}
                            {isUnused && <span className="usage-dot unused" title="Unused">∅</span>}
                          </span>
                          <button
                            className="chip-remove"
                            onClick={() => removeSubtype(ek.kind, subtype.id)}
                            disabled={isFramework}
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <div className="chip-input-row">
                    <input
                      className="input input-sm"
                      value={newSubtype[ek.kind] || ''}
                      disabled={isFramework}
                      onChange={(e) => setNewSubtype((prev) => ({ ...prev, [ek.kind]: e.target.value }))}
                      placeholder="New subtype name"
                      onKeyDown={(e) => e.key === 'Enter' && addSubtype(ek.kind)}
                    />
                    <button className="btn btn-secondary" onClick={() => addSubtype(ek.kind)} disabled={isFramework}>
                      Add
                    </button>
                  </div>
                </div>

                {/* Statuses */}
                <div className="section">
                  <div className="section-title">Statuses</div>
                  <div className="chip-list" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                    {ek.statuses.map((status) => (
                      <div key={status.id} className="chip" style={{ flexDirection: 'column', alignItems: 'stretch', padding: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <input
                            type="checkbox"
                            checked={status.isTerminal}
                            disabled={isFramework}
                            onChange={() => toggleStatusTerminal(ek.kind, status.id)}
                            title="Terminal status"
                          />
                          <span style={{
                            textDecoration: status.isTerminal ? 'line-through' : 'none',
                            opacity: status.isTerminal ? 0.7 : 1,
                            flex: 1,
                          }}>
                            {status.name}
                          </span>
                          <select
                            className="input input-micro"
                            value={status.polarity || 'neutral'}
                            disabled={isFramework}
                            onChange={(e) => updateStatusPolarity(ek.kind, status.id, e.target.value)}
                            title="Status polarity (for narrative events)"
                            style={{ padding: '2px 4px', fontSize: '10px', width: '50px' }}
                          >
                            <option value="positive">+</option>
                            <option value="neutral">○</option>
                            <option value="negative">−</option>
                          </select>
                          <button
                            className="chip-remove"
                            onClick={() => removeStatus(ek.kind, status.id)}
                            disabled={isFramework}
                          >
                            ×
                          </button>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                          <span className="text-muted text-small" style={{ width: '40px' }}>Verb:</span>
                          <input
                            className="input input-sm"
                            value={status.transitionVerb || ''}
                            disabled={isFramework}
                            onChange={(e) => updateStatusTransitionVerb(ek.kind, status.id, e.target.value)}
                            placeholder="e.g., was destroyed"
                            title="Verb used in narrative events for this status transition"
                            style={{ flex: 1, fontSize: '11px', padding: '2px 6px' }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="chip-input-row">
                    <input
                      className="input input-sm"
                      value={newStatus[ek.kind] || ''}
                      disabled={isFramework}
                      onChange={(e) => setNewStatus((prev) => ({ ...prev, [ek.kind]: e.target.value }))}
                      placeholder="New status name"
                      onKeyDown={(e) => e.key === 'Enter' && addStatus(ek.kind)}
                    />
                    <button className="btn btn-secondary" onClick={() => addStatus(ek.kind)} disabled={isFramework}>
                      Add
                    </button>
                  </div>
                  <div className="hint">☑ = terminal (entity ends), + = positive, ○ = neutral, − = negative polarity. Verb is used in narrative event descriptions.</div>
                </div>

                {/* Default Status */}
                <FormRow>
                  <FormGroup label="Default Status">
                    <select
                      className="input"
                      value={ek.defaultStatus || ''}
                      disabled={isFramework}
                      onChange={(e) => updateKind(ek.kind, { defaultStatus: e.target.value })}
                    >
                      <option value="">-- Select --</option>
                      {ek.statuses.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </FormGroup>
                </FormRow>

                {/* Delete */}
                <div className="danger-zone">
                  <button className="btn btn-danger" onClick={() => deleteKind(ek.kind)} disabled={isFramework}>
                    Delete Entity Kind
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

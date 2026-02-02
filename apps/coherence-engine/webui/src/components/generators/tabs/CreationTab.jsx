/**
 * CreationTab - Visual entity creation cards
 */

import React, { useState, useMemo, useCallback } from 'react';
import TagSelector from '@penguin-tales/shared-components/TagSelector';
import { ReferenceDropdown, LevelSelector, PROMINENCE_LEVELS, ChipSelect, NumberInput, LocalTextArea } from '../../shared';

/**
 * Safely display a value that should be a string.
 * If it's an object, log a warning and return a fallback.
 */
function safeDisplay(value, fallback = '?', label = 'value') {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') {
    console.warn(`[CreationTab] Expected string for ${label} but got object:`, value);
    return `[object]`;
  }
  return String(value);
}

// ============================================================================
// findMatchingNamingProfile - Helper for naming profile matching
// ============================================================================

/**
 * Find which naming profile matches a creation entry's conditions
 */
function findMatchingNamingProfile(culture, entityKind, subtype, prominence, tags = {}) {
  if (!culture) return null;

  const naming = culture.naming;
  if (!naming?.profiles) return null;

  for (const profile of naming.profiles) {
    for (const group of (profile.strategyGroups || [])) {
      const cond = group.conditions || {};

      // Check entity kind
      if (cond.entityKinds?.length > 0 && !cond.entityKinds.includes(entityKind)) {
        continue;
      }

      // Check subtype
      if (cond.subtypes?.length > 0) {
        if (!subtype || !cond.subtypes.includes(subtype)) continue;
      }

      // Check prominence
      if (cond.prominence?.length > 0 && !cond.prominence.includes(prominence)) {
        continue;
      }

      // Check tags
      if (cond.tags?.length > 0) {
        const entityTags = Object.keys(tags || {});
        if (cond.tagMatchAll) {
          if (!cond.tags.every(t => entityTags.includes(t))) continue;
        } else {
          if (!cond.tags.some(t => entityTags.includes(t))) continue;
        }
      }

      // Found a match!
      return {
        profileId: profile.id,
        groupName: group.name,
      };
    }
  }

  // No conditional group matched - check for default (no conditions)
  for (const profile of naming.profiles) {
    for (const group of (profile.strategyGroups || [])) {
      if (!group.conditions || Object.keys(group.conditions).every(k => {
        const val = group.conditions[k];
        return !val || (Array.isArray(val) && val.length === 0);
      })) {
        return {
          profileId: profile.id,
          groupName: group.name || 'Default',
          isDefault: true,
        };
      }
    }
  }

  return null;
}

// ============================================================================
// CreationCard - Individual entity creation card
// ============================================================================

function CreationCard({ item, onChange, onRemove, schema, availableRefs, culturesById = {}, cultureIds = [], generator, tagRegistry = [], onAddToRegistry }) {
  const [expanded, setExpanded] = useState(false);
  const [hovering, setHovering] = useState(false);

  /**
   * Get the entity kind that a variable reference selects.
   * CRITICAL: Semantic planes are per-entity-kind. near_entity placement
   * MUST reference an entity of the SAME KIND as the entity being created.
   */
  const getRefKind = useCallback((ref) => {
    if (!ref) return null;
    if (ref === '$target') {
      return generator?.selection?.kind || null;
    }
    const varConfig = generator?.variables?.[ref];
    if (varConfig?.select?.kind) {
      return varConfig.select.kind;
    }
    // Check if it's a creation ref from earlier in the list
    const creationItem = generator?.creation?.find(c => c.entityRef === ref);
    if (creationItem?.kind) {
      return creationItem.kind;
    }
    return null;
  }, [generator]);

  // Get refs that are the SAME KIND as this entity (for near_entity placement)
  // Excludes self-reference since an entity can't be placed near itself
  const sameKindRefs = useMemo(() => {
    if (!item.kind) return [];
    return availableRefs.filter(ref => {
      // Exclude self-reference
      if (ref === item.entityRef) return false;
      const refKind = getRefKind(ref);
      return refKind === item.kind;
    });
  }, [availableRefs, item.kind, item.entityRef, getRefKind]);

  // Determine which culture this creation would use
  const getCultureId = () => {
    if (!item.culture) return null;
    if (typeof item.culture === 'string') return item.culture;
    if (item.culture.fixed) return item.culture.fixed;
    // For inherit, we can't determine the exact culture at config time
    // Show all cultures as potential matches
    return null;
  };

  const cultureId = getCultureId();
  const subtype = typeof item.subtype === 'string' ? item.subtype : null;

  // Compute naming profile matches
  const profileMatches = useMemo(() => {
    const targetCultures = cultureId ? [cultureId] : cultureIds;
    const matches = [];

    for (const cid of targetCultures) {
      const culture = culturesById[cid];
      const match = findMatchingNamingProfile(
        culture,
        item.kind,
        subtype,
        item.prominence,
        item.tags
      );
      if (match) {
        matches.push({ cultureId: cid, ...match });
      }
    }

    return matches;
  }, [culturesById, cultureId, cultureIds, item.kind, subtype, item.prominence, item.tags]);

  const entityKindOptions = (schema?.entityKinds || []).map((ek) => ({
    value: ek.kind,
    label: ek.description || ek.kind,
  }));

  const getSubtypeOptions = (kind) => {
    const ek = (schema?.entityKinds || []).find((e) => e.kind === kind);
    if (!ek?.subtypes) return [];
    return ek.subtypes.map((st) => ({ value: st.id, label: st.name || st.id }));
  };

  const getStatusOptions = (kind) => {
    const ek = (schema?.entityKinds || []).find((e) => e.kind === kind);
    if (!ek?.statuses) return [];
    return ek.statuses.map((st) => ({ value: st.id, label: st.name || st.id }));
  };

  const placement = item.placement;
  const hasAnchor = Boolean(placement?.anchor);

  // Replace entire placement object - no merging with old values
  const setPlacement = (newPlacement) => {
    onChange({ ...item, placement: newPlacement });
  };

  // Set anchor - replaces anchor completely, preserves other V2 properties
  const setAnchor = (anchor) => {
    setPlacement({
      anchor,
      ...(placement?.spacing && { spacing: placement.spacing }),
      ...(placement?.regionPolicy && { regionPolicy: placement.regionPolicy }),
      ...(placement?.steps && { steps: placement.steps }),
    });
  };

  // Update spacing
  const setSpacing = (spacing) => {
    setPlacement({
      anchor: placement.anchor,
      ...(spacing && Object.keys(spacing).length > 0 && { spacing }),
      ...(placement?.regionPolicy && { regionPolicy: placement.regionPolicy }),
      ...(placement?.steps && { steps: placement.steps }),
    });
  };

  // Update region policy
  const setRegionPolicy = (regionPolicy) => {
    setPlacement({
      anchor: placement.anchor,
      ...(placement?.spacing && { spacing: placement.spacing }),
      ...(regionPolicy && Object.keys(regionPolicy).length > 0 && { regionPolicy }),
      ...(placement?.steps && { steps: placement.steps }),
    });
  };

  // Update placement steps
  const setSteps = (steps) => {
    setPlacement({
      anchor: placement.anchor,
      ...(placement?.spacing && { spacing: placement.spacing }),
      ...(placement?.regionPolicy && { regionPolicy: placement.regionPolicy }),
      ...(steps && steps.length > 0 && { steps }),
    });
  };

  const updateField = (field, value) => {
    onChange({ ...item, [field]: value });
  };

  // Safely handle subtype display - could be string, {inherit:...}, {fromPressure:...}, etc.
  const subtypeDisplay = (() => {
    if (item.subtype === null || item.subtype === undefined) return '⚠ not set';
    if (typeof item.subtype === 'string') return item.subtype || '⚠ not set';
    if (typeof item.subtype === 'object') {
      if (item.subtype.inherit) return `inherit:${item.subtype.inherit}`;
      if (item.subtype.fromPressure) return 'from-pressure';
      console.warn('[CreationTab] Unknown subtype object format:', item.subtype);
      return '[complex]';
    }
    return String(item.subtype);
  })();

  return (
    <div className="item-card">
      <div
        className={`item-card-header ${hovering ? 'item-card-header-hover' : ''}`}
        onClick={() => setExpanded(!expanded)}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        <div className="item-card-icon item-card-icon-creation">✨</div>
        <div className="item-card-info">
          <div className="item-card-title">
            <span className="entity-ref">{item.entityRef}</span>
          </div>
          <div className="item-card-subtitle">
            {safeDisplay(item.kind, '?', 'kind')}:{subtypeDisplay} • {safeDisplay(item.prominence, 'no prominence', 'prominence')}
          </div>
          {/* Naming profile indicator */}
          {cultureIds.length > 0 && (
            <div style={{ marginTop: '4px' }}>
              {profileMatches.length > 0 ? (
                <span className="badge badge-success">
                  <span>✓</span>
                  <span>
                    {profileMatches.length === 1
                      ? profileMatches[0].profileId
                      : `${profileMatches.length} profiles`}
                  </span>
                </span>
              ) : (
                <span className="badge badge-error">
                  <span>!</span>
                  <span>No naming profile</span>
                </span>
              )}
            </div>
          )}
        </div>
        <div className="item-card-actions">
          <button className="btn-icon">{expanded ? '▲' : '▼'}</button>
          <button className="btn-icon btn-icon-danger" onClick={(e) => { e.stopPropagation(); onRemove(); }}>×</button>
        </div>
      </div>

      {expanded && (
        <div className="item-card-body">
          <div className="form-grid">
            <div className="form-group">
              <label className="label">Entity Reference</label>
              <input
                type="text"
                value={item.entityRef || ''}
                onChange={(e) => updateField('entityRef', e.target.value)}
                className="input"
                placeholder="$hero"
              />
            </div>
            <ReferenceDropdown
              label="Kind"
              value={item.kind}
              onChange={(v) => {
                // Batch all updates into one call to avoid stale state issues
                const updates = { kind: v, status: undefined };
                // Clear subtype unless it's an object (inherit/fromPressure)
                if (typeof item.subtype !== 'object') {
                  updates.subtype = undefined;
                }
                onChange({ ...item, ...updates });
              }}
              options={entityKindOptions}
            />
            {item.kind && (
              <ReferenceDropdown
                label="Status"
                value={item.status}
                onChange={(v) => updateField('status', v)}
                options={[{ value: '', label: 'None' }, ...getStatusOptions(item.kind)]}
              />
            )}
          </div>

          {/* SUBTYPE EDITOR */}
          {item.kind && (
            <div style={{ marginTop: '16px' }}>
              <label className="label">Subtype (required)</label>
              <div className="form-grid">
                <ReferenceDropdown
                  label="Mode"
                  value={
                    typeof item.subtype === 'string' ? 'fixed' :
                    item.subtype?.inherit ? 'inherit' :
                    item.subtype?.fromPressure ? 'from_pressure' : ''
                  }
                  onChange={(v) => {
                    if (v === 'fixed') updateField('subtype', '');
                    else if (v === 'inherit') updateField('subtype', { inherit: '$target' });
                    else if (v === 'from_pressure') updateField('subtype', { fromPressure: {} });
                    else updateField('subtype', undefined);
                  }}
                  options={[
                    { value: '', label: 'Select mode...' },
                    { value: 'fixed', label: 'Fixed subtype' },
                    { value: 'inherit', label: 'Inherit from entity' },
                    { value: 'from_pressure', label: 'From pressure' },
                  ]}
                  placeholder="Select mode..."
                />
                {typeof item.subtype === 'string' && (
                  <ReferenceDropdown
                    label="Subtype value"
                    value={item.subtype}
                    onChange={(v) => updateField('subtype', v)}
                    options={[{ value: '', label: 'Select subtype...' }, ...getSubtypeOptions(item.kind)]}
                    placeholder="Select subtype..."
                  />
                )}
                {item.subtype?.inherit && (
                  <ReferenceDropdown
                    label="Inherit from"
                    value={item.subtype.inherit}
                    onChange={(v) => updateField('subtype', { ...item.subtype, inherit: v })}
                    options={availableRefs.map((r) => ({ value: r, label: r }))}
                    placeholder="Select entity..."
                  />
                )}
              </div>
              {item.subtype?.fromPressure && (
                <div className="form-help-text" style={{ marginTop: '8px' }}>
                  From pressure mapping requires JSON editing for now.
                </div>
              )}
            </div>
          )}

          <div className="form-group mt-lg">
            <label className="label">Prominence</label>
            <LevelSelector
              value={item.prominence}
              onChange={(v) => updateField('prominence', v)}
              levels={PROMINENCE_LEVELS}
            />
          </div>

          <div style={{ marginTop: '16px' }}>
            <label className="label">Culture</label>
            <div className="form-grid">
              <ReferenceDropdown
                label="Mode"
                value={item.culture?.inherit ? 'inherit' : item.culture?.fixed ? 'fixed' : 'none'}
                onChange={(v) => {
                  if (v === 'inherit') updateField('culture', { inherit: '$target' });
                  else if (v === 'fixed') updateField('culture', { fixed: '' });
                  else updateField('culture', undefined);
                }}
                options={[
                  { value: 'none', label: 'None' },
                  { value: 'inherit', label: 'Inherit from entity' },
                  { value: 'fixed', label: 'Fixed culture ID' },
                ]}
              />
              {item.culture?.inherit && (
                <ReferenceDropdown
                  label="Inherit from"
                  value={item.culture.inherit}
                  onChange={(v) => updateField('culture', { inherit: v })}
                  options={availableRefs.map((r) => ({ value: r, label: r }))}
                  placeholder="Select entity..."
                />
              )}
              {item.culture?.fixed !== undefined && (
                <ReferenceDropdown
                  label="Culture ID"
                  value={item.culture.fixed}
                  onChange={(v) => updateField('culture', { fixed: v })}
                  options={cultureIds.map((c) => ({ value: c, label: culturesById[c]?.name || c }))}
                  placeholder="Select culture..."
                />
              )}
            </div>
          </div>

          {/* PLACEMENT EDITOR */}
          <div style={{ marginTop: '16px' }}>
            <label className="label">Placement</label>
            <div className="form-help-text">
              Configure semantic placement. Semantic planes are per-kind; cross-kind anchors are not allowed.
            </div>

            <div className="nested-section" style={{ marginTop: '8px' }}>
              {/* ANCHOR SECTION */}
              <div className="nested-title">Anchor Strategy</div>
              <div className="form-grid">
              <ReferenceDropdown
                label="Strategy Type"
                value={placement?.anchor?.type || ''}
                onChange={(v) => {
                  if (!v) return;
                  if (v === 'entity') {
                    // ref is required and must be non-empty - use first available or placeholder
                    const ref = sameKindRefs[0] || '$target';
                    setAnchor({ type: 'entity', ref, stickToRegion: true });
                    } else if (v === 'culture') {
                      setAnchor({ type: 'culture', id: '$target' });
                    } else if (v === 'refs_centroid') {
                      // refs is required and must have at least 1 item
                      const refs = sameKindRefs.length > 0 ? sameKindRefs.slice(0, 1) : ['$target'];
                      setAnchor({ type: 'refs_centroid', refs });
                    } else if (v === 'sparse') {
                      setAnchor({ type: 'sparse' });
                    } else if (v === 'bounds') {
                      setAnchor({ type: 'bounds', bounds: { x: [0, 100], y: [0, 100] } });
                    }
                  }}
                options={[
                  { value: 'entity', label: 'Near Entity (same kind)' },
                  { value: 'culture', label: 'In Culture Region' },
                  { value: 'refs_centroid', label: 'At Refs Centroid' },
                  { value: 'sparse', label: 'Sparse Area' },
                  { value: 'bounds', label: 'Within Bounds' },
                ]}
                placeholder="Select anchor..."
              />
            </div>

            {/* Entity Anchor Options */}
            {placement?.anchor?.type === 'entity' && (
              <div className="form-grid" style={{ marginTop: '12px' }}>
                <ReferenceDropdown
                  label="Reference Entity"
                  value={placement.anchor?.ref}
                  onChange={(v) => {
                    // ref must be non-empty per schema
                    if (!v) return;
                    setAnchor({ ...placement.anchor, ref: v });
                  }}
                  options={sameKindRefs.length > 0
                    ? sameKindRefs.map((r) => ({ value: r, label: `${r} (${item.kind})` }))
                    : [{ value: '$target', label: '$target' }]}
                  placeholder={sameKindRefs.length > 0 ? 'Select...' : `Define a ${item.kind} variable first`}
                />
                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={placement.anchor?.stickToRegion || false}
                      onChange={(e) => setAnchor({ ...placement.anchor, stickToRegion: e.target.checked })}
                    />
                    Stick to Region
                  </label>
                </div>
              </div>
            )}

            {/* Culture Anchor Options */}
            {placement?.anchor?.type === 'culture' && (
              <div className="form-grid" style={{ marginTop: '12px' }}>
                <ReferenceDropdown
                  label="Culture Source"
                  value={placement.anchor?.id}
                  onChange={(v) => {
                    // id must be non-empty per schema
                    if (!v) return;
                    setAnchor({ ...placement.anchor, id: v });
                  }}
                  options={availableRefs.length > 0
                    ? availableRefs.map((r) => ({ value: r, label: r }))
                    : [{ value: '$target', label: '$target' }]}
                  placeholder="Select entity..."
                />
              </div>
            )}

            {/* Refs Centroid Anchor Options */}
            {placement?.anchor?.type === 'refs_centroid' && (
              <div className="form-grid" style={{ marginTop: '12px' }}>
                <ChipSelect
                  label="Reference Entities"
                  value={placement.anchor?.refs || []}
                  onChange={(v) => {
                    // refs must have at least 1 item per schema
                    if (v.length === 0) return;
                    setAnchor({ ...placement.anchor, refs: v });
                  }}
                    options={sameKindRefs.map((r) => ({ value: r, label: r }))}
                    placeholder="Select entities..."
                  />
                  <div className="form-group">
                    <label className="label">Jitter Radius</label>
                    <NumberInput
                      value={placement.anchor?.jitter ?? ''}
                      onChange={(v) => setAnchor({ ...placement.anchor, jitter: v === '' ? undefined : Number(v) })}
                      min={0}
                      step={1}
                      placeholder="0"
                    />
                  </div>
                </div>
              )}

              {/* Sparse Anchor Options */}
            {placement?.anchor?.type === 'sparse' && (
              <div className="form-grid" style={{ marginTop: '12px' }}>
                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={placement.anchor?.preferPeriphery || false}
                      onChange={(e) => setAnchor({ ...placement.anchor, preferPeriphery: e.target.checked })}
                    />
                    Prefer Periphery
                  </label>
                </div>
              </div>
            )}

            {/* Bounds Anchor Options */}
            {placement?.anchor?.type === 'bounds' && (
              <div style={{ marginTop: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 1fr', gap: '8px', alignItems: 'end' }}>
                  <div></div>
                  <label className="label" style={{ textAlign: 'center' }}>Min</label>
                  <label className="label" style={{ textAlign: 'center' }}>Max</label>

                    <label className="label">X</label>
                    <NumberInput
                      value={placement.anchor?.bounds?.x?.[0] ?? ''}
                      onChange={(v) => {
                        const x = placement.anchor?.bounds?.x || [0, 100];
                        setAnchor({ ...placement.anchor, bounds: { ...placement.anchor?.bounds, x: [v === '' ? 0 : Number(v), x[1]] } });
                      }}
                      step={1}
                      placeholder="0"
                    />
                    <NumberInput
                      value={placement.anchor?.bounds?.x?.[1] ?? ''}
                      onChange={(v) => {
                        const x = placement.anchor?.bounds?.x || [0, 100];
                        setAnchor({ ...placement.anchor, bounds: { ...placement.anchor?.bounds, x: [x[0], v === '' ? 100 : Number(v)] } });
                      }}
                      step={1}
                      placeholder="100"
                    />

                    <label className="label">Y</label>
                    <NumberInput
                      value={placement.anchor?.bounds?.y?.[0] ?? ''}
                      onChange={(v) => {
                        const y = placement.anchor?.bounds?.y || [0, 100];
                        setAnchor({ ...placement.anchor, bounds: { ...placement.anchor?.bounds, y: [v === '' ? 0 : Number(v), y[1]] } });
                      }}
                      step={1}
                      placeholder="0"
                    />
                    <NumberInput
                      value={placement.anchor?.bounds?.y?.[1] ?? ''}
                      onChange={(v) => {
                        const y = placement.anchor?.bounds?.y || [0, 100];
                        setAnchor({ ...placement.anchor, bounds: { ...placement.anchor?.bounds, y: [y[0], v === '' ? 100 : Number(v)] } });
                      }}
                      step={1}
                      placeholder="100"
                    />

                    <label className="label">Z</label>
                    <NumberInput
                      value={placement.anchor?.bounds?.z?.[0] ?? ''}
                      onChange={(v) => {
                        const z = placement.anchor?.bounds?.z || [0, 100];
                        setAnchor({ ...placement.anchor, bounds: { ...placement.anchor?.bounds, z: [v === '' ? 0 : Number(v), z[1]] } });
                      }}
                      step={1}
                      placeholder="0"
                    />
                    <NumberInput
                      value={placement.anchor?.bounds?.z?.[1] ?? ''}
                      onChange={(v) => {
                        const z = placement.anchor?.bounds?.z || [0, 100];
                        setAnchor({ ...placement.anchor, bounds: { ...placement.anchor?.bounds, z: [z[0], v === '' ? 100 : Number(v)] } });
                      }}
                      step={1}
                      placeholder="100"
                    />
                  </div>
                </div>
              )}

              {!hasAnchor && (
                <div className="hint" style={{ marginTop: '12px' }}>
                  Select an anchor strategy to configure spacing, region policy, and placement steps.
                </div>
              )}

              {hasAnchor && (
                <>
                  {/* SPACING SECTION */}
                  <div className="nested-title" style={{ marginTop: '20px' }}>Spacing</div>
                  <div className="form-grid">
                    <div className="form-group">
                      <label className="label">Min Distance</label>
                      <NumberInput
                        value={placement?.spacing?.minDistance ?? ''}
                        onChange={(v) => {
                          const minDistance = v === '' ? undefined : Number(v);
                          const avoidRefs = placement?.spacing?.avoidRefs;
                          setSpacing({ ...(minDistance !== undefined && { minDistance }), ...(avoidRefs?.length && { avoidRefs }) });
                        }}
                        min={0}
                        step={1}
                        placeholder="No minimum"
                      />
                    </div>
                    <ChipSelect
                      label="Avoid Refs"
                      value={placement?.spacing?.avoidRefs || []}
                      onChange={(v) => {
                        const minDistance = placement?.spacing?.minDistance;
                        setSpacing({ ...(minDistance !== undefined && { minDistance }), ...(v.length && { avoidRefs: v }) });
                      }}
                      options={availableRefs.map((r) => ({ value: r, label: r }))}
                      placeholder="Select entities to avoid..."
                    />
                  </div>

                  {/* REGION POLICY SECTION */}
                  <div className="nested-title" style={{ marginTop: '20px' }}>Region Policy</div>
                  <div className="form-grid">
                    <div className="form-group">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          className="checkbox"
                          checked={placement?.regionPolicy?.allowEmergent || false}
                          onChange={(e) => {
                            const current = placement?.regionPolicy || {};
                            const allowEmergent = e.target.checked;
                            setRegionPolicy({ ...current, allowEmergent: allowEmergent || undefined });
                          }}
                        />
                        Allow Emergent Regions
                      </label>
                      <div className="hint">When enabled, creates new regions when existing regions are at capacity</div>
                    </div>
                    <div className="form-group">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          className="checkbox"
                          checked={placement?.regionPolicy?.createRegion || false}
                          onChange={(e) => {
                            const current = placement?.regionPolicy || {};
                            const createRegion = e.target.checked;
                            setRegionPolicy({ ...current, createRegion: createRegion || undefined });
                          }}
                        />
                        Create Region at Location
                      </label>
                      <div className="hint">Creates a new region centered on the placed entity (useful for establishing new territories)</div>
                    </div>
                    <div className="form-group">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          className="checkbox"
                          checked={placement?.regionPolicy?.preferSparse || false}
                          onChange={(e) => {
                            const current = placement?.regionPolicy || {};
                            const preferSparse = e.target.checked;
                            setRegionPolicy({ ...current, preferSparse: preferSparse || undefined });
                          }}
                        />
                        Prefer Sparse Regions
                      </label>
                      <div className="hint">Bias region selection toward regions with fewer entities (weighted random selection)</div>
                    </div>
                  </div>

                  {/* STEPS SECTION */}
                  <div className="nested-title" style={{ marginTop: '20px' }}>Placement Steps</div>
                  <ChipSelect
                    label="Steps"
                    value={placement?.steps || []}
                    onChange={(v) => setSteps(v)}
                    options={[
                      { value: 'anchor_region', label: 'Anchor Region' },
                      { value: 'ref_region', label: 'Ref Region' },
                      { value: 'seed_region', label: 'Seed Region' },
                      { value: 'sparse', label: 'Sparse' },
                      { value: 'bounds', label: 'Bounds' },
                      { value: 'random', label: 'Random' },
                    ]}
                    placeholder="Add placement steps..."
                  />
                </>
              )}
            </div>
          </div>

          {/* TAGS EDITOR */}
          <div style={{ marginTop: '16px' }}>
            <label className="label">Tags</label>
            <div className="form-help-text">
              Assign tags to this entity for filtering, naming profiles, and system targeting.
            </div>
            <TagSelector
              value={Object.keys(item.tags || {}).filter(k => item.tags[k])}
              onChange={(tagArray) => {
                // Convert array of tags to Record<string, boolean>
                const tagsObj = {};
                tagArray.forEach(t => { tagsObj[t] = true; });
                updateField('tags', tagsObj);
              }}
              tagRegistry={tagRegistry}
              onAddToRegistry={onAddToRegistry}
              placeholder="Select tags..."
            />
          </div>

          {/* DESCRIPTION EDITOR */}
          <div style={{ marginTop: '16px' }}>
            <label className="label">Description (optional)</label>
            <div className="form-help-text">
              A description for the created entity. Leave empty to auto-generate.
            </div>
            <LocalTextArea
              value={typeof item.description === 'string' ? item.description : ''}
              onChange={(value) => updateField('description', value || undefined)}
              placeholder="Optional entity description..."
              rows={2}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Variant Components - Conditional template modifications
// ============================================================================

function VariantConditionEditor({ condition, onChange, pressureOptions = [], entityKindOptions = [], availableRefs = [], tagRegistry = [] }) {
  const conditionType = condition?.type || 'always';

  const setCondition = (newCondition) => {
    onChange(newCondition);
  };

  return (
    <div className="form-grid">
      <ReferenceDropdown
        label="Condition Type"
        value={conditionType}
        onChange={(type) => {
          if (type === 'pressure') setCondition({ type: 'pressure', pressureId: pressureOptions[0]?.value || '', min: 30 });
          else if (type === 'pressure_compare') setCondition({ type: 'pressure_compare', pressureA: pressureOptions[0]?.value || '', pressureB: pressureOptions[1]?.value || '', operator: '>' });
          else if (type === 'entity_count') setCondition({ type: 'entity_count', kind: entityKindOptions[0]?.value || 'npc', min: 1 });
          else if (type === 'tag_exists') setCondition({ type: 'tag_exists', entity: '$target', tag: '' });
          else if (type === 'random_chance') setCondition({ type: 'random_chance', chance: 0.5 });
          else setCondition({ type: 'always' });
        }}
        options={[
          { value: 'always', label: 'Always (default)' },
          { value: 'pressure', label: 'Pressure threshold' },
          { value: 'pressure_compare', label: 'Pressure A > B' },
          { value: 'entity_count', label: 'Entity count' },
          { value: 'tag_exists', label: 'Tag exists on entity' },
          { value: 'random_chance', label: 'Random chance' },
        ]}
      />

      {conditionType === 'pressure' && (
        <>
          <ReferenceDropdown
            label="Pressure"
            value={condition.pressureId || ''}
            onChange={(v) => setCondition({ ...condition, pressureId: v })}
            options={pressureOptions}
            placeholder="Select pressure..."
          />
          <div className="form-group">
            <label className="label">Min Value</label>
            <NumberInput
              value={condition.min}
              onChange={(v) => setCondition({ ...condition, min: v })}
              integer
              allowEmpty
              placeholder="0"
            />
          </div>
          <div className="form-group">
            <label className="label">Max Value</label>
            <NumberInput
              value={condition.max}
              onChange={(v) => setCondition({ ...condition, max: v })}
              integer
              allowEmpty
              placeholder="100"
            />
          </div>
        </>
      )}

      {conditionType === 'pressure_compare' && (
        <>
          <ReferenceDropdown
            label="Pressure A"
            value={condition.pressureA || ''}
            onChange={(v) => setCondition({ ...condition, pressureA: v })}
            options={pressureOptions}
            placeholder="Select pressure..."
          />
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: '8px' }}>
            <span style={{ fontWeight: 'bold', fontSize: '18px' }}>&gt;</span>
          </div>
          <ReferenceDropdown
            label="Pressure B"
            value={condition.pressureB || ''}
            onChange={(v) => setCondition({ ...condition, pressureB: v })}
            options={pressureOptions}
            placeholder="Select pressure..."
          />
        </>
      )}

      {conditionType === 'entity_count' && (
        <>
          <ReferenceDropdown
            label="Entity Kind"
            value={condition.kind || ''}
            onChange={(v) => setCondition({ ...condition, kind: v })}
            options={entityKindOptions}
            placeholder="Select kind..."
          />
          <div className="form-group">
            <label className="label">Min Count</label>
            <NumberInput
              value={condition.min}
              onChange={(v) => setCondition({ ...condition, min: v })}
              integer
              allowEmpty
              placeholder="0"
            />
          </div>
          <div className="form-group">
            <label className="label">Max Count</label>
            <NumberInput
              value={condition.max}
              onChange={(v) => setCondition({ ...condition, max: v })}
              integer
              allowEmpty
              placeholder="No limit"
            />
          </div>
        </>
      )}

      {conditionType === 'tag_exists' && (
        <>
          <ReferenceDropdown
            label="Entity Reference"
            value={condition.entity || ''}
            onChange={(v) => setCondition({ ...condition, entity: v })}
            options={availableRefs.map((r) => ({ value: r, label: r }))}
            placeholder="Select entity..."
          />
          <div className="form-group">
            <label className="label">Tag Name</label>
            <TagSelector
              value={condition.tag ? [condition.tag] : []}
              onChange={(tags) => setCondition({ ...condition, tag: tags[0] || '' })}
              tagRegistry={tagRegistry}
              placeholder="Select tag..."
              singleSelect
            />
          </div>
        </>
      )}

      {conditionType === 'random_chance' && (
        <div className="form-group">
          <label className="label">Chance (0-1)</label>
          <NumberInput
            value={condition.chance ?? 0.5}
            onChange={(v) => setCondition({ ...condition, chance: v ?? 0.5 })}
            step={0.1}
            placeholder="0.5"
          />
        </div>
      )}
    </div>
  );
}

function VariantEffectsEditor({ effects, onChange, creationRefs = [], creationRules = [], pressureOptions = [], tagRegistry = [], schema }) {
  const currentEffects = effects || {};
  const [selectedEntity, setSelectedEntity] = useState(creationRefs[0] || '');

  const updateEffects = (key, value) => {
    const newEffects = { ...currentEffects };
    if (value === undefined || (typeof value === 'object' && Object.keys(value).length === 0) || (Array.isArray(value) && value.length === 0)) {
      delete newEffects[key];
    } else {
      newEffects[key] = value;
    }
    onChange(newEffects);
  };

  // Get subtypes for an entity kind
  const getSubtypeOptions = (kind) => {
    const ek = (schema?.entityKinds || []).find(e => e.kind === kind);
    if (!ek?.subtypes) return [];
    return ek.subtypes.map(st => ({ value: st.id, label: st.name || st.id }));
  };

  // Get the entity kind for a creation ref
  const getKindForRef = (ref) => {
    const rule = creationRules.find(r => r.entityRef === ref);
    return rule?.kind;
  };

  // Subtype overrides
  const subtypeOverrides = currentEffects.subtype || {};

  const setSubtypeOverride = (ref, subtype) => {
    const newSubtype = { ...subtypeOverrides };
    if (subtype) {
      newSubtype[ref] = subtype;
    } else {
      delete newSubtype[ref];
    }
    updateEffects('subtype', newSubtype);
  };

  // Get all tags from all entity refs combined
  const getAllTags = () => {
    const allTags = [];
    if (currentEffects.tags) {
      Object.entries(currentEffects.tags).forEach(([ref, tagMap]) => {
        Object.keys(tagMap).forEach(tag => {
          if (tagMap[tag]) allTags.push({ ref, tag });
        });
      });
    }
    return allTags;
  };

  const addTag = (ref, tag) => {
    if (!ref || !tag) return;
    const newTags = { ...(currentEffects.tags || {}) };
    newTags[ref] = { ...(newTags[ref] || {}), [tag]: true };
    updateEffects('tags', newTags);
  };

  const removeTag = (ref, tag) => {
    const newTags = { ...(currentEffects.tags || {}) };
    if (newTags[ref]) {
      delete newTags[ref][tag];
      if (Object.keys(newTags[ref]).length === 0) {
        delete newTags[ref];
      }
    }
    updateEffects('tags', newTags);
  };

  const allTags = getAllTags();

  return (
    <div>
      {/* Subtype Override section */}
      <div className="nested-section">
        <div className="nested-title">Subtype Overrides</div>
        <div className="form-help-text" style={{ marginBottom: '8px' }}>
          Override the subtype of created entities when this variant applies.
        </div>

        {creationRefs.length > 0 ? (
          creationRefs.map(ref => {
            const kind = getKindForRef(ref);
            const subtypeOptions = kind ? getSubtypeOptions(kind) : [];
            const currentOverride = subtypeOverrides[ref];

            return (
              <div key={ref} className="form-grid" style={{ marginBottom: '8px' }}>
                <div className="form-group">
                  <label className="label">{ref}</label>
                  <div className="form-help-text">{kind || 'Unknown kind'}</div>
                </div>
                <ReferenceDropdown
                  label="Override Subtype"
                  value={currentOverride || ''}
                  onChange={(v) => setSubtypeOverride(ref, v || undefined)}
                  options={[{ value: '', label: 'No override' }, ...subtypeOptions]}
                  placeholder="No override"
                />
              </div>
            );
          })
        ) : (
          <div className="form-help-text" style={{ fontStyle: 'italic' }}>
            Define entity creation rules first to override subtypes.
          </div>
        )}
      </div>

      {/* Tags section */}
      <div className="nested-section" style={{ marginTop: '16px' }}>
        <div className="nested-title">Additional Tags</div>
        <div className="form-help-text" style={{ marginBottom: '8px' }}>
          Add tags to created entities when this variant applies.
        </div>

        {allTags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
            {allTags.map(({ ref, tag }, idx) => (
              <div key={idx} className="chip">
                <span style={{ opacity: 0.7, marginRight: '4px' }}>{ref}:</span>
                <span>{tag}</span>
                <button
                  className="chip-remove"
                  onClick={() => removeTag(ref, tag)}
                >×</button>
              </div>
            ))}
          </div>
        )}

        {creationRefs.length > 0 ? (
          <div className="form-grid">
            <ReferenceDropdown
              label="Entity"
              value={selectedEntity}
              onChange={setSelectedEntity}
              options={creationRefs.map(r => ({ value: r, label: r }))}
              placeholder="Select entity..."
            />
            <div className="form-group">
              <label className="label">Tag</label>
              <TagSelector
                value={[]}
                onChange={(tags) => {
                  if (tags.length > 0 && selectedEntity) {
                    addTag(selectedEntity, tags[0]);
                  }
                }}
                tagRegistry={tagRegistry}
                placeholder="Select or type tag..."
                singleSelect
              />
            </div>
          </div>
        ) : (
          <div className="form-help-text" style={{ fontStyle: 'italic' }}>
            Define entity creation rules first to add variant tags.
          </div>
        )}
      </div>

      {/* Pressure Modifications section */}
      <div className="nested-section" style={{ marginTop: '16px' }}>
        <div className="nested-title">Pressure Modifications</div>
        <div className="form-help-text" style={{ marginBottom: '8px' }}>
          Modify pressure values when this variant applies.
        </div>

        {(currentEffects.stateUpdates || []).map((update, idx) => (
          <div key={idx} className="item-card" style={{ marginBottom: '8px' }}>
            <div style={{ padding: '12px' }}>
              <div className="form-row-with-delete">
                <div className="form-row-fields">
                  <ReferenceDropdown
                    label="Pressure"
                    value={update.pressureId || ''}
                    onChange={(v) => {
                      const newUpdates = [...currentEffects.stateUpdates];
                      newUpdates[idx] = { ...update, pressureId: v };
                      updateEffects('stateUpdates', newUpdates);
                    }}
                    options={pressureOptions}
                    placeholder="Select pressure..."
                  />
                  <div className="form-group">
                    <label className="label">Delta</label>
                    <NumberInput
                      value={update.delta}
                      onChange={(v) => {
                        const newUpdates = [...currentEffects.stateUpdates];
                        newUpdates[idx] = { ...update, delta: v ?? 0 };
                        updateEffects('stateUpdates', newUpdates);
                      }}
                      placeholder="0"
                    />
                  </div>
                </div>
                <button
                  className="btn-icon btn-icon-danger"
                  onClick={() => {
                    const newUpdates = currentEffects.stateUpdates.filter((_, i) => i !== idx);
                    updateEffects('stateUpdates', newUpdates);
                  }}
                >×</button>
              </div>
            </div>
          </div>
        ))}

        <button
          className="btn-add"
          onClick={() => {
            const newUpdates = [...(currentEffects.stateUpdates || []), {
              type: 'modify_pressure',
              pressureId: pressureOptions[0]?.value || '',
              delta: -10
            }];
            updateEffects('stateUpdates', newUpdates);
          }}
        >
          + Add Pressure Modification
        </button>
      </div>
    </div>
  );
}

function VariantCard({ variant, onChange, onRemove, pressureOptions = [], entityKindOptions = [], creationRefs = [], creationRules = [], tagRegistry = [], schema }) {
  const [expanded, setExpanded] = useState(false);

  // Build condition summary
  const getConditionSummary = () => {
    const when = variant.when;
    if (!when) return 'No condition';
    switch (when.type) {
      case 'pressure':
        return `${when.pressureId || '?'} in [${when.min ?? 0}, ${when.max ?? 100}]`;
      case 'pressure_compare':
        return `${when.pressureA || '?'} ${when.operator || '>'} ${when.pressureB || '?'}`;
      case 'entity_count':
        return `${when.kind || '?'} count in [${when.min ?? 0}, ${when.max ?? '∞'}]`;
      case 'tag_exists':
        return `${when.entity || '?'} has "${when.tag || '?'}"`;
      case 'random_chance':
        return `${Math.round((when.chance ?? 0.5) * 100)}% chance`;
      case 'always':
        return 'Always applies';
      default:
        return when.type;
    }
  };

  return (
    <div className="item-card">
      <div
        className="item-card-header"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="item-card-icon item-card-icon-variant">⚡</div>
        <div className="item-card-info">
          <div className="item-card-title">{variant.name || 'Unnamed Variant'}</div>
          <div className="item-card-subtitle">{getConditionSummary()}</div>
        </div>
        <div className="item-card-actions">
          <button className="btn-icon">{expanded ? '▲' : '▼'}</button>
          <button className="btn-icon btn-icon-danger" onClick={(e) => { e.stopPropagation(); onRemove(); }}>×</button>
        </div>
      </div>

      {expanded && (
        <div className="item-card-body">
          <div className="form-group">
            <label className="label">Variant Name</label>
            <input
              type="text"
              value={variant.name || ''}
              onChange={(e) => onChange({ ...variant, name: e.target.value })}
              className="input"
              placeholder="e.g., Resource Site"
            />
          </div>

          <div style={{ marginTop: '16px' }}>
            <label className="label">Condition</label>
            <div className="form-help-text">When should this variant apply?</div>
            <VariantConditionEditor
              condition={variant.when}
              onChange={(when) => onChange({ ...variant, when })}
              pressureOptions={pressureOptions}
              entityKindOptions={entityKindOptions}
              availableRefs={['$target', ...creationRefs]}
              tagRegistry={tagRegistry}
            />
          </div>

          <div style={{ marginTop: '16px' }}>
            <label className="label">Effects</label>
            <div className="form-help-text">What modifications to apply when this variant is selected.</div>
            <VariantEffectsEditor
              effects={variant.apply}
              onChange={(apply) => onChange({ ...variant, apply })}
              creationRefs={creationRefs}
              creationRules={creationRules}
              pressureOptions={pressureOptions}
              tagRegistry={tagRegistry}
              schema={schema}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function VariantsSection({ generator, onChange, pressures = [], schema, tagRegistry = [] }) {
  const variants = generator.variants || { selection: 'first_match', options: [] };

  // Build pressure options from pressures array
  const pressureOptions = useMemo(() =>
    (pressures || []).map(p => ({ value: p.id, label: p.name || p.id })),
    [pressures]
  );

  // Build entity kind options
  const entityKindOptions = useMemo(() =>
    (schema?.entityKinds || []).map(ek => ({ value: ek.kind, label: ek.description || ek.kind })),
    [schema]
  );

  // Collect entity refs and rules from creation (for tag targeting and subtype override)
  const creationRules = generator.creation || [];
  const creationRefs = useMemo(() => {
    return creationRules.map(c => c.entityRef).filter(Boolean);
  }, [creationRules]);

  const updateVariants = (newVariants) => {
    if (newVariants.options.length === 0) {
      // Remove variants entirely if empty
      const { variants: _, ...rest } = generator;
      onChange(rest);
    } else {
      onChange({ ...generator, variants: newVariants });
    }
  };

  const addVariant = () => {
    updateVariants({
      ...variants,
      options: [...variants.options, {
        name: `Variant ${variants.options.length + 1}`,
        when: { type: 'always' },
        apply: {}
      }]
    });
  };

  return (
    <div className="section" style={{ marginTop: '24px' }}>
      <div className="section-title"><span>⚡</span> Conditional Variants</div>
      <div className="section-desc">
        Define variants that modify tags or pressure effects based on world state.
        This allows a single template to produce different outcomes depending on conditions.
      </div>

      {variants.options.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <ReferenceDropdown
            label="Selection Mode"
            value={variants.selection}
            onChange={(v) => updateVariants({ ...variants, selection: v })}
            options={[
              { value: 'first_match', label: 'First Match - Apply first matching variant only' },
              { value: 'all_matching', label: 'All Matching - Apply all matching variants' },
            ]}
          />
        </div>
      )}

      {variants.options.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">⚡</div>
          <div className="empty-state-title">No variants defined</div>
          <div className="empty-state-desc">
            Add variants to make this template produce different outcomes based on world state.
          </div>
        </div>
      ) : (
        variants.options.map((variant, idx) => (
          <VariantCard
            key={idx}
            variant={variant}
            onChange={(updated) => {
              const newOptions = [...variants.options];
              newOptions[idx] = updated;
              updateVariants({ ...variants, options: newOptions });
            }}
            onRemove={() => {
              updateVariants({ ...variants, options: variants.options.filter((_, i) => i !== idx) });
            }}
            pressureOptions={pressureOptions}
            entityKindOptions={entityKindOptions}
            creationRefs={creationRefs}
            creationRules={creationRules}
            tagRegistry={tagRegistry}
            schema={schema}
          />
        ))
      )}

      <button className="btn-add" onClick={addVariant}>
        + Add Variant
      </button>
    </div>
  );
}

// ============================================================================
// CreationTab - Main tab component
// ============================================================================

/**
 * @param {Object} props
 * @param {Object} props.generator - The generator being edited
 * @param {Function} props.onChange - Callback when generator changes
 * @param {Object} props.schema - Domain schema
 * @param {Array} props.tagRegistry - Available tags
 * @param {Function} props.onAddToRegistry - Callback to add new tag to registry
 * @param {Array} props.pressures - Available pressure definitions
 */
export function CreationTab({ generator, onChange, schema, tagRegistry = [], onAddToRegistry, pressures = [] }) {
  const creation = generator.creation || [];

  const availableRefs = useMemo(() => {
    const refs = ['$target'];
    Object.keys(generator.variables || {}).forEach((v) => refs.push(v));
    creation.forEach((c) => { if (c.entityRef && !refs.includes(c.entityRef)) refs.push(c.entityRef); });
    return refs;
  }, [generator.variables, creation]);

  const culturesById = useMemo(() => {
    const map = {};
    (schema?.cultures || []).forEach((culture) => {
      map[culture.id] = culture;
    });
    return map;
  }, [schema?.cultures]);

  const cultureIds = useMemo(() => Object.keys(culturesById), [culturesById]);

  const handleAdd = () => {
    const nextNum = creation.length + 1;
    onChange({
      ...generator,
      creation: [...creation, { entityRef: `$entity${nextNum}`, kind: 'npc', prominence: 'marginal' }],
    });
  };

  return (
    <div>
      <div className="section">
        <div className="section-title">Entity Creation</div>
        <div className="section-desc">
          Define entities that this generator creates. Each entity gets a reference (like <code className="inline-code">$hero</code>)
          that can be used in relationships.
        </div>

        {creation.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">✨</div>
            <div className="empty-state-title">No entities created</div>
            <div className="empty-state-desc">
              This generator only modifies existing entities. Add creation rules to spawn new entities.
            </div>
          </div>
        ) : (
          creation.map((item, index) => (
            <CreationCard
              key={index}
              item={item}
              onChange={(updated) => {
                const newCreation = [...creation];
                newCreation[index] = updated;
                onChange({ ...generator, creation: newCreation });
              }}
              onRemove={() => onChange({ ...generator, creation: creation.filter((_, i) => i !== index) })}
              schema={schema}
              availableRefs={availableRefs}
              culturesById={culturesById}
              cultureIds={cultureIds}
              generator={generator}
              tagRegistry={tagRegistry}
              onAddToRegistry={onAddToRegistry}
            />
          ))
        )}

        <button
          className="btn-add"
          onClick={handleAdd}
        >
          + Add Entity Creation
        </button>
      </div>

      <VariantsSection
        generator={generator}
        onChange={onChange}
        pressures={pressures}
        schema={schema}
        tagRegistry={tagRegistry}
      />
    </div>
  );
}

export default CreationTab;

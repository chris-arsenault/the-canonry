/**
 * SingleGroupTab - Edit a single strategy group
 */

import { useMemo } from 'react';
import { TagSelector, NumberInput } from '@penguin-tales/shared-components';
import MultiSelectPills from '../MultiSelectPills';

const PROMINENCE_LEVELS = ['forgotten', 'marginal', 'recognized', 'renowned', 'mythic'];

export default function SingleGroupTab({
  group,
  groupIdx,
  onChange,
  onDelete,
  domains,
  grammars,
  entityKinds,
  worldSchema,
  tagRegistry,
  onAddTag,
}) {
  const hasConditions = !!group.conditions;
  const groupTotalWeight = group.strategies.reduce((sum, s) => sum + s.weight, 0);

  // Compute available subtypes based on selected entity kinds
  // worldSchema.hardState has: { kind, subtype: string[], status: string[] }
  const availableSubtypes = useMemo(() => {
    const selectedKinds = group.conditions?.entityKinds || [];
    const entityDefs = worldSchema?.hardState || [];

    // If no entity kinds selected, show all subtypes from all entity kinds
    const kindsToCheck = selectedKinds.length > 0
      ? entityDefs.filter(e => selectedKinds.includes(e.kind))
      : entityDefs;

    const subtypes = new Set();
    kindsToCheck.forEach(entityDef => {
      // subtype is already a string array in hardState format
      (entityDef.subtype || []).forEach(st => {
        if (st) subtypes.add(st);
      });
    });

    return Array.from(subtypes).sort();
  }, [group.conditions?.entityKinds, worldSchema]);

  const updateGroup = (updates) => {
    onChange({ ...group, ...updates });
  };

  const toggleConditions = () => {
    if (hasConditions) {
      updateGroup({ conditions: null });
    } else {
      updateGroup({
        conditions: {
          entityKinds: [],
          prominence: [],
          subtypes: [],
          subtypeMatchAll: false,
          tags: [],
          tagMatchAll: false,
        },
      });
    }
  };

  const handleConditionChange = (field, value) => {
    updateGroup({
      conditions: { ...group.conditions, [field]: value },
    });
  };

  const handleAddStrategy = (type) => {
    const newStrategy = { type, weight: 0.25 };
    if (type === 'phonotactic') {
      newStrategy.domainId = domains[0]?.id || '';
    } else if (type === 'grammar') {
      newStrategy.grammarId = grammars[0]?.id || '';
    }
    updateGroup({
      strategies: [...group.strategies, newStrategy],
    });
  };

  const handleDeleteStrategy = (stratIdx) => {
    updateGroup({
      strategies: group.strategies.filter((_, i) => i !== stratIdx),
    });
  };

  const handleWeightChange = (stratIdx, newWeight) => {
    const strategies = [...group.strategies];
    strategies[stratIdx] = { ...strategies[stratIdx], weight: parseFloat(newWeight) || 0 };
    updateGroup({ strategies });
  };

  const handleStrategyConfigChange = (stratIdx, field, value) => {
    const strategies = [...group.strategies];
    strategies[stratIdx] = { ...strategies[stratIdx], [field]: value };
    updateGroup({ strategies });
  };

  return (
    <div className="single-group-tab">
      {/* Group Header */}
      <div className="group-header-section">
        <div className="group-name-row">
          <div className="form-group">
            <label>Group Name</label>
            <input
              value={group.name || ''}
              onChange={(e) => updateGroup({ name: e.target.value })}
              placeholder="e.g., Noble Names"
            />
          </div>
          <div className="form-group priority-field">
            <label>Priority</label>
            <NumberInput
              value={group.priority || 0}
              onChange={(v) => updateGroup({ priority: v ?? 0 })}
              integer
            />
          </div>
        </div>
        <p className="text-muted text-small mt-0">
          Higher priority groups are evaluated first. The first matching group's strategies are used.
        </p>
      </div>

      {/* Conditions Section */}
      <div className="group-section">
        <div className="section-header">
          <h4>Conditions</h4>
          <button
            className={`toggle-btn ${hasConditions ? 'active' : ''}`}
            onClick={toggleConditions}
          >
            {hasConditions ? 'Conditional' : 'Always Match'}
          </button>
        </div>

        {hasConditions ? (
          <div className="conditions-grid">
            <div className="condition-field">
              <label>Entity Types</label>
              <MultiSelectPills
                options={entityKinds}
                selected={group.conditions?.entityKinds || []}
                onChange={(val) => handleConditionChange('entityKinds', val)}
                allLabel="All"
              />
            </div>

            <div className="condition-field">
              <label>Prominence</label>
              <MultiSelectPills
                options={PROMINENCE_LEVELS}
                selected={group.conditions?.prominence || []}
                onChange={(val) => handleConditionChange('prominence', val)}
                allLabel="Any"
              />
            </div>

            <div className="condition-field">
              <label>
                Subtypes
                <label className="match-all-toggle">
                  <input
                    type="checkbox"
                    checked={group.conditions?.subtypeMatchAll || false}
                    onChange={(e) => handleConditionChange('subtypeMatchAll', e.target.checked)}
                  />
                  Match all
                </label>
              </label>
              {availableSubtypes.length > 0 ? (
                <MultiSelectPills
                  options={availableSubtypes}
                  selected={group.conditions?.subtypes || []}
                  onChange={(val) => handleConditionChange('subtypes', val)}
                  allLabel="Any"
                />
              ) : (
                <p className="text-muted text-small" style={{ margin: '8px 0' }}>
                  {(group.conditions?.entityKinds?.length || 0) > 0
                    ? 'Selected entity types have no subtypes defined'
                    : 'Select entity types to see available subtypes'}
                </p>
              )}
            </div>

            <div className="condition-field">
              <label>Tags</label>
              <TagSelector
                value={group.conditions?.tags || []}
                onChange={(val) => handleConditionChange('tags', val)}
                tagRegistry={tagRegistry}
                placeholder="Select tags..."
                matchAllEnabled={true}
                matchAll={group.conditions?.tagMatchAll || false}
                onMatchAllChange={(val) => handleConditionChange('tagMatchAll', val)}
                onAddToRegistry={onAddTag}
              />
            </div>
          </div>
        ) : (
          <p className="text-muted text-small">
            This group will always be considered. Click "Always Match" to add conditions.
          </p>
        )}
      </div>

      {/* Strategies Section */}
      <div className="group-section">
        <div className="section-header">
          <h4>Strategies</h4>
          <div className="add-strategy-buttons">
            <button className="add-btn phonotactic" onClick={() => handleAddStrategy('phonotactic')}>
              + Phonotactic
            </button>
            <button className="add-btn grammar" onClick={() => handleAddStrategy('grammar')}>
              + Grammar
            </button>
          </div>
        </div>

        {group.strategies.length === 0 ? (
          <div className="empty-strategies">
            <p>No strategies yet. Add a strategy to define how names are generated.</p>
          </div>
        ) : (
          <div className="strategies-list">
            {group.strategies.map((strategy, stratIdx) => (
              <div key={stratIdx} className={`strategy-item ${strategy.type}`}>
                <div className="strategy-header">
                  <span className="strategy-type">{strategy.type}</span>
                  <span className="strategy-weight">
                    {groupTotalWeight > 0
                      ? Math.round((strategy.weight / groupTotalWeight) * 100)
                      : 0}%
                  </span>
                  <button
                    className="remove-btn"
                    onClick={() => handleDeleteStrategy(stratIdx)}
                  >
                    ×
                  </button>
                </div>

                <div className="strategy-body">
                  <div className="weight-slider">
                    <label>Weight</label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={strategy.weight}
                      onChange={(e) => handleWeightChange(stratIdx, e.target.value)}
                    />
                  </div>

                  {strategy.type === 'phonotactic' && (
                    <div className="strategy-config">
                      <label>Domain</label>
                      <select
                        value={strategy.domainId || ''}
                        onChange={(e) => handleStrategyConfigChange(stratIdx, 'domainId', e.target.value)}
                      >
                        <option value="">Select domain...</option>
                        {domains.map((d) => (
                          <option key={d.id} value={d.id}>{d.id}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {strategy.type === 'grammar' && (
                    <div className="strategy-config">
                      <label>Grammar</label>
                      <select
                        value={strategy.grammarId || ''}
                        onChange={(e) => handleStrategyConfigChange(stratIdx, 'grammarId', e.target.value)}
                      >
                        <option value="">Select grammar...</option>
                        {grammars.map((g) => (
                          <option key={g.id} value={g.id}>{g.id}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Danger Zone */}
      <div className="danger-zone">
        <button className="danger" onClick={onDelete}>
          Delete Group
        </button>
      </div>
    </div>
  );
}

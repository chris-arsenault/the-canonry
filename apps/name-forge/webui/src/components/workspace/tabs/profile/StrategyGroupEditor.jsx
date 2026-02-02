import React from 'react';
import { TagSelector, NumberInput } from '@penguin-tales/shared-components';
import { getStrategyColor, getStrategyBorder } from '../../../utils';
import MultiSelectPills from './MultiSelectPills';
import TagsInput from './TagsInput';

/**
 * Strategy group editor component
 */
export default function StrategyGroupEditor({
  group,
  groupIdx,
  domains,
  grammars,
  entityKinds,
  prominenceLevels,
  tagRegistry,
  editedProfile,
  setEditedProfile,
  onDeleteGroup,
  onAddStrategy,
  onDeleteStrategy,
  onWeightChange,
  onConditionChange,
  onAddTag
}) {
  const groupTotalWeight = group.strategies.reduce((sum, s) => sum + s.weight, 0);
  const hasConditions = !!group.conditions;

  const toggleConditions = () => {
    const groups = [...editedProfile.strategyGroups];
    if (hasConditions) {
      groups[groupIdx] = { ...groups[groupIdx], conditions: null };
    } else {
      groups[groupIdx] = {
        ...groups[groupIdx],
        conditions: {
          entityKinds: [],
          prominence: [],
          subtypes: [],
          subtypeMatchAll: false,
          tags: [],
          tagMatchAll: false
        }
      };
    }
    setEditedProfile({ ...editedProfile, strategyGroups: groups });
  };

  return (
    <div className={`strategy-group ${hasConditions ? 'conditional' : 'default'}`}>
      <div className="flex justify-between align-center mb-md">
        <div className="flex align-center gap-md">
          <input
            value={group.name || ''}
            onChange={(e) => {
              const groups = [...editedProfile.strategyGroups];
              groups[groupIdx] = { ...groups[groupIdx], name: e.target.value };
              setEditedProfile({ ...editedProfile, strategyGroups: groups });
            }}
            placeholder="Group name"
            className="input-group-name"
          />
          <div className="flex align-center gap-xs">
            <label className="text-xs text-muted">Priority:</label>
            <NumberInput
              value={group.priority || 0}
              onChange={(v) => {
                const groups = [...editedProfile.strategyGroups];
                groups[groupIdx] = { ...groups[groupIdx], priority: v ?? 0 };
                setEditedProfile({ ...editedProfile, strategyGroups: groups });
              }}
              className="input-priority"
              integer
            />
          </div>
          <button
            className="secondary btn-xs"
            onClick={toggleConditions}
          >
            {hasConditions ? 'Remove Conditions' : 'Add Conditions'}
          </button>
        </div>
        <button className="danger text-xs" onClick={() => onDeleteGroup(groupIdx)}>
          Delete Group
        </button>
      </div>

      {/* Group Conditions */}
      {hasConditions && (
        <div className="conditions-panel">
          <div className="text-xs font-bold text-purple mb-md">
            Group Conditions
          </div>

          {/* Row 1: Entity Types and Prominence */}
          <div className="form-grid-2 mb-md">
            {/* Entity Types */}
            <div>
              <label className="condition-label">
                Entity Types
              </label>
              <MultiSelectPills
                options={entityKinds}
                selected={group.conditions?.entityKinds || []}
                onChange={(val) => onConditionChange(groupIdx, 'entityKinds', val)}
                allLabel="All"
              />
            </div>

            {/* Prominence */}
            <div>
              <label className="condition-label">
                Prominence
              </label>
              <MultiSelectPills
                options={prominenceLevels}
                selected={group.conditions?.prominence || []}
                onChange={(val) => onConditionChange(groupIdx, 'prominence', val)}
                allLabel="Any"
              />
            </div>
          </div>

          {/* Row 2: Subtypes and Tags */}
          <div className="form-grid-2">
            {/* Subtypes */}
            <div>
              <div className="flex justify-between align-center mb-xs">
                <label className="condition-label mb-0">Subtypes</label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={group.conditions?.subtypeMatchAll || false}
                    onChange={(e) => onConditionChange(groupIdx, 'subtypeMatchAll', e.target.checked)}
                    className="checkbox-small"
                  />
                  Match all
                </label>
              </div>
              <TagsInput
                value={group.conditions?.subtypes || []}
                onChange={(val) => onConditionChange(groupIdx, 'subtypes', val)}
                placeholder="Type and press space..."
              />
            </div>

            {/* Tags */}
            <div>
              <label className="condition-label">
                Tags
              </label>
              <TagSelector
                value={group.conditions?.tags || []}
                onChange={(val) => onConditionChange(groupIdx, 'tags', val)}
                tagRegistry={tagRegistry}
                placeholder="Select tags..."
                matchAllEnabled={true}
                matchAll={group.conditions?.tagMatchAll || false}
                onMatchAllChange={(val) => onConditionChange(groupIdx, 'tagMatchAll', val)}
                onAddToRegistry={onAddTag}
              />
            </div>
          </div>
        </div>
      )}

      {/* Strategies */}
      {group.strategies.length === 0 && (
        <div className="text-muted text-small mb-sm">
          No strategies. Add one below.
        </div>
      )}

      {group.strategies.map((strategy, stratIdx) => (
        <div
          key={stratIdx}
          className={`strategy-card ${strategy.type}`}
        >
          <div className="flex justify-between align-center mb-sm">
            <div className="flex align-center gap-sm">
              <strong className="capitalize text-small">{strategy.type}</strong>
              <span className="weight-badge">
                {groupTotalWeight > 0 ? ((strategy.weight / groupTotalWeight) * 100).toFixed(0) : 0}%
              </span>
            </div>
            <button className="danger btn-xs" onClick={() => onDeleteStrategy(groupIdx, stratIdx)}>
              Remove
            </button>
          </div>

          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={strategy.weight}
            onChange={(e) => onWeightChange(groupIdx, stratIdx, e.target.value)}
            className="strategy-slider"
          />

          {strategy.type === 'phonotactic' && (
            <select
              value={strategy.domainId || ''}
              onChange={(e) => {
                const groups = [...editedProfile.strategyGroups];
                const strategies = [...groups[groupIdx].strategies];
                strategies[stratIdx] = { ...strategies[stratIdx], domainId: e.target.value };
                groups[groupIdx] = { ...groups[groupIdx], strategies };
                setEditedProfile({ ...editedProfile, strategyGroups: groups });
              }}
              className="strategy-select"
            >
              <option value="">Select domain...</option>
              {domains.map(d => (
                <option key={d.id} value={d.id}>{d.id}</option>
              ))}
            </select>
          )}

          {strategy.type === 'grammar' && (
            <select
              value={strategy.grammarId || ''}
              onChange={(e) => {
                const groups = [...editedProfile.strategyGroups];
                const strategies = [...groups[groupIdx].strategies];
                strategies[stratIdx] = { ...strategies[stratIdx], grammarId: e.target.value };
                groups[groupIdx] = { ...groups[groupIdx], strategies };
                setEditedProfile({ ...editedProfile, strategyGroups: groups });
              }}
              className="strategy-select"
            >
              <option value="">Select grammar...</option>
              {grammars.map(g => (
                <option key={g.id} value={g.id}>{g.id}</option>
              ))}
            </select>
          )}
        </div>
      ))}

      <div className="flex gap-xs mt-sm">
        <button className="secondary text-xs" onClick={() => onAddStrategy(groupIdx, 'phonotactic')}>
          + Phonotactic
        </button>
        <button className="secondary text-xs" onClick={() => onAddStrategy(groupIdx, 'grammar')}>
          + Grammar
        </button>
      </div>
    </div>
  );
}

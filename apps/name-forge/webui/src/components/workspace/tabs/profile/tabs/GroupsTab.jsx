/**
 * GroupsTab - Strategy groups management
 */

import StrategyGroupEditor from '../StrategyGroupEditor';

export default function GroupsTab({
  profile,
  onChange,
  domains,
  grammars,
  entityKinds,
  tagRegistry,
  onAddTag,
}) {
  const prominenceLevels = ['forgotten', 'marginal', 'recognized', 'renowned', 'mythic'];

  const handleAddGroup = (withConditions = false) => {
    const newGroup = {
      name: withConditions ? 'Conditional Group' : 'Default',
      priority: withConditions ? 50 : 0,
      conditions: withConditions ? {
        entityKinds: [],
        prominence: [],
        subtypes: [],
        subtypeMatchAll: false,
        tags: [],
        tagMatchAll: false,
      } : null,
      strategies: [],
    };
    onChange({
      ...profile,
      strategyGroups: [...(profile.strategyGroups || []), newGroup],
    });
  };

  const handleDeleteGroup = (groupIdx) => {
    onChange({
      ...profile,
      strategyGroups: profile.strategyGroups.filter((_, i) => i !== groupIdx),
    });
  };

  const handleAddStrategy = (groupIdx, type) => {
    const newStrategy = { type, weight: 0.25 };
    if (type === 'phonotactic') {
      newStrategy.domainId = domains[0]?.id || '';
    } else if (type === 'grammar') {
      newStrategy.grammarId = grammars[0]?.id || '';
    }

    const groups = [...profile.strategyGroups];
    groups[groupIdx] = {
      ...groups[groupIdx],
      strategies: [...groups[groupIdx].strategies, newStrategy],
    };
    onChange({ ...profile, strategyGroups: groups });
  };

  const handleDeleteStrategy = (groupIdx, stratIdx) => {
    const groups = [...profile.strategyGroups];
    groups[groupIdx] = {
      ...groups[groupIdx],
      strategies: groups[groupIdx].strategies.filter((_, i) => i !== stratIdx),
    };
    onChange({ ...profile, strategyGroups: groups });
  };

  const handleWeightChange = (groupIdx, stratIdx, newWeight) => {
    const groups = [...profile.strategyGroups];
    const strategies = [...groups[groupIdx].strategies];
    strategies[stratIdx] = { ...strategies[stratIdx], weight: parseFloat(newWeight) || 0 };
    groups[groupIdx] = { ...groups[groupIdx], strategies };
    onChange({ ...profile, strategyGroups: groups });
  };

  const handleGroupConditionChange = (groupIdx, field, value) => {
    const groups = [...profile.strategyGroups];
    const currentConditions = groups[groupIdx].conditions || {
      entityKinds: [],
      prominence: [],
      subtypes: [],
      tags: [],
    };
    groups[groupIdx] = {
      ...groups[groupIdx],
      conditions: { ...currentConditions, [field]: value },
    };
    onChange({ ...profile, strategyGroups: groups });
  };

  const setEditedProfile = (updated) => {
    onChange(updated);
  };

  return (
    <div className="profile-groups-tab">
      <p className="text-muted text-small mt-0">
        Strategy groups are evaluated by priority (highest first). The first matching group's
        strategies are used for name generation.
      </p>

      {(profile.strategyGroups || []).length === 0 && (
        <div className="empty-state-card">
          <p className="mt-0 mb-0">No strategy groups yet.</p>
          <p className="text-muted mt-sm mb-0">
            Add a default group to get started with name generation.
          </p>
        </div>
      )}

      {(profile.strategyGroups || []).map((group, groupIdx) => (
        <StrategyGroupEditor
          key={groupIdx}
          group={group}
          groupIdx={groupIdx}
          domains={domains}
          grammars={grammars}
          entityKinds={entityKinds}
          prominenceLevels={prominenceLevels}
          tagRegistry={tagRegistry}
          editedProfile={profile}
          setEditedProfile={setEditedProfile}
          onDeleteGroup={handleDeleteGroup}
          onAddStrategy={handleAddStrategy}
          onDeleteStrategy={handleDeleteStrategy}
          onWeightChange={handleWeightChange}
          onConditionChange={handleGroupConditionChange}
          onAddTag={onAddTag}
        />
      ))}

      <div className="add-group-buttons">
        <button className="secondary" onClick={() => handleAddGroup(false)}>
          + Default Group
        </button>
        <button className="secondary" onClick={() => handleAddGroup(true)}>
          + Conditional Group
        </button>
      </div>
    </div>
  );
}

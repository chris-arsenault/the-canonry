import { useState, useEffect, useRef } from 'react';
import { API_URL } from '../constants';
import { getEffectiveDomain, getAllDomains, getSharedLexemeLists, getStrategyColor, getStrategyBorder, getSortedGroups } from '../utils';
import ConditionsModal from '../modals/ConditionsModal';

function ProfileTab({ cultureId, entityKind, entityConfig, onConfigChange, onAutoGenerate, cultureConfig, allCultures }) {
  const [editing, setEditing] = useState(false);
  const [editedProfile, setEditedProfile] = useState(null);
  const [testNames, setTestNames] = useState([]);
  const [testLoading, setTestLoading] = useState(false);
  const [testError, setTestError] = useState(null);

  // Collect ALL domains from ALL cultures for domain dropdown
  const allDomains = getAllDomains(allCultures);

  const [strategyUsage, setStrategyUsage] = useState(null);
  // Modal state for conditions editing
  const [conditionsModalOpen, setConditionsModalOpen] = useState(false);
  const [editingGroupIdx, setEditingGroupIdx] = useState(null);

  // Autosave refs
  const autosaveTimeoutRef = useRef(null);
  const lastSavedProfileRef = useRef(null);

  const profile = entityConfig?.profile;

  // Autosave effect - debounced save when editedProfile changes in edit mode
  useEffect(() => {
    if (!editing || !editedProfile) return;

    const profileStr = JSON.stringify(editedProfile);
    if (profileStr === lastSavedProfileRef.current) return;

    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
    }

    autosaveTimeoutRef.current = setTimeout(() => {
      // Normalize weights within each group before saving
      const normalizedGroups = editedProfile.strategyGroups.map(group => {
        const totalWeight = group.strategies.reduce((sum, s) => sum + s.weight, 0);
        return {
          ...group,
          strategies: group.strategies.map(s => ({
            ...s,
            weight: totalWeight > 0 ? s.weight / totalWeight : 1 / group.strategies.length
          }))
        };
      });

      const updatedProfile = {
        ...editedProfile,
        strategyGroups: normalizedGroups
      };
      delete updatedProfile.strategies;

      onConfigChange({
        ...entityConfig,
        profile: updatedProfile
      });

      lastSavedProfileRef.current = profileStr;
    }, 1000);

    return () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }
    };
  }, [editedProfile, editing]);

  // Reset autosave ref when exiting edit mode
  useEffect(() => {
    if (!editing) {
      lastSavedProfileRef.current = null;
    }
  }, [editing]);

  const cultureDomains = cultureConfig?.domains || [];
  const effectiveDomain = getEffectiveDomain(cultureConfig);

  // Get shared lexeme lists that apply to this culture/entity
  const sharedLexemeLists = getSharedLexemeLists(allCultures, cultureId, entityKind);

  const handleStartEdit = () => {
    const profileCopy = JSON.parse(JSON.stringify(profile));
    // Ensure strategyGroups exists
    if (!profileCopy.strategyGroups) {
      profileCopy.strategyGroups = [];
    }
    setEditedProfile(profileCopy);
    setEditing(true);
  };

  const handleSave = () => {
    // Normalize weights within each group
    const normalizedGroups = editedProfile.strategyGroups.map(group => {
      const totalWeight = group.strategies.reduce((sum, s) => sum + s.weight, 0);
      return {
        ...group,
        strategies: group.strategies.map(s => ({
          ...s,
          weight: totalWeight > 0 ? s.weight / totalWeight : 1 / group.strategies.length
        }))
      };
    });

    const updatedProfile = {
      ...editedProfile,
      strategyGroups: normalizedGroups
    };
    delete updatedProfile.strategies;

    onConfigChange({
      ...entityConfig,
      profile: updatedProfile
    });
    setEditing(false);
    setEditedProfile(null);
  };

  const handleCancel = () => {
    setEditing(false);
    setEditedProfile(null);
  };

  // Strategy weight change within a group
  const handleWeightChange = (groupIdx, stratIdx, newWeight) => {
    const groups = [...editedProfile.strategyGroups];
    const strategies = [...groups[groupIdx].strategies];
    strategies[stratIdx] = { ...strategies[stratIdx], weight: parseFloat(newWeight) || 0 };
    groups[groupIdx] = { ...groups[groupIdx], strategies };
    setEditedProfile({ ...editedProfile, strategyGroups: groups });
  };

  // Delete a strategy from a group
  const handleDeleteStrategy = (groupIdx, stratIdx) => {
    const groups = [...editedProfile.strategyGroups];
    const strategies = groups[groupIdx].strategies.filter((_, i) => i !== stratIdx);
    if (strategies.length === 0) {
      // Remove the entire group if no strategies left
      setEditedProfile({
        ...editedProfile,
        strategyGroups: groups.filter((_, i) => i !== groupIdx)
      });
    } else {
      groups[groupIdx] = { ...groups[groupIdx], strategies };
      setEditedProfile({ ...editedProfile, strategyGroups: groups });
    }
  };

  // Add strategy to a group
  const handleAddStrategy = (groupIdx, type) => {
    const newStrategy = { type, weight: 0.25 };

    if (type === 'phonotactic') {
      newStrategy.domainId = entityConfig?.domain?.id || `${cultureId}_${entityKind}_domain`;
    } else if (type === 'grammar') {
      newStrategy.grammarId = entityConfig?.grammars?.[0]?.id || '';
    }

    const groups = [...editedProfile.strategyGroups];
    groups[groupIdx] = {
      ...groups[groupIdx],
      strategies: [...groups[groupIdx].strategies, newStrategy]
    };
    setEditedProfile({ ...editedProfile, strategyGroups: groups });
  };

  // Add a new group
  const handleAddGroup = (withConditions = false) => {
    const newGroup = {
      name: withConditions ? 'New Conditional Group' : 'New Group',
      priority: withConditions ? 50 : 0,
      conditions: withConditions ? { tags: [], prominence: [] } : null,
      strategies: []
    };
    setEditedProfile({
      ...editedProfile,
      strategyGroups: [...editedProfile.strategyGroups, newGroup]
    });
  };

  // Delete a group
  const handleDeleteGroup = (groupIdx) => {
    setEditedProfile({
      ...editedProfile,
      strategyGroups: editedProfile.strategyGroups.filter((_, i) => i !== groupIdx)
    });
  };

  // Update group priority
  const handlePriorityChange = (groupIdx, newPriority) => {
    const groups = [...editedProfile.strategyGroups];
    groups[groupIdx] = { ...groups[groupIdx], priority: parseInt(newPriority) || 0 };
    setEditedProfile({ ...editedProfile, strategyGroups: groups });
  };

  // Update group name
  const handleGroupNameChange = (groupIdx, newName) => {
    const groups = [...editedProfile.strategyGroups];
    groups[groupIdx] = { ...groups[groupIdx], name: newName };
    setEditedProfile({ ...editedProfile, strategyGroups: groups });
  };

  const handleTestNames = async (count = 10) => {
    if (!profile) return;

    setTestLoading(true);
    setTestError(null);
    setTestNames([]);
    setStrategyUsage(null);

    try {
      // Merge local + shared lexeme lists
      const localLexemes = entityConfig?.lexemeLists || {};
      const lexemes = { ...sharedLexemeLists, ...localLexemes };

      const response = await fetch(`${API_URL}/api/test-names`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId: profile.id,
          count,
          profile,
          domains: cultureDomains.length > 0 ? cultureDomains : (effectiveDomain ? [effectiveDomain] : []),
          grammars: entityConfig?.grammars || [],
          lexemes
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate test names');
      }

      const data = await response.json();
      setTestNames(data.names || []);
      setStrategyUsage(data.strategyUsage || null);
    } catch (err) {
      setTestError(err.message);
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0 }}>Naming Profile</h3>
        {profile && !editing && (
          <button className="secondary" onClick={handleStartEdit}>Edit Profile</button>
        )}
      </div>

      <p className="text-muted">
        Profile uses priority-based groups. Higher priority groups are evaluated first.
        Within a group, strategies are selected by weighted random.
      </p>

      {/* Auto-generate section */}
      <div style={{
        background: 'rgba(59, 130, 246, 0.1)',
        border: '1px solid rgba(59, 130, 246, 0.3)',
        borderRadius: '6px',
        padding: '1rem',
        marginTop: '1rem'
      }}>
        <p style={{ margin: 0, marginBottom: '1rem' }}>
          <strong>Auto-Generate Profile:</strong> Create a profile from your domain, lexemes, templates, and grammars.
        </p>
        <button className="primary" onClick={onAutoGenerate}>
          {profile ? 'Re-Generate Profile' : 'Auto-Generate Profile'}
        </button>
      </div>

      {/* Editing mode */}
      {editing && editedProfile && (
        <ProfileEditMode
          editedProfile={editedProfile}
          setEditedProfile={setEditedProfile}
          allDomains={allDomains}
          entityConfig={entityConfig}
          cultureId={cultureId}
          entityKind={entityKind}
          handleWeightChange={handleWeightChange}
          handleDeleteStrategy={handleDeleteStrategy}
          handleAddStrategy={handleAddStrategy}
          handleAddGroup={handleAddGroup}
          handleDeleteGroup={handleDeleteGroup}
          handlePriorityChange={handlePriorityChange}
          handleGroupNameChange={handleGroupNameChange}
          handleSave={handleSave}
          handleCancel={handleCancel}
          conditionsModalOpen={conditionsModalOpen}
          setConditionsModalOpen={setConditionsModalOpen}
          editingGroupIdx={editingGroupIdx}
          setEditingGroupIdx={setEditingGroupIdx}
        />
      )}

      {/* View mode - 2 column layout */}
      {!editing && profile && (
        <ProfileViewMode
          profile={profile}
          testNames={testNames}
          testLoading={testLoading}
          testError={testError}
          strategyUsage={strategyUsage}
          handleTestNames={handleTestNames}
        />
      )}

      {/* No profile yet */}
      {!editing && !profile && (
        <div className="info" style={{ marginTop: '1.5rem' }}>
          No profile configured yet. Click "Auto-Generate Profile" above to create one automatically.
        </div>
      )}
    </div>
  );
}

// Profile edit mode component
function ProfileEditMode({
  editedProfile,
  setEditedProfile,
  allDomains,
  entityConfig,
  cultureId,
  entityKind,
  handleWeightChange,
  handleDeleteStrategy,
  handleAddStrategy,
  handleAddGroup,
  handleDeleteGroup,
  handlePriorityChange,
  handleGroupNameChange,
  handleSave,
  handleCancel,
  conditionsModalOpen,
  setConditionsModalOpen,
  editingGroupIdx,
  setEditingGroupIdx
}) {
  return (
    <div style={{ marginTop: '1.5rem' }}>
      <h4>Edit Profile</h4>

      <div className="form-group">
        <label>Profile ID</label>
        <input
          value={editedProfile.id}
          onChange={(e) => setEditedProfile({ ...editedProfile, id: e.target.value })}
        />
      </div>

      <h4 style={{ marginTop: '1.5rem', marginBottom: '0.75rem' }}>
        Strategy Groups
        <span style={{ fontWeight: 'normal', fontSize: '0.875rem', marginLeft: '0.5rem', color: 'var(--arctic-frost)' }}>
          (evaluated by priority, highest first)
        </span>
      </h4>

      {editedProfile.strategyGroups?.length === 0 && (
        <div className="info" style={{ marginBottom: '1rem' }}>
          No groups yet. Add a group to define naming strategies.
        </div>
      )}

      {getSortedGroups(editedProfile.strategyGroups)?.map((group, displayIdx) => {
        // Find the actual index in the unsorted array for handlers
        const groupIdx = editedProfile.strategyGroups.findIndex(g => g === group);
        const groupTotalWeight = group.strategies.reduce((sum, s) => sum + s.weight, 0);

        return (
          <StrategyGroupEditor
            key={groupIdx}
            group={group}
            groupIdx={groupIdx}
            groupTotalWeight={groupTotalWeight}
            allDomains={allDomains}
            entityConfig={entityConfig}
            editedProfile={editedProfile}
            setEditedProfile={setEditedProfile}
            handleWeightChange={handleWeightChange}
            handleDeleteStrategy={handleDeleteStrategy}
            handleAddStrategy={handleAddStrategy}
            handleDeleteGroup={handleDeleteGroup}
            handlePriorityChange={handlePriorityChange}
            handleGroupNameChange={handleGroupNameChange}
            setConditionsModalOpen={setConditionsModalOpen}
            setEditingGroupIdx={setEditingGroupIdx}
          />
        );
      })}

      {/* Add group buttons */}
      <div style={{ marginTop: '1rem', marginBottom: '1.5rem' }}>
        <span style={{ fontSize: '0.875rem', marginRight: '0.75rem' }}>Add group:</span>
        <button
          className="secondary"
          style={{ marginRight: '0.5rem', fontSize: '0.875rem' }}
          onClick={() => handleAddGroup(false)}
        >
          + Default Group
        </button>
        <button
          className="secondary"
          style={{ fontSize: '0.875rem' }}
          onClick={() => handleAddGroup(true)}
        >
          + Conditional Group
        </button>
      </div>

      <div style={{ display: 'flex', gap: '1rem' }}>
        <button className="primary" onClick={handleSave}>Save Profile</button>
        <button className="secondary" onClick={handleCancel}>Cancel</button>
      </div>

      {/* Conditions Modal - for editing group conditions */}
      <ConditionsModal
        isOpen={conditionsModalOpen}
        onClose={() => {
          setConditionsModalOpen(false);
          setEditingGroupIdx(null);
        }}
        conditions={editingGroupIdx !== null ? editedProfile.strategyGroups[editingGroupIdx]?.conditions : undefined}
        onChange={(newConditions) => {
          if (editingGroupIdx !== null) {
            const groups = [...editedProfile.strategyGroups];
            groups[editingGroupIdx] = { ...groups[editingGroupIdx], conditions: newConditions || null };
            setEditedProfile({ ...editedProfile, strategyGroups: groups });
          }
        }}
      />
    </div>
  );
}

// Strategy group editor component
function StrategyGroupEditor({
  group,
  groupIdx,
  groupTotalWeight,
  allDomains,
  entityConfig,
  editedProfile,
  setEditedProfile,
  handleWeightChange,
  handleDeleteStrategy,
  handleAddStrategy,
  handleDeleteGroup,
  handlePriorityChange,
  handleGroupNameChange,
  setConditionsModalOpen,
  setEditingGroupIdx
}) {
  return (
    <div
      style={{
        background: group.conditions ? 'rgba(147, 51, 234, 0.15)' : 'rgba(59, 130, 246, 0.15)',
        border: `1px solid ${group.conditions ? 'rgba(147, 51, 234, 0.4)' : 'rgba(59, 130, 246, 0.4)'}`,
        borderRadius: '8px',
        padding: '1rem',
        marginBottom: '1rem'
      }}
    >
      {/* Group Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
          <input
            value={group.name || ''}
            onChange={(e) => handleGroupNameChange(groupIdx, e.target.value)}
            placeholder="Group name..."
            style={{ width: '150px', fontSize: '0.9rem', fontWeight: 'bold' }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--arctic-frost)' }}>Priority:</label>
            <input
              type="number"
              value={group.priority}
              onChange={(e) => handlePriorityChange(groupIdx, e.target.value)}
              style={{ width: '60px', fontSize: '0.85rem', textAlign: 'center' }}
            />
          </div>
        </div>
        <button
          className="danger"
          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
          onClick={() => handleDeleteGroup(groupIdx)}
        >
          Delete Group
        </button>
      </div>

      {/* Group Conditions */}
      <GroupConditionsDisplay
        group={group}
        groupIdx={groupIdx}
        editedProfile={editedProfile}
        setEditedProfile={setEditedProfile}
        setConditionsModalOpen={setConditionsModalOpen}
        setEditingGroupIdx={setEditingGroupIdx}
      />

      {/* Strategies in this group */}
      <div style={{ marginLeft: '0.5rem' }}>
        {group.strategies.length === 0 && (
          <div className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>
            No strategies in this group. Add one below.
          </div>
        )}

        {group.strategies.map((strategy, stratIdx) => (
          <StrategyEditor
            key={stratIdx}
            strategy={strategy}
            stratIdx={stratIdx}
            groupIdx={groupIdx}
            groupTotalWeight={groupTotalWeight}
            allDomains={allDomains}
            entityConfig={entityConfig}
            editedProfile={editedProfile}
            setEditedProfile={setEditedProfile}
            handleWeightChange={handleWeightChange}
            handleDeleteStrategy={handleDeleteStrategy}
          />
        ))}

        {/* Add strategy to group */}
        <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.5rem' }}>
          <button
            className="secondary"
            style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
            onClick={() => handleAddStrategy(groupIdx, 'phonotactic')}
          >
            + Phonotactic
          </button>
          <button
            className="secondary"
            style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
            onClick={() => handleAddStrategy(groupIdx, 'grammar')}
          >
            + Grammar
          </button>
        </div>
      </div>
    </div>
  );
}

// Group conditions display
function GroupConditionsDisplay({ group, groupIdx, editedProfile, setEditedProfile, setConditionsModalOpen, setEditingGroupIdx }) {
  return (
    <div style={{
      background: 'rgba(0,0,0,0.2)',
      padding: '0.5rem 0.75rem',
      borderRadius: '4px',
      marginBottom: '0.75rem',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      flexWrap: 'wrap'
    }}>
      <span style={{ fontSize: '0.8rem', color: 'var(--arctic-frost)' }}>Conditions:</span>
      {!group.conditions ? (
        <span style={{ fontSize: '0.8rem', color: 'var(--gold-accent)' }}>None (default fallback)</span>
      ) : (
        <>
          {group.conditions.tags?.length > 0 && (
            <span style={{
              background: 'rgba(59, 130, 246, 0.3)',
              padding: '0.15rem 0.4rem',
              borderRadius: '3px',
              fontSize: '0.7rem'
            }}>
              tags: {group.conditions.requireAllTags ? 'ALL' : 'any'}({group.conditions.tags.join(', ')})
            </span>
          )}
          {group.conditions.prominence?.length > 0 && (
            <span style={{
              background: 'rgba(147, 51, 234, 0.3)',
              padding: '0.15rem 0.4rem',
              borderRadius: '3px',
              fontSize: '0.7rem'
            }}>
              prominence: {group.conditions.prominence.join(', ')}
            </span>
          )}
          {group.conditions.subtype?.length > 0 && (
            <span style={{
              background: 'rgba(34, 197, 94, 0.3)',
              padding: '0.15rem 0.4rem',
              borderRadius: '3px',
              fontSize: '0.7rem'
            }}>
              subtype: {group.conditions.subtype.join(', ')}
            </span>
          )}
        </>
      )}
      <button
        type="button"
        style={{
          fontSize: '0.7rem',
          padding: '0.2rem 0.4rem',
          background: 'transparent',
          border: '1px solid var(--border-color)',
          borderRadius: '3px',
          cursor: 'pointer',
          color: 'var(--text-color)',
          marginLeft: 'auto'
        }}
        onClick={() => {
          setEditingGroupIdx(groupIdx);
          setConditionsModalOpen(true);
        }}
      >
        {group.conditions ? 'Edit' : '+ Add'}
      </button>
      {group.conditions && (
        <button
          type="button"
          style={{
            fontSize: '0.7rem',
            padding: '0.2rem 0.4rem',
            background: 'transparent',
            border: '1px solid rgba(239, 68, 68, 0.5)',
            borderRadius: '3px',
            cursor: 'pointer',
            color: 'rgba(239, 68, 68, 0.8)'
          }}
          onClick={() => {
            const groups = [...editedProfile.strategyGroups];
            groups[groupIdx] = { ...groups[groupIdx], conditions: null };
            setEditedProfile({ ...editedProfile, strategyGroups: groups });
          }}
        >
          Clear
        </button>
      )}
    </div>
  );
}

// Individual strategy editor
function StrategyEditor({
  strategy,
  stratIdx,
  groupIdx,
  groupTotalWeight,
  allDomains,
  entityConfig,
  editedProfile,
  setEditedProfile,
  handleWeightChange,
  handleDeleteStrategy
}) {
  return (
    <div
      style={{
        background: getStrategyColor(strategy.type),
        border: `1px solid ${getStrategyBorder(strategy.type)}`,
        borderRadius: '6px',
        padding: '0.75rem',
        marginBottom: '0.5rem'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <strong style={{ textTransform: 'capitalize', fontSize: '0.85rem' }}>{strategy.type}</strong>
          <span style={{
            background: 'rgba(0,0,0,0.3)',
            padding: '0.1rem 0.4rem',
            borderRadius: '4px',
            fontSize: '0.75rem',
            color: 'var(--gold-accent)'
          }}>
            {groupTotalWeight > 0 ? ((strategy.weight / groupTotalWeight) * 100).toFixed(0) : 0}%
          </span>
        </div>
        <button
          className="danger"
          style={{ padding: '0.15rem 0.4rem', fontSize: '0.7rem' }}
          onClick={() => handleDeleteStrategy(groupIdx, stratIdx)}
        >
          Remove
        </button>
      </div>

      {/* Weight slider */}
      <div style={{ marginBottom: '0.5rem' }}>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={strategy.weight}
          onChange={(e) => handleWeightChange(groupIdx, stratIdx, e.target.value)}
          style={{ width: '100%' }}
        />
      </div>

      {/* Strategy-specific fields */}
      {strategy.type === 'phonotactic' && (
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label style={{ fontSize: '0.8rem' }}>Domain</label>
          <select
            value={strategy.domainId || ''}
            onChange={(e) => {
              const groups = [...editedProfile.strategyGroups];
              const strategies = [...groups[groupIdx].strategies];
              strategies[stratIdx] = { ...strategies[stratIdx], domainId: e.target.value };
              groups[groupIdx] = { ...groups[groupIdx], strategies };
              setEditedProfile({ ...editedProfile, strategyGroups: groups });
            }}
            style={{ width: '100%', fontSize: '0.85rem' }}
          >
            <option value="">Select a domain...</option>
            {allDomains.map(d => (
              <option key={`${d.sourceCulture}_${d.id}`} value={d.id}>
                {d.id} ({d.sourceCulture})
              </option>
            ))}
          </select>
        </div>
      )}

      {strategy.type === 'grammar' && (
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label style={{ fontSize: '0.8rem' }}>Grammar ID</label>
          <select
            value={strategy.grammarId || ''}
            onChange={(e) => {
              const groups = [...editedProfile.strategyGroups];
              const strategies = [...groups[groupIdx].strategies];
              strategies[stratIdx] = { ...strategies[stratIdx], grammarId: e.target.value };
              groups[groupIdx] = { ...groups[groupIdx], strategies };
              setEditedProfile({ ...editedProfile, strategyGroups: groups });
            }}
            style={{ width: '100%', fontSize: '0.85rem' }}
          >
            <option value="">Select a grammar...</option>
            {(entityConfig?.grammars || []).map(g => (
              <option key={g.id} value={g.id}>{g.id}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

// Profile view mode component
function ProfileViewMode({ profile, testNames, testLoading, testError, strategyUsage, handleTestNames }) {
  return (
    <div style={{
      marginTop: '1.5rem',
      display: 'grid',
      gridTemplateColumns: '1fr 300px',
      gap: '1.5rem',
      alignItems: 'start'
    }}>
      {/* Left column - Profile strategy groups */}
      <div>
        <h4 style={{ marginTop: 0, marginBottom: '0.75rem' }}>
          Strategy Groups
          <code style={{ marginLeft: '0.5rem', fontSize: '0.75rem', fontWeight: 'normal' }}>{profile.id}</code>
        </h4>

        {profile.strategyGroups?.length > 0 ? (
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {getSortedGroups(profile.strategyGroups).map((group, idx) => {
              const groupTotalWeight = group.strategies.reduce((sum, s) => sum + s.weight, 0);
              return (
                <div
                  key={idx}
                  style={{
                    background: group.conditions ? 'rgba(147, 51, 234, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                    border: `1px solid ${group.conditions ? 'rgba(147, 51, 234, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`,
                    borderRadius: '6px',
                    padding: '0.75rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <strong style={{ fontSize: '0.85rem' }}>{group.name || 'Unnamed Group'}</strong>
                      <span style={{
                        background: 'rgba(0,0,0,0.3)',
                        padding: '0.1rem 0.4rem',
                        borderRadius: '4px',
                        fontSize: '0.7rem',
                        color: 'var(--arctic-frost)'
                      }}>
                        priority: {group.priority}
                      </span>
                    </div>
                    {!group.conditions && (
                      <span style={{ fontSize: '0.7rem', color: 'var(--gold-accent)' }}>fallback</span>
                    )}
                  </div>

                  {/* Group conditions */}
                  {group.conditions && (
                    <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                      {group.conditions.tags?.length > 0 && (
                        <span style={{
                          background: 'rgba(59, 130, 246, 0.3)',
                          padding: '0.1rem 0.35rem',
                          borderRadius: '3px',
                          fontSize: '0.65rem'
                        }}>
                          tags: {group.conditions.tags.join(', ')}
                        </span>
                      )}
                      {group.conditions.prominence?.length > 0 && (
                        <span style={{
                          background: 'rgba(147, 51, 234, 0.3)',
                          padding: '0.1rem 0.35rem',
                          borderRadius: '3px',
                          fontSize: '0.65rem'
                        }}>
                          {group.conditions.prominence.join(', ')}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Strategies in group */}
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                    {group.strategies.map((strategy, sIdx) => (
                      <span
                        key={sIdx}
                        style={{
                          background: getStrategyColor(strategy.type),
                          border: `1px solid ${getStrategyBorder(strategy.type)}`,
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem'
                        }}
                      >
                        <span style={{ textTransform: 'capitalize' }}>{strategy.type}</span>
                        <span style={{ color: 'var(--gold-accent)', fontWeight: 'bold' }}>
                          {groupTotalWeight > 0 ? ((strategy.weight / groupTotalWeight) * 100).toFixed(0) : 0}%
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="info">No strategy groups configured.</div>
        )}
      </div>

      {/* Right column - Test Panel */}
      <TestNamesPanel
        testNames={testNames}
        testLoading={testLoading}
        testError={testError}
        strategyUsage={strategyUsage}
        handleTestNames={handleTestNames}
      />
    </div>
  );
}

// Test names panel
function TestNamesPanel({ testNames, testLoading, testError, strategyUsage, handleTestNames }) {
  return (
    <div style={{
      background: 'rgba(30, 58, 95, 0.3)',
      border: '1px solid rgba(59, 130, 246, 0.3)',
      borderRadius: '8px',
      padding: '1rem',
      position: 'sticky',
      top: '1rem'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <h4 style={{ margin: 0, fontSize: '0.95rem' }}>Test Names</h4>
        <button
          className="primary"
          onClick={() => handleTestNames(10)}
          disabled={testLoading}
          style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
        >
          {testLoading ? '...' : 'Generate'}
        </button>
      </div>

      {testError && (
        <div className="error" style={{ marginBottom: '0.75rem', fontSize: '0.8rem', padding: '0.5rem' }}>
          {testError}
        </div>
      )}

      {strategyUsage && (
        <div style={{
          background: 'rgba(0,0,0,0.2)',
          borderRadius: '4px',
          padding: '0.5rem',
          marginBottom: '0.75rem',
          fontSize: '0.75rem'
        }}>
          {Object.entries(strategyUsage)
            .filter(([, count]) => count > 0)
            .map(([strategy, count]) => (
              <span key={strategy} style={{
                display: 'inline-block',
                marginRight: '0.5rem',
                color: strategy === 'phonotactic' ? 'rgba(96, 165, 250, 1)' :
                       strategy === 'grammar' ? 'rgba(167, 139, 250, 1)' :
                       'rgba(74, 222, 128, 1)'
              }}>
                {strategy}: {count}
              </span>
            ))}
        </div>
      )}

      {testNames.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', maxHeight: '400px', overflowY: 'auto' }}>
          {testNames.map((name, i) => (
            <div
              key={i}
              style={{
                background: 'rgba(20, 45, 75, 0.5)',
                padding: '0.5rem 0.75rem',
                borderRadius: '4px',
                fontFamily: 'monospace',
                fontSize: '0.9rem',
                color: 'var(--gold-accent)'
              }}
            >
              {name}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-muted" style={{ fontSize: '0.8rem', margin: 0 }}>
          Click Generate to test your profile
        </p>
      )}
    </div>
  );
}

export default ProfileTab;

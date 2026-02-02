/**
 * ProfileModal - Tabbed modal for editing naming profiles
 *
 * Dynamic tabs: Overview, [each strategy group], Test
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { ModalShell } from '@penguin-tales/shared-components';
import { OverviewTab, SingleGroupTab, TestTab } from './tabs';

export default function ProfileModal({
  profile,
  isNew,
  onSave,
  onClose,
  onDelete,
  onDuplicate,
  cultureConfig,
  worldSchema,
  onAddTag,
  generatorUsage,
}) {
  const [activeTab, setActiveTab] = useState('overview');
  const [editedProfile, setEditedProfile] = useState(null);

  // Autosave refs
  const autosaveTimeoutRef = useRef(null);
  const lastSavedRef = useRef(null);

  // Initialize edited profile
  useEffect(() => {
    if (profile) {
      setEditedProfile(JSON.parse(JSON.stringify(profile)));
      lastSavedRef.current = JSON.stringify(profile);
    }
  }, [profile]);

  // Autosave effect
  useEffect(() => {
    if (!editedProfile) return;

    const profileStr = JSON.stringify(editedProfile);
    if (profileStr === lastSavedRef.current) return;

    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
    }

    autosaveTimeoutRef.current = setTimeout(() => {
      handleSave(editedProfile);
      lastSavedRef.current = profileStr;
    }, 1000);

    return () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }
    };
  }, [editedProfile]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }
    };
  }, []);

  // Build dynamic tabs based on strategy groups
  const tabs = useMemo(() => {
    if (!editedProfile) return [];

    const dynamicTabs = [
      { id: 'overview', label: 'Overview', icon: '📋' },
    ];

    // Add a tab for each strategy group
    (editedProfile.strategyGroups || []).forEach((group, idx) => {
      const isConditional = !!group.conditions;
      dynamicTabs.push({
        id: `group-${idx}`,
        label: group.name || `Group ${idx + 1}`,
        icon: isConditional ? '🎯' : '📦',
      });
    });

    dynamicTabs.push({ id: 'test', label: 'Test', icon: '🧪' });

    return dynamicTabs;
  }, [editedProfile]);

  const handleSave = (profileToSave) => {
    // Normalize weights within each group
    const normalizedGroups = (profileToSave.strategyGroups || []).map((group) => {
      const totalWeight = group.strategies.reduce((sum, s) => sum + s.weight, 0);
      return {
        ...group,
        strategies: group.strategies.map((s) => ({
          ...s,
          weight: totalWeight > 0 ? s.weight / totalWeight : 1 / Math.max(group.strategies.length, 1),
        })),
      };
    });

    const updatedProfile = {
      ...profileToSave,
      strategyGroups: normalizedGroups,
    };

    onSave(updatedProfile, isNew);
  };

  const handleClose = () => {
    // Save any pending changes before closing
    if (editedProfile && JSON.stringify(editedProfile) !== lastSavedRef.current) {
      handleSave(editedProfile);
    }
    onClose();
  };

  const handleDelete = () => {
    if (confirm(`Delete profile "${editedProfile?.id}"?`)) {
      onDelete(editedProfile?.id);
      onClose();
    }
  };

  const handleDuplicate = () => {
    // Save any pending changes first
    if (editedProfile && JSON.stringify(editedProfile) !== lastSavedRef.current) {
      handleSave(editedProfile);
    }
    onDuplicate(editedProfile);
  };

  const handleAddGroup = (withConditions = false) => {
    const newGroup = {
      name: withConditions ? 'Conditional' : 'Default',
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
    const updated = {
      ...editedProfile,
      strategyGroups: [...(editedProfile.strategyGroups || []), newGroup],
    };
    setEditedProfile(updated);
    // Switch to the new group's tab
    setActiveTab(`group-${updated.strategyGroups.length - 1}`);
  };

  const handleDeleteGroup = (groupIdx) => {
    const updated = {
      ...editedProfile,
      strategyGroups: editedProfile.strategyGroups.filter((_, i) => i !== groupIdx),
    };
    setEditedProfile(updated);
    // Switch to overview if we deleted the current tab
    if (activeTab === `group-${groupIdx}`) {
      setActiveTab('overview');
    }
  };

  const handleGroupChange = (groupIdx, updatedGroup) => {
    const groups = [...editedProfile.strategyGroups];
    groups[groupIdx] = updatedGroup;
    setEditedProfile({ ...editedProfile, strategyGroups: groups });
  };

  if (!editedProfile) return null;

  const naming = cultureConfig?.naming || {};
  const domains = naming.domains || [];
  const grammars = naming.grammars || [];
  const entityKinds = worldSchema?.entityKinds?.map((e) => e.kind) || [];
  const tagRegistry = worldSchema?.tagRegistry || [];

  const renderTabContent = () => {
    if (activeTab === 'overview') {
      return (
        <OverviewTab
          profile={editedProfile}
          onChange={setEditedProfile}
          onDelete={handleDelete}
          onDuplicate={handleDuplicate}
          onNavigateToGroup={(idx) => setActiveTab(`group-${idx}`)}
          generatorUsage={generatorUsage}
          entityKinds={entityKinds}
        />
      );
    }

    if (activeTab === 'test') {
      return (
        <TestTab
          profile={editedProfile}
          cultureConfig={cultureConfig}
        />
      );
    }

    // Check if it's a group tab
    if (activeTab.startsWith('group-')) {
      const groupIdx = parseInt(activeTab.replace('group-', ''), 10);
      const group = editedProfile.strategyGroups?.[groupIdx];
      if (group) {
        return (
          <SingleGroupTab
            group={group}
            groupIdx={groupIdx}
            onChange={(updated) => handleGroupChange(groupIdx, updated)}
            onDelete={() => handleDeleteGroup(groupIdx)}
            domains={domains}
            grammars={grammars}
            entityKinds={entityKinds}
            worldSchema={worldSchema}
            tagRegistry={tagRegistry}
            onAddTag={onAddTag}
          />
        );
      }
    }

    return null;
  };

  // Sidebar footer with add group buttons
  const renderSidebarFooter = () => (
    <div className="profile-modal-footer">
      <button
        className="add-group-btn"
        onClick={() => handleAddGroup(false)}
        title="Add default group"
      >
        + Default
      </button>
      <button
        className="add-group-btn conditional"
        onClick={() => handleAddGroup(true)}
        title="Add conditional group"
      >
        + Conditional
      </button>
    </div>
  );

  return (
    <ModalShell
      onClose={handleClose}
      icon="📝"
      title={isNew ? 'New Profile' : editedProfile.id}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      sidebarFooter={renderSidebarFooter()}
      className="profile-modal"
    >
      {renderTabContent()}
    </ModalShell>
  );
}

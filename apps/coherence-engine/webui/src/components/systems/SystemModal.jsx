/**
 * SystemModal - Modal for editing system configuration
 */

import React, { useState, useMemo } from 'react';
import { SYSTEM_TYPES } from './constants';
import { ModalShell } from '../shared';
import {
  OverviewTab,
  CommonSettingsTab,
  GraphContagionTab,
  ConnectionEvolutionTab,
  ThresholdTriggerTab,
  ClusterFormationTab,
  TagDiffusionTab,
  PlaneDiffusionTab,
  FrameworkSystemTab,
} from './tabs';

/**
 * @param {Object} props
 * @param {Object} props.system - The system being edited
 * @param {Function} props.onChange - Called when system changes
 * @param {Function} props.onClose - Called to close the modal
 * @param {Function} props.onDelete - Called to delete the system
 * @param {Object} props.schema - Domain schema
 * @param {Array} props.pressures - Available pressure definitions
 */
export function SystemModal({ system, onChange, onClose, onDelete, schema, pressures }) {
  const [activeTab, setActiveTab] = useState('overview');
  const typeConfig = SYSTEM_TYPES[system.systemType] || {};

  const isFrameworkSystem = ['eraSpawner', 'eraTransition', 'universalCatalyst', 'relationshipMaintenance'].includes(system.systemType);

  // Build tabs dynamically based on system type
  const tabs = useMemo(() => {
    const result = [
      { id: 'overview', label: 'Overview', icon: '📋' },
      { id: 'common', label: 'Settings', icon: '⚙️' },
    ];

    // Add type-specific tab
    if (!isFrameworkSystem) {
      switch (system.systemType) {
        case 'graphContagion':
          result.push({ id: 'type', label: 'Contagion', icon: '🦠' });
          break;
        case 'connectionEvolution':
          result.push({ id: 'type', label: 'Evolution', icon: '🔄' });
          break;
        case 'thresholdTrigger':
          result.push({ id: 'type', label: 'Trigger', icon: '⚡' });
          break;
        case 'clusterFormation':
          result.push({ id: 'type', label: 'Clustering', icon: '🔲' });
          break;
        case 'tagDiffusion':
          result.push({ id: 'type', label: 'Diffusion', icon: '🏷️' });
          break;
        case 'planeDiffusion':
          result.push({ id: 'type', label: 'Plane', icon: '🗺️' });
          break;
      }
    } else {
      result.push({ id: 'type', label: 'Framework', icon: '🔧' });
    }

    return result;
  }, [system.systemType, isFrameworkSystem]);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewTab system={system} onChange={onChange} onDelete={onDelete} />;
      case 'common':
        return <CommonSettingsTab system={system} onChange={onChange} schema={schema} pressures={pressures} />;
      case 'type':
        if (isFrameworkSystem) {
          return <FrameworkSystemTab system={system} onChange={onChange} />;
        }
        switch (system.systemType) {
          case 'graphContagion':
            return <GraphContagionTab system={system} onChange={onChange} schema={schema} />;
          case 'connectionEvolution':
            return <ConnectionEvolutionTab system={system} onChange={onChange} schema={schema} />;
          case 'thresholdTrigger':
            return <ThresholdTriggerTab system={system} onChange={onChange} schema={schema} pressures={pressures} />;
          case 'clusterFormation':
            return <ClusterFormationTab system={system} onChange={onChange} schema={schema} />;
          case 'tagDiffusion':
            return <TagDiffusionTab system={system} onChange={onChange} schema={schema} />;
          case 'planeDiffusion':
            return <PlaneDiffusionTab system={system} onChange={onChange} schema={schema} />;
          default:
            return null;
        }
      default:
        return null;
    }
  };

  return (
    <ModalShell
      onClose={onClose}
      icon={typeConfig.icon}
      title={system.config?.name || system.config?.id}
      disabled={system.enabled === false}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      tabClassName="se-tab-btn"
    >
      {renderTabContent()}
    </ModalShell>
  );
}

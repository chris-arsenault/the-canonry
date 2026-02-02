/**
 * ActionModal - Modal for editing action configuration
 */

import React, { useState } from 'react';
import { TABS } from '../constants';
import { ModalShell } from '../../shared';
import {
  OverviewTab,
  ActorTab,
  InstigatorTab,
  TargetingTab,
  VariablesTab,
  OutcomeTab,
  ProbabilityTab,
} from '../tabs';

export function ActionModal({ action, onChange, onClose, onDelete, schema, pressures }) {
  const [activeTab, setActiveTab] = useState('overview');

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewTab action={action} onChange={onChange} onDelete={onDelete} />;
      case 'actor':
        return <ActorTab action={action} onChange={onChange} schema={schema} pressures={pressures} />;
      case 'instigator':
        return <InstigatorTab action={action} onChange={onChange} schema={schema} />;
      case 'targeting':
        return <TargetingTab action={action} onChange={onChange} schema={schema} />;
      case 'variables':
        return <VariablesTab action={action} onChange={onChange} schema={schema} />;
      case 'outcome':
        return <OutcomeTab action={action} onChange={onChange} schema={schema} pressures={pressures} />;
      case 'probability':
        return <ProbabilityTab action={action} onChange={onChange} pressures={pressures} />;
      default:
        return null;
    }
  };

  return (
    <ModalShell
      onClose={onClose}
      icon="🎭"
      title={action.name || action.id}
      disabled={action.enabled === false}
      tabs={TABS}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      tabClassName="ae-tab-btn"
    >
      {renderTabContent()}
    </ModalShell>
  );
}

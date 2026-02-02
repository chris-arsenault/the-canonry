/**
 * GeneratorModal - Modal for editing a generator
 */

import React, { useState, useMemo, useCallback } from 'react';
import { getElementValidation } from '@penguin-tales/shared-components';
import { TABS } from './constants';
import { ModalShell, TabValidationBadge, OrphanBadge } from '../shared';
import {
  OverviewTab,
  TargetTab,
  VariablesTab,
  CreationTab,
  RelationshipsTab,
  EffectsTab,
  ApplicabilityTab,
} from './tabs';

// Helper to compute validation issues per generator tab
function computeTabValidation(generator, usageMap) {
  const validation = usageMap ? getElementValidation(usageMap, 'generator', generator.id) : { invalidRefs: [], isOrphan: false };

  const tabErrors = {
    overview: 0,
    applicability: 0,
    target: 0,
    variables: 0,
    creation: 0,
    relationships: 0,
    effects: 0,
  };

  validation.invalidRefs.forEach(ref => {
    if (ref.field.includes('applicability')) tabErrors.applicability++;
    else if (ref.field.includes('selection') || ref.field.includes('target')) tabErrors.target++;
    else if (ref.field.includes('creation')) tabErrors.creation++;
    else if (ref.field.includes('relationships')) tabErrors.relationships++;
    else if (ref.field.includes('stateUpdates') || ref.field.includes('pressure')) tabErrors.effects++;
  });

  return { tabErrors, isOrphan: validation.isOrphan, totalErrors: validation.invalidRefs.length };
}

export function GeneratorModal({ generator, onChange, onClose, onDelete, onDuplicate, schema, pressures, eras, usageMap, tagRegistry = [] }) {
  const [activeTab, setActiveTab] = useState('overview');

  const tabValidation = useMemo(() =>
    computeTabValidation(generator, usageMap),
    [generator, usageMap]
  );

  const renderTabBadge = useCallback((tabId) => {
    return <TabValidationBadge count={tabValidation.tabErrors[tabId]} />;
  }, [tabValidation.tabErrors]);

  const sidebarFooter = tabValidation.isOrphan ? (
    <div className="orphan-badge-container">
      <OrphanBadge isOrphan={true} />
    </div>
  ) : null;

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewTab generator={generator} onChange={onChange} onDelete={onDelete} onDuplicate={onDuplicate} />;
      case 'applicability':
        return <ApplicabilityTab generator={generator} onChange={onChange} schema={schema} pressures={pressures} eras={eras} />;
      case 'target':
        return <TargetTab generator={generator} onChange={onChange} schema={schema} />;
      case 'variables':
        return <VariablesTab generator={generator} onChange={onChange} schema={schema} />;
      case 'creation':
        return <CreationTab generator={generator} onChange={onChange} schema={schema} tagRegistry={tagRegistry} pressures={pressures} />;
      case 'relationships':
        return <RelationshipsTab generator={generator} onChange={onChange} schema={schema} />;
      case 'effects':
        return <EffectsTab generator={generator} onChange={onChange} pressures={pressures} schema={schema} />;
      default:
        return null;
    }
  };

  return (
    <ModalShell
      onClose={onClose}
      icon="⚙️"
      title={generator.name || generator.id}
      disabled={generator.enabled === false}
      tabs={TABS}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      renderTabBadge={renderTabBadge}
      sidebarFooter={sidebarFooter}
    >
      {renderTabContent()}
    </ModalShell>
  );
}

export default GeneratorModal;

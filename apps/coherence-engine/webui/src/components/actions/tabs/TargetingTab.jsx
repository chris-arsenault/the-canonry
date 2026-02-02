/**
 * TargetingTab - Target selection configuration
 */

import React from 'react';
import SelectionRuleEditor from '../../shared/SelectionRuleEditor';

export function TargetingTab({ action, onChange, schema }) {
  const targeting = action.targeting || { strategy: 'by_kind' };

  const updateTargeting = (updated) => {
    onChange({
      ...action,
      targeting: updated,
    });
  };

  // Available refs for selection filters (action context)
  const availableRefs = ['$actor', '$instigator'];

  return (
    <div>
      <div className="info-box">
        <div className="info-box-title">Target Selection</div>
        <div className="info-box-text">
          Define how valid targets are selected for this action.
        </div>
      </div>

      <div className="section">
        <div className="section-title">🎯 Target Selection</div>
        <SelectionRuleEditor
          value={targeting}
          onChange={updateTargeting}
          schema={schema}
          availableRefs={availableRefs}
        />
      </div>
    </div>
  );
}

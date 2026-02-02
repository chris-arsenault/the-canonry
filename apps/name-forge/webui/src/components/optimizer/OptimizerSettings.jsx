import React from 'react';
import { NumberInput } from '@penguin-tales/shared-components';
import { ALGORITHMS } from './constants';

/**
 * OptimizerSettings - Right panel for algorithm settings and optimization controls
 */
export default function OptimizerSettings({
  algorithm,
  onAlgorithmChange,
  algorithmParams,
  onAlgorithmParamsChange,
  validationSettings,
  onValidationSettingsChange,
  fitnessWeights,
  onFitnessWeightsChange,
  selectedDomains,
  allDomains,
  optimizing,
  progress,
  results,
  onOptimize,
  onSaveResults,
  onShowModal,
}) {
  // Render algorithm parameter inputs
  const renderAlgorithmParams = () => {
    const config = ALGORITHMS[algorithm];
    if (!config?.params || Object.keys(config.params).length === 0) {
      return <p className="text-muted text-small italic">No additional parameters for this algorithm.</p>;
    }

    return (
      <div className="optimizer-param-grid">
        {Object.entries(config.params).map(([key, param]) => (
          <div key={key} className="flex flex-col gap-xs">
            <label className="text-small">{param.label}</label>
            <NumberInput
              value={algorithmParams[key] ?? param.default}
              onChange={(v) => onAlgorithmParamsChange(prev => ({ ...prev, [key]: v ?? param.default }))}
              min={param.min}
              max={param.max}
              step={param.step || 1}
              className="optimizer-input"
            />
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="optimizer-main">
      {/* Settings */}
      <div className="optimizer-settings-area">
        <h2 className="mt-0 mb-md">Optimizer Settings</h2>

        {/* Algorithm Selection */}
        <div className="mb-lg">
          <h3 className="section-title">Algorithm</h3>
          <div className="algorithm-grid">
            {Object.entries(ALGORITHMS).map(([key, config]) => (
              <div
                key={key}
                onClick={() => onAlgorithmChange(key)}
                className={`algorithm-card ${algorithm === key ? 'selected' : ''}`}
              >
                <div className={`algorithm-name ${algorithm === key ? 'selected' : ''}`}>{config.name}</div>
                <div className="algorithm-desc">
                  {config.description}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Algorithm-Specific Parameters */}
        <div className="mb-lg">
          <h3 className="section-title">Algorithm Parameters</h3>
          {renderAlgorithmParams()}
        </div>

        {/* Validation Settings */}
        <div className="mb-lg">
          <h3 className="section-title">Validation Settings</h3>
          <div className="optimizer-param-grid-small">
            <div className="flex flex-col gap-xs">
              <label className="text-small">Sample Size</label>
              <NumberInput
                value={validationSettings.requiredNames}
                onChange={(v) => onValidationSettingsChange(prev => ({ ...prev, requiredNames: v ?? 500 }))}
                min={100}
                max={5000}
                className="optimizer-input"
                integer
              />
            </div>
            <div className="flex flex-col gap-xs">
              <label className="text-small">Sample Factor</label>
              <NumberInput
                value={validationSettings.sampleFactor}
                onChange={(v) => onValidationSettingsChange(prev => ({ ...prev, sampleFactor: v ?? 10 }))}
                min={1}
                max={50}
                className="optimizer-input"
                integer
              />
            </div>
          </div>
        </div>

        {/* Fitness Weights */}
        <div className="mb-lg">
          <h3 className="section-title">Fitness Weights</h3>
          <div className="fitness-grid">
            {[
              { key: 'capacity', label: 'Capacity', title: 'Entropy / collision rate' },
              { key: 'diffuseness', label: 'Diffuseness', title: 'Intra-domain variation' },
              { key: 'separation', label: 'Separation', title: 'Inter-domain distinctiveness' },
              { key: 'pronounceability', label: 'Pronounce', title: 'Phonetic naturalness' },
              { key: 'length', label: 'Length', title: 'Target length adherence' },
              { key: 'style', label: 'Style', title: 'LLM style judge (optional)' },
            ].map(({ key, label, title }) => (
              <div key={key} className="flex flex-col gap-xs">
                <label className="text-small" title={title}>{label}</label>
                <NumberInput
                  step={0.1}
                  min={0}
                  max={1}
                  value={fitnessWeights[key]}
                  onChange={(v) => onFitnessWeightsChange(prev => ({ ...prev, [key]: v ?? 0 }))}
                  title={title}
                  disabled={key === 'separation' && allDomains.length <= 1}
                  className={`optimizer-input ${key === 'separation' && allDomains.length <= 1 ? 'disabled' : ''}`}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Run Button */}
        <div className="flex gap-md align-center flex-wrap">
          <button
            onClick={onOptimize}
            disabled={optimizing || selectedDomains.size === 0}
            className={`optimize-button ${optimizing || selectedDomains.size === 0 ? 'disabled' : ''}`}
          >
            {optimizing ? 'Optimizing...' : `Optimize ${selectedDomains.size} Domain(s)`}
          </button>

          {results.length > 0 && results.some(r => r.success) && (
            <button
              onClick={onSaveResults}
              className="secondary optimize-action-button"
            >
              Save Results
            </button>
          )}

          {optimizing && (
            <span className="text-small text-muted">
              {progress.current}/{progress.total}: {progress.currentDomain}
            </span>
          )}
        </div>
      </div>

      {/* Status Bar - Shows when there are results */}
      {results.length > 0 && !optimizing && (
        <div className="optimizer-status-bar">
          <div className="flex align-center gap-md">
            <span className="text-small">
              Last run: <strong className="text-success">{results.filter(r => r.success).length}</strong> succeeded,{' '}
              <strong className={results.some(r => !r.success) ? 'text-danger' : ''}>{results.filter(r => !r.success).length}</strong> failed
            </span>
            {results.filter(r => r.success).length > 0 && (
              <span className="text-gold font-bold text-small">
                Avg improvement: +{(results.filter(r => r.success).reduce((sum, r) => sum + (r.improvement || 0), 0) / results.filter(r => r.success).length * 100).toFixed(1)}%
              </span>
            )}
          </div>
          <button
            onClick={onShowModal}
            className="secondary text-small"
          >
            View Details
          </button>
        </div>
      )}
    </div>
  );
}

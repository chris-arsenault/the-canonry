import React, { useState, useEffect, useMemo } from 'react';
import { optimizeDomain as runOptimizer } from '../../lib/browser-optimizer.js';
import { ALGORITHMS } from './constants';
import DomainSelector from './DomainSelector';
import OptimizerSettings from './OptimizerSettings';
import ResultsModal from './ResultsModal';

/**
 * Optimizer Workshop - Dedicated UI for domain optimization
 * Now runs entirely in the browser (no server required)
 */
export default function OptimizerWorkshop({ cultures, onCulturesChange }) {
  // Domain selection state
  const [selectedDomains, setSelectedDomains] = useState(new Set());
  const [expandedCultures, setExpandedCultures] = useState(new Set());

  // Algorithm and settings state
  const [algorithm, setAlgorithm] = useState('hillclimb');
  const [algorithmParams, setAlgorithmParams] = useState({});
  const [validationSettings, setValidationSettings] = useState({
    requiredNames: 500,
    sampleFactor: 10,
  });
  const [fitnessWeights, setFitnessWeights] = useState({
    capacity: 0.2,
    diffuseness: 0.2,
    separation: 0.2,
    pronounceability: 0.3,
    length: 0.1,
    style: 0.0,
  });

  // Optimization state
  const [optimizing, setOptimizing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, currentDomain: '' });
  const [results, setResults] = useState([]);
  const [logs, setLogs] = useState([]);
  const [showModal, setShowModal] = useState(false);

  // Collect all domains from all cultures
  const allDomains = useMemo(() => {
    const domains = [];
    Object.entries(cultures || {}).forEach(([cultureId, culture]) => {
      const naming = culture?.naming || {};
      (naming.domains || []).forEach(domain => {
        domains.push({
          ...domain,
          cultureId,
          cultureName: culture.name || cultureId,
        });
      });
    });
    return domains;
  }, [cultures]);

  // Initialize algorithm params when algorithm changes
  useEffect(() => {
    const config = ALGORITHMS[algorithm];
    if (config?.params) {
      const defaults = {};
      Object.entries(config.params).forEach(([key, param]) => {
        defaults[key] = param.default;
      });
      setAlgorithmParams(defaults);
    }
  }, [algorithm]);

  // Toggle culture expansion
  const toggleCulture = (cultureId) => {
    setExpandedCultures(prev => {
      const next = new Set(prev);
      if (next.has(cultureId)) {
        next.delete(cultureId);
      } else {
        next.add(cultureId);
      }
      return next;
    });
  };

  // Toggle domain selection
  const toggleDomain = (domainId) => {
    setSelectedDomains(prev => {
      const next = new Set(prev);
      if (next.has(domainId)) {
        next.delete(domainId);
      } else {
        next.add(domainId);
      }
      return next;
    });
  };

  // Select/deselect all domains in a culture
  const toggleAllInCulture = (cultureId) => {
    const cultureDomains = allDomains.filter(d => d.cultureId === cultureId);
    const allSelected = cultureDomains.every(d => selectedDomains.has(d.id));

    setSelectedDomains(prev => {
      const next = new Set(prev);
      cultureDomains.forEach(d => {
        if (allSelected) {
          next.delete(d.id);
        } else {
          next.add(d.id);
        }
      });
      return next;
    });
  };

  // Select all domains
  const selectAll = () => {
    setSelectedDomains(new Set(allDomains.map(d => d.id)));
  };

  // Deselect all domains
  const deselectAll = () => {
    setSelectedDomains(new Set());
  };

  // Add log entry
  const addLog = (message, type = 'info') => {
    setLogs(prev => [...prev, { message, type, timestamp: new Date().toISOString() }]);
  };

  // Run optimization (now runs in browser, no API needed)
  const handleOptimize = async () => {
    const domainsToOptimize = allDomains.filter(d => selectedDomains.has(d.id));

    if (domainsToOptimize.length === 0) {
      addLog('No domains selected', 'error');
      return;
    }

    setOptimizing(true);
    setResults([]);
    setLogs([]);
    setProgress({ current: 0, total: domainsToOptimize.length, currentDomain: '' });
    setShowModal(true);

    addLog(`Starting optimization of ${domainsToOptimize.length} domain(s) using ${ALGORITHMS[algorithm].name}`, 'info');
    addLog('Running in browser (no server required)', 'info');

    const newResults = [];

    for (let i = 0; i < domainsToOptimize.length; i++) {
      const domain = domainsToOptimize[i];
      setProgress({ current: i + 1, total: domainsToOptimize.length, currentDomain: domain.id });
      addLog(`[${i + 1}/${domainsToOptimize.length}] Optimizing ${domain.id}...`, 'info');

      try {
        // Get all sibling domains for separation metric
        const siblingDomains = allDomains.filter(d => d.id !== domain.id);

        // Progress callback for real-time updates
        const onProgress = (message) => {
          addLog(`  ${message}`, 'info');
        };

        // Run optimizer directly in browser
        const optimizationResult = await runOptimizer(
          domain,
          validationSettings,
          fitnessWeights,
          {
            algorithm,
            ...algorithmParams,
          },
          siblingDomains,
          onProgress
        );

        const result = {
          domainId: domain.id,
          cultureId: domain.cultureId,
          initialFitness: optimizationResult.initialFitness,
          finalFitness: optimizationResult.finalFitness,
          improvement: optimizationResult.improvement,
          initialConfig: optimizationResult.initialConfig || domain,
          optimizedConfig: optimizationResult.optimizedConfig,
          success: true,
        };
        newResults.push(result);
        addLog(`  ${domain.id}: ${(result.initialFitness || 0).toFixed(3)} -> ${(result.finalFitness || 0).toFixed(3)} (+${((result.improvement || 0) * 100).toFixed(1)}%)`, 'success');
      } catch (error) {
        newResults.push({
          domainId: domain.id,
          cultureId: domain.cultureId,
          error: error.message,
          success: false,
        });
        addLog(`  ${domain.id}: Error - ${error.message}`, 'error');
      }
    }

    setResults(newResults);
    setOptimizing(false);
    setProgress({ current: 0, total: 0, currentDomain: '' });

    const successCount = newResults.filter(r => r.success).length;
    addLog(`Optimization complete: ${successCount}/${domainsToOptimize.length} succeeded`, successCount === domainsToOptimize.length ? 'success' : 'warning');
  };

  // Save results to local storage (IndexedDB)
  const handleSaveResults = async () => {
    const successfulResults = results.filter(r => r.success);
    if (successfulResults.length === 0) {
      addLog('No successful results to save', 'error');
      return;
    }

    if (!onCulturesChange) {
      addLog('Cannot save: no storage handler provided', 'error');
      return;
    }

    addLog(`Saving ${successfulResults.length} optimized domain(s) to browser storage...`, 'info');

    // Group by culture
    const byCulture = {};
    successfulResults.forEach(r => {
      if (!byCulture[r.cultureId]) {
        byCulture[r.cultureId] = [];
      }
      byCulture[r.cultureId].push(r);
    });

    // Build updated cultures object
    const updatedCultures = { ...cultures };

    for (const [cultureId, cultureResults] of Object.entries(byCulture)) {
      const culture = cultures[cultureId];
      const naming = culture?.naming || {};
      if (!naming.domains) continue;

      // Replace optimized domains
      const updatedDomains = naming.domains.map(domain => {
        const optimized = cultureResults.find(r => r.domainId === domain.id);
        return optimized ? optimized.optimizedConfig : domain;
      });

      updatedCultures[cultureId] = {
        ...culture,
        naming: {
          ...naming,
          domains: updatedDomains,
        },
      };

      addLog(`  Updated ${cultureResults.length} domain(s) in ${cultureId}`, 'success');
    }

    // Save via callback
    try {
      await onCulturesChange(updatedCultures);
      addLog('Save complete (stored in browser)', 'success');
    } catch (error) {
      addLog(`Save failed: ${error.message}`, 'error');
    }
  };

  // Group domains by culture
  const domainsByCulture = useMemo(() => {
    const grouped = {};
    allDomains.forEach(domain => {
      if (!grouped[domain.cultureId]) {
        grouped[domain.cultureId] = {
          name: domain.cultureName,
          domains: []
        };
      }
      grouped[domain.cultureId].domains.push(domain);
    });
    return grouped;
  }, [allDomains]);

  return (
    <div className="optimizer-container">
      {/* Left Panel - Domain Selection */}
      <DomainSelector
        domainsByCulture={domainsByCulture}
        allDomains={allDomains}
        selectedDomains={selectedDomains}
        expandedCultures={expandedCultures}
        onToggleDomain={toggleDomain}
        onToggleCulture={toggleCulture}
        onToggleAllInCulture={toggleAllInCulture}
        onSelectAll={selectAll}
        onDeselectAll={deselectAll}
      />

      {/* Right Panel - Settings & Results */}
      <OptimizerSettings
        algorithm={algorithm}
        onAlgorithmChange={setAlgorithm}
        algorithmParams={algorithmParams}
        onAlgorithmParamsChange={setAlgorithmParams}
        validationSettings={validationSettings}
        onValidationSettingsChange={setValidationSettings}
        fitnessWeights={fitnessWeights}
        onFitnessWeightsChange={setFitnessWeights}
        selectedDomains={selectedDomains}
        allDomains={allDomains}
        optimizing={optimizing}
        progress={progress}
        results={results}
        onOptimize={handleOptimize}
        onSaveResults={handleSaveResults}
        onShowModal={() => setShowModal(true)}
      />

      {/* Optimization Modal */}
      <ResultsModal
        show={showModal}
        onClose={() => setShowModal(false)}
        optimizing={optimizing}
        progress={progress}
        logs={logs}
        results={results}
        onSaveResults={handleSaveResults}
      />
    </div>
  );
}

import { useState } from 'react';

const API_URL = 'http://localhost:3001';

function OptimizerPanel({ metaDomain, domains, onDomainsChange }) {
  const [selectedDomainId, setSelectedDomainId] = useState('');
  const [optimizationSettings, setOptimizationSettings] = useState({
    algorithm: 'hillclimb',
    iterations: 100,
    populationSize: 16
  });
  const [fitnessWeights, setFitnessWeights] = useState({
    capacity: 0.4,
    diffuseness: 0.3,
    separation: 0.3,
    style: 0.0
  });
  const [validationSettings, setValidationSettings] = useState({
    requiredNames: 1000,
    sampleFactor: 20,
    maxSampleSize: 20000,
    minNN_p5: 0.3,
    minShapeNN_p5: 0.2,
    minCentroidDistance: 0.2
  });
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [expandedSections, setExpandedSections] = useState({
    algorithm: true,
    fitness: false,
    validation: false
  });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({...prev, [section]: !prev[section]}));
  };

  const handleOptimize = async () => {
    if (!selectedDomainId) {
      alert('Please select a domain to optimize');
      return;
    }

    setRunning(true);
    setResult(null);

    try {
      const domain = domains.find(d => d.id === selectedDomainId);

      const response = await fetch(`${API_URL}/api/optimize/domain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain,
          validationSettings,
          fitnessWeights,
          optimizationSettings
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Optimization failed');
      }

      setResult(data.result);

      // Update domain with optimized config
      const updatedDomains = domains.map(d =>
        d.id === selectedDomainId ? data.result.optimizedDomain : d
      );
      onDomainsChange(updatedDomains);

    } catch (error) {
      console.error('Optimization error:', error);
      alert(`Optimization failed: ${error.message}`);
    } finally {
      setRunning(false);
    }
  };

  const handleOptimizeAll = async () => {
    if (domains.length === 0) {
      alert('No domains to optimize');
      return;
    }

    setRunning(true);
    setResult(null);

    try {
      const response = await fetch(`${API_URL}/api/optimize/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domains,
          validationSettings,
          fitnessWeights,
          optimizationSettings
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Batch optimization failed');
      }

      setResult({ batchResults: data.results });

      // Update all domains with optimized configs
      const optimizedMap = new Map(data.results.map(r => [r.domainId, r.optimizedDomain]));
      const updatedDomains = domains.map(d => optimizedMap.get(d.id) || d);
      onDomainsChange(updatedDomains);

    } catch (error) {
      console.error('Batch optimization error:', error);
      alert(`Batch optimization failed: ${error.message}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2>Domain Optimizer</h2>
        <p className="text-muted">
          Tune domain parameters (weights, rates, ranges) to maximize name quality metrics
        </p>
      </div>

      <div className="card">
        <h3>Select Domain</h3>
        <select
          value={selectedDomainId}
          onChange={(e) => setSelectedDomainId(e.target.value)}
          style={{ width: '100%', marginBottom: '1rem' }}
        >
          <option value="">Select a domain to optimize...</option>
          {domains.map(domain => (
            <option key={domain.id} value={domain.id}>
              {domain.id} ({domain.cultureId})
            </option>
          ))}
        </select>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            className="primary"
            onClick={handleOptimize}
            disabled={running || !selectedDomainId}
          >
            {running ? 'Optimizing...' : 'Optimize Selected Domain'}
          </button>
          <button
            className="secondary"
            onClick={handleOptimizeAll}
            disabled={running || domains.length === 0}
          >
            Optimize All Domains
          </button>
        </div>
      </div>

      {/* Algorithm Settings */}
      <div className="collapsible-section">
        <div className="collapsible-header" onClick={() => toggleSection('algorithm')}>
          <h4>Optimization Algorithm</h4>
          <span className={`collapsible-toggle ${expandedSections.algorithm ? 'open' : ''}`}>▶</span>
        </div>
        {expandedSections.algorithm && (
          <div className="collapsible-content">
            <div className="form-grid-3">
              <div className="form-group">
                <label>Algorithm</label>
                <select
                  value={optimizationSettings.algorithm}
                  onChange={(e) => setOptimizationSettings({
                    ...optimizationSettings,
                    algorithm: e.target.value
                  })}
                >
                  <option value="hillclimb">Hill Climbing</option>
                  <option value="sim_anneal">Simulated Annealing</option>
                  <option value="cma-es" disabled>CMA-ES (not yet implemented)</option>
                  <option value="ga" disabled>Genetic Algorithm (not yet implemented)</option>
                </select>
                <small className="text-muted">Hill climbing is fast; simulated annealing explores more</small>
              </div>

              <div className="form-group">
                <label>Iterations</label>
                <input
                  type="number"
                  value={optimizationSettings.iterations}
                  onChange={(e) => setOptimizationSettings({
                    ...optimizationSettings,
                    iterations: parseInt(e.target.value) || 100
                  })}
                  min="10"
                  max="1000"
                />
                <small className="text-muted">More iterations = better results but slower</small>
              </div>

              <div className="form-group">
                <label>Population Size</label>
                <input
                  type="number"
                  value={optimizationSettings.populationSize}
                  onChange={(e) => setOptimizationSettings({
                    ...optimizationSettings,
                    populationSize: parseInt(e.target.value) || 16
                  })}
                  min="4"
                  max="50"
                />
                <small className="text-muted">Only used for population-based algorithms</small>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Fitness Weights */}
      <div className="collapsible-section">
        <div className="collapsible-header" onClick={() => toggleSection('fitness')}>
          <h4>Fitness Weights</h4>
          <span className={`collapsible-toggle ${expandedSections.fitness ? 'open' : ''}`}>▶</span>
        </div>
        {expandedSections.fitness && (
          <div className="collapsible-content">
            <p className="text-muted" style={{ marginBottom: '1rem' }}>
              Balance between different quality metrics (weights should sum to ~1.0)
            </p>
            <div className="form-grid-4">
              <div className="form-group">
                <label>Capacity</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="1"
                  value={fitnessWeights.capacity}
                  onChange={(e) => setFitnessWeights({
                    ...fitnessWeights,
                    capacity: parseFloat(e.target.value) || 0
                  })}
                />
                <small className="text-muted">Entropy / collision rate</small>
              </div>

              <div className="form-group">
                <label>Diffuseness</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="1"
                  value={fitnessWeights.diffuseness}
                  onChange={(e) => setFitnessWeights({
                    ...fitnessWeights,
                    diffuseness: parseFloat(e.target.value) || 0
                  })}
                />
                <small className="text-muted">Intra-domain variation</small>
              </div>

              <div className="form-group">
                <label>Separation</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="1"
                  value={fitnessWeights.separation}
                  onChange={(e) => setFitnessWeights({
                    ...fitnessWeights,
                    separation: parseFloat(e.target.value) || 0
                  })}
                />
                <small className="text-muted">Inter-domain distinctiveness</small>
              </div>

              <div className="form-group">
                <label>Style (LLM)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="1"
                  value={fitnessWeights.style}
                  onChange={(e) => setFitnessWeights({
                    ...fitnessWeights,
                    style: parseFloat(e.target.value) || 0
                  })}
                />
                <small className="text-muted">Expensive, usually 0</small>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Validation Settings */}
      <div className="collapsible-section">
        <div className="collapsible-header" onClick={() => toggleSection('validation')}>
          <h4>Validation Settings (Advanced)</h4>
          <span className={`collapsible-toggle ${expandedSections.validation ? 'open' : ''}`}>▶</span>
        </div>
        {expandedSections.validation && (
          <div className="collapsible-content">
            <div className="form-grid-3">
              <div className="form-group">
                <label>Required Names</label>
                <input
                  type="number"
                  value={validationSettings.requiredNames}
                  onChange={(e) => setValidationSettings({
                    ...validationSettings,
                    requiredNames: parseInt(e.target.value) || 1000
                  })}
                />
              </div>

              <div className="form-group">
                <label>Sample Factor</label>
                <input
                  type="number"
                  value={validationSettings.sampleFactor}
                  onChange={(e) => setValidationSettings({
                    ...validationSettings,
                    sampleFactor: parseInt(e.target.value) || 20
                  })}
                />
              </div>

              <div className="form-group">
                <label>Max Sample Size</label>
                <input
                  type="number"
                  value={validationSettings.maxSampleSize}
                  onChange={(e) => setValidationSettings({
                    ...validationSettings,
                    maxSampleSize: parseInt(e.target.value) || 20000
                  })}
                />
              </div>

              <div className="form-group">
                <label>Min NN Distance (p5)</label>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="1"
                  value={validationSettings.minNN_p5}
                  onChange={(e) => setValidationSettings({
                    ...validationSettings,
                    minNN_p5: parseFloat(e.target.value) || 0.3
                  })}
                />
              </div>

              <div className="form-group">
                <label>Min Shape NN Distance (p5)</label>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="1"
                  value={validationSettings.minShapeNN_p5}
                  onChange={(e) => setValidationSettings({
                    ...validationSettings,
                    minShapeNN_p5: parseFloat(e.target.value) || 0.2
                  })}
                />
              </div>

              <div className="form-group">
                <label>Min Centroid Distance</label>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="1"
                  value={validationSettings.minCentroidDistance}
                  onChange={(e) => setValidationSettings({
                    ...validationSettings,
                    minCentroidDistance: parseFloat(e.target.value) || 0.2
                  })}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      {result && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <h3>Optimization Results</h3>

          {result.batchResults ? (
            // Batch results
            <div>
              <p style={{ color: 'var(--arctic-light)', marginBottom: '1rem' }}>
                Optimized {result.batchResults.length} domains
              </p>
              {result.batchResults.map((r, idx) => (
                <div key={idx} style={{
                  padding: '1rem',
                  background: 'rgba(59, 130, 246, 0.1)',
                  borderRadius: '4px',
                  marginBottom: '0.5rem',
                  border: '1px solid rgba(59, 130, 246, 0.3)'
                }}>
                  <strong>{r.domainId}</strong>
                  <div style={{ display: 'flex', gap: '2rem', marginTop: '0.5rem', fontSize: '0.875rem' }}>
                    <span>Initial: {r.initialFitness.toFixed(3)}</span>
                    <span>Final: {r.finalFitness.toFixed(3)}</span>
                    <span style={{ color: 'var(--gold-accent)' }}>
                      +{(r.improvement * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // Single domain result
            <div>
              <div className="form-grid-2" style={{ marginBottom: '1rem' }}>
                <div>
                  <label>Domain ID</label>
                  <p style={{ color: 'var(--arctic-light)' }}>{result.domainId}</p>
                </div>
                <div>
                  <label>Algorithm</label>
                  <p style={{ color: 'var(--arctic-light)' }}>{result.algorithm}</p>
                </div>
                <div>
                  <label>Initial Fitness</label>
                  <p style={{ color: 'var(--arctic-light)' }}>{result.initialFitness?.toFixed(4)}</p>
                </div>
                <div>
                  <label>Final Fitness</label>
                  <p style={{ color: 'var(--gold-accent)' }}>{result.finalFitness?.toFixed(4)}</p>
                </div>
                <div>
                  <label>Improvement</label>
                  <p style={{ color: 'var(--gold-accent)' }}>
                    +{((result.improvement || 0) * 100).toFixed(1)}%
                  </p>
                </div>
                <div>
                  <label>Iterations Run</label>
                  <p style={{ color: 'var(--arctic-light)' }}>{result.iterationsRun}</p>
                </div>
              </div>

              <p className="text-muted" style={{ marginTop: '1rem' }}>
                The domain configuration has been updated with optimized parameters.
                Review the changes in the Domains tab, then proceed to create Profiles.
              </p>
            </div>
          )}
        </div>
      )}

      {running && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div className="loading">
            <div className="spinner"></div>
            <span>Optimizing... This may take 30-60 seconds</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default OptimizerPanel;

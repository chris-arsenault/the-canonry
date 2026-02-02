import { useState, useMemo } from 'react';
import { TagSelector, NumberInput } from '@penguin-tales/shared-components';
import { generateTestNames } from '../../lib/browser-generator.js';

/**
 * Generate Tab - Full control over name generation
 *
 * Note: Conditions (entityKind, subtype, tags, prominence) are evaluated at the
 * strategy GROUP level within profiles, not at the profile level. The generator
 * filters which strategy groups apply based on the generation context.
 */
function GenerateTab({ worldSchema, cultures, formState, onFormStateChange }) {
  // Use lifted state if provided, otherwise use local state
  const [localState, setLocalState] = useState({
    selectedCulture: '',
    selectedProfile: '',
    selectedKind: '',
    selectedSubKind: '',
    tags: [],
    prominence: '',
    count: 20,
    contextPairs: [{ key: '', value: '' }] // Start with one empty row
  });

  // Use formState from parent if available
  const state = formState || localState;
  const setState = onFormStateChange || setLocalState;

  // Destructure for convenience
  const {
    selectedCulture,
    selectedProfile,
    selectedKind,
    selectedSubKind,
    tags,
    prominence,
    count,
    contextPairs
  } = state;

  // Update helpers
  const updateField = (field, value) => {
    setState({ ...state, [field]: value });
  };

  // Results
  const [generatedNames, setGeneratedNames] = useState([]);
  const [debugInfo, setDebugInfo] = useState([]);
  const [strategyUsage, setStrategyUsage] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  // Get available options from schema
  const cultureIds = Object.keys(cultures || {});
  const entityKinds = worldSchema?.entityKinds?.map(e => e.kind) || [];
  const tagRegistry = worldSchema?.tagRegistry || [];

  // Get profiles for selected culture
  const availableProfiles = useMemo(() => {
    if (!selectedCulture) return [];
    return cultures[selectedCulture]?.naming?.profiles || [];
  }, [selectedCulture, cultures]);

  // Auto-select first profile when culture changes
  useMemo(() => {
    if (availableProfiles.length > 0 && !selectedProfile) {
      updateField('selectedProfile', availableProfiles[0].id);
    } else if (availableProfiles.length === 0 && selectedProfile) {
      updateField('selectedProfile', '');
    }
  }, [availableProfiles]);

  // Get subkinds for selected entity kind
  const subKinds = useMemo(() => {
    if (!selectedKind || !worldSchema?.entityKinds) return [];
    const entity = worldSchema.entityKinds.find(e => e.kind === selectedKind);
    return entity?.subtypes?.map(s => s.id) || [];
  }, [selectedKind, worldSchema]);

  // Prominence levels
  const prominenceLevels = ['forgotten', 'marginal', 'recognized', 'renowned', 'mythic'];

  // Get the culture for generation
  const getSelectedCulture = () => {
    if (!selectedCulture) return null;
    return cultures[selectedCulture] || null;
  };

  // Context pair handlers
  const handleAddContextPair = () => {
    updateField('contextPairs', [...contextPairs, { key: '', value: '' }]);
  };

  const handleRemoveContextPair = (index) => {
    const newPairs = contextPairs.filter((_, i) => i !== index);
    // Always keep at least one row
    updateField('contextPairs', newPairs.length > 0 ? newPairs : [{ key: '', value: '' }]);
  };

  const handleUpdateContextPair = (index, field, value) => {
    const updated = [...contextPairs];
    updated[index] = { ...updated[index], [field]: value };
    updateField('contextPairs', updated);
  };

  const handleGenerate = async () => {
    setError(null);
    setGenerating(true);

    try {
      const culture = getSelectedCulture();

      if (!culture) {
        throw new Error('No culture selected.');
      }

      if (!culture?.naming?.profiles || culture.naming.profiles.length === 0) {
        throw new Error('No profile found. Create a profile in Workshop → Profiles.');
      }

      // Parse tags for condition matching
      const tagList = Array.isArray(tags) ? tags : [];

      // Build context object from key-value pairs for grammar context:key slots
      const userContext = {};
      for (const pair of contextPairs) {
        if (pair.key) {
          userContext[pair.key] = pair.value;
        }
      }

      // Add standard fields to context as well
      if (selectedKind) userContext.entityKind = selectedKind;
      if (selectedSubKind) userContext.subtype = selectedSubKind;
      if (prominence) userContext.prominence = prominence;
      if (tagList.length > 0) userContext.tags = tagList.join(',');

      // Generate names - pass culture directly
      const result = await generateTestNames({
        culture,
        profileId: selectedProfile || undefined,
        count,
        seed: `generate-${Date.now()}`,
        context: userContext,
        kind: selectedKind || undefined,
        subtype: selectedSubKind || undefined,
        prominence: prominence || undefined,
        tags: tagList
      });

      setGeneratedNames(result.names || []);
      setDebugInfo(result.debugInfo || []);
      setStrategyUsage(result.strategyUsage || null);
    } catch (err) {
      setError(err.message);
      setGeneratedNames([]);
      setDebugInfo([]);
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedNames.join('\n'));
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(generatedNames, null, 2));
  };

  // Check if we can generate
  const canGenerate = selectedCulture;
  const culture = canGenerate ? getSelectedCulture() : null;
  const hasProfile = culture?.naming?.profiles?.length > 0;

  return (
    <div className="generate-container">
      <h2>Name Generator</h2>
      <p className="text-muted intro">
        Generate names using configured profiles. Strategy groups with conditions will be filtered
        based on entity type, subtype, tags, and prominence.
      </p>

      <div className="generate-layout">
        {/* Left: Controls */}
        <div className="generate-controls">
          <div className="card mb-md">
            <h3 className="mt-0 mb-md">Generation Settings</h3>

            {/* Culture Selection */}
            <div className="form-group">
              <label>Culture *</label>
              <select
                value={selectedCulture}
                onChange={(e) => {
                  setState({ ...state, selectedCulture: e.target.value, selectedProfile: '' });
                }}
              >
                <option value="">Select a culture...</option>
                {cultureIds.map(id => (
                  <option key={id} value={id}>
                    {cultures[id]?.name || id}
                  </option>
                ))}
              </select>
            </div>

            {/* Profile Selection */}
            <div className="form-group">
              <label>Profile</label>
              <select
                value={selectedProfile}
                onChange={(e) => updateField('selectedProfile', e.target.value)}
                disabled={availableProfiles.length === 0}
              >
                {availableProfiles.length === 0 ? (
                  <option value="">No profiles available</option>
                ) : (
                  availableProfiles.map(p => (
                    <option key={p.id} value={p.id}>{p.id}</option>
                  ))
                )}
              </select>
            </div>

            <div className="generate-section-divider">
              <div className="generate-section-header">
                Context (for conditional strategy groups)
              </div>

              {/* Entity Kind */}
              <div className="form-group">
                <label>Entity Kind</label>
                <select
                  value={selectedKind}
                  onChange={(e) => {
                    setState({ ...state, selectedKind: e.target.value, selectedSubKind: '' });
                  }}
                >
                  <option value="">Any type</option>
                  {entityKinds.map(kind => (
                    <option key={kind} value={kind}>{kind}</option>
                  ))}
                </select>
              </div>

              {/* SubKind */}
              <div className="form-group">
                <label>Subtype</label>
                <select
                  value={selectedSubKind}
                  onChange={(e) => updateField('selectedSubKind', e.target.value)}
                  disabled={subKinds.length === 0}
                >
                  <option value="">Any subtype</option>
                  {subKinds.map(sub => (
                    <option key={sub} value={sub}>{sub}</option>
                  ))}
                </select>
              </div>

              {/* Tags */}
              <div className="form-group">
                <label>Tags</label>
                <TagSelector
                  value={tags || []}
                  onChange={(vals) => updateField('tags', vals)}
                  tagRegistry={tagRegistry}
                  placeholder="Select tags..."
                />
              </div>

              {/* Prominence */}
              <div className="form-group">
                <label>Prominence</label>
                <select
                  value={prominence}
                  onChange={(e) => updateField('prominence', e.target.value)}
                >
                  <option value="">Any prominence</option>
                  {prominenceLevels.map(level => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Context Key-Value Pairs */}
            <div className="generate-section-divider">
              <div className="flex justify-between items-center mb-sm">
                <div className="generate-section-header mb-0">
                  Context Values
                  <span className="hint">(for context:key slots)</span>
                </div>
                <button type="button" onClick={handleAddContextPair} className="add-row-btn">
                  + Add Row
                </button>
              </div>

              {/* Context rows */}
              {contextPairs.map((pair, idx) => (
                <div key={idx} className="generate-context-row">
                  <input
                    className="key"
                    value={pair.key}
                    onChange={(e) => handleUpdateContextPair(idx, 'key', e.target.value)}
                    placeholder="key"
                  />
                  <span className="separator">=</span>
                  <input
                    className="value"
                    value={pair.value}
                    onChange={(e) => handleUpdateContextPair(idx, 'value', e.target.value)}
                    placeholder="value"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveContextPair(idx)}
                    className="remove-row-btn"
                  >
                    x
                  </button>
                </div>
              ))}
              <small className="text-muted">
                Use context:key in grammars to reference these values
              </small>
            </div>

            {/* Count */}
            <div className="form-group">
              <label>Number of Names</label>
              <NumberInput
                value={count}
                onChange={(v) => updateField('count', v ?? 1)}
                min={1}
                max={100}
                integer
              />
            </div>

            {/* Generate Button */}
            <button
              className="primary generate-btn"
              onClick={handleGenerate}
              disabled={!canGenerate || !hasProfile || generating}
            >
              {generating ? 'Generating...' : `Generate ${count} Names`}
            </button>

            {/* Status Messages */}
            {canGenerate && !hasProfile && (
              <div className="warning mt-md">
                No profile found for {selectedCulture}.
                Go to Workshop → Profiles to create one.
              </div>
            )}

            {error && (
              <div className="error mt-md">{error}</div>
            )}
          </div>

          {/* Strategy Usage */}
          {strategyUsage && (
            <div className="card">
              <h4 className="mt-0 mb-sm">Strategy Usage</h4>
              <div className="strategy-usage">
                {Object.entries(strategyUsage)
                  .filter(([, stratCount]) => stratCount > 0)
                  .map(([strategy, stratCount]) => (
                    <span key={strategy} className={`strategy-badge ${strategy}`}>
                      {strategy}: {stratCount}
                    </span>
                  ))}
              </div>
            </div>
          )}

          {/* Culture Preview */}
          {culture && hasProfile && (
            <div className="card mt-md">
              <h4 className="mt-0 mb-sm">Active Culture</h4>
              <div className="culture-preview">
                <div><strong>Profile:</strong> {selectedProfile || culture.naming?.profiles?.[0]?.id}</div>
                <div><strong>Profiles:</strong> {culture.naming?.profiles?.length || 0}</div>
                <div><strong>Domains:</strong> {culture.naming?.domains?.length || 0}</div>
                <div><strong>Grammars:</strong> {culture.naming?.grammars?.length || 0}</div>
                <div><strong>Lexeme Lists:</strong> {Object.keys(culture.naming?.lexemeLists || {}).length}</div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Results */}
        <div className="generate-results">
          <div className="card flex-1 flex flex-col">
            <div className="flex justify-between items-center mb-md">
              <h3 className="mt-0 mb-0">
                Generated Names
                {generatedNames.length > 0 && (
                  <span className="workspace-title-label">({generatedNames.length})</span>
                )}
              </h3>
              {generatedNames.length > 0 && (
                <div className="flex gap-sm">
                  <button className="secondary sm" onClick={handleCopy}>Copy Text</button>
                  <button className="secondary sm" onClick={handleCopyJson}>Copy JSON</button>
                </div>
              )}
            </div>

            {generatedNames.length === 0 ? (
              <div className="results-empty">
                <div>
                  <p>No names generated yet</p>
                  <p>Select a culture, then click Generate</p>
                </div>
              </div>
            ) : (
              <div className="results-grid">
                {generatedNames.map((name, i) => {
                  const debug = debugInfo[i];
                  const tooltipLines = debug ? [
                    `Group: ${debug.groupUsed}`,
                    `Strategy: ${debug.strategyUsed}`,
                    `Type: ${debug.strategyType}`,
                    '',
                    'Group Matching:',
                    ...(debug.groupMatching || []).map(g =>
                      `  ${g.matched ? '✓' : '✗'} ${g.groupName}: ${g.reason || ''}`
                    )
                  ] : [];
                  const tooltip = tooltipLines.join('\n');

                  return (
                    <div
                      key={i}
                      className={`name-card ${debug?.strategyType === 'fallback' ? 'fallback' : ''}`}
                      onClick={() => navigator.clipboard.writeText(name)}
                      title={tooltip || 'Click to copy'}
                    >
                      {name}
                      {debug && (
                        <span className={`name-card-badge ${debug.strategyType}`}>
                          {debug.strategyType}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default GenerateTab;

import { useState, useMemo } from 'react';
import { generateTestNames } from '../lib/browser-generator.js';

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
    tags: '',
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
  const [strategyUsage, setStrategyUsage] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  // Get available options from schema
  const cultureIds = Object.keys(cultures || {});
  const entityKinds = worldSchema?.hardState?.map(e => e.kind) || [];

  // Get profiles for selected culture
  const availableProfiles = useMemo(() => {
    if (!selectedCulture) return [];
    return cultures[selectedCulture]?.profiles || [];
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
    if (!selectedKind || !worldSchema?.hardState) return [];
    const entity = worldSchema.hardState.find(e => e.kind === selectedKind);
    return entity?.subtype || [];
  }, [selectedKind, worldSchema]);

  // Prominence levels
  const prominenceLevels = ['forgotten', 'marginal', 'recognized', 'renowned', 'mythic'];

  // Get the profile and resources for generation
  const getGenerationContext = () => {
    if (!selectedCulture) return null;

    const culture = cultures[selectedCulture];
    if (!culture) return null;

    // Find selected profile or use first one
    const profile = selectedProfile
      ? culture.profiles?.find(p => p.id === selectedProfile)
      : culture.profiles?.[0];

    if (!profile) return null;

    // Collect all culture-level resources
    const domains = culture.domains || [];
    const grammars = culture.grammars || [];
    const lexemes = culture.lexemeLists || {};

    return { profile, domains, grammars, lexemes };
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
      const genContext = getGenerationContext();

      if (!genContext) {
        throw new Error('No profile found. Create a profile in Workshop → Profiles.');
      }

      const { profile, domains, grammars, lexemes } = genContext;

      // Parse tags for context (used by strategy group condition matching)
      const tagList = tags
        .split(',')
        .map(t => t.trim())
        .filter(t => t);

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

      // Generate names (async to allow Markov model loading)
      const result = await generateTestNames({
        profile,
        domains,
        grammars,
        lexemes,
        count,
        seed: `generate-${Date.now()}`,
        context: userContext
      });

      setGeneratedNames(result.names || []);
      setStrategyUsage(result.strategyUsage || null);
    } catch (err) {
      setError(err.message);
      setGeneratedNames([]);
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
  const context = canGenerate ? getGenerationContext() : null;
  const hasProfile = !!context?.profile;

  return (
    <div style={{ padding: '1.5rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <h2 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Name Generator</h2>
      <p className="text-muted" style={{ marginBottom: '1.5rem' }}>
        Generate names using configured profiles. Strategy groups with conditions will be filtered
        based on entity type, subtype, tags, and prominence.
      </p>

      <div className="generate-layout">
        {/* Left: Controls */}
        <div className="generate-controls">
          <div className="card" style={{ marginBottom: '1rem' }}>
            <h3 style={{ margin: '0 0 1rem 0' }}>Generation Settings</h3>

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

            <div style={{
              borderTop: '1px solid var(--border-color)',
              marginTop: '1rem',
              paddingTop: '1rem'
            }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--arctic-frost)' }}>
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
                <input
                  value={tags}
                  onChange={(e) => updateField('tags', e.target.value)}
                  placeholder="noble, ancient, warrior"
                />
                <small className="text-muted">Comma-separated</small>
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
            <div style={{
              borderTop: '1px solid var(--border-color)',
              marginTop: '1rem',
              paddingTop: '1rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--arctic-frost)' }}>
                  Context Values
                  <span style={{ fontWeight: 'normal', marginLeft: '0.5rem', opacity: 0.7 }}>
                    (for context:key slots)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleAddContextPair}
                  style={{
                    background: 'rgba(34, 197, 94, 0.2)',
                    border: '1px solid rgba(34, 197, 94, 0.4)',
                    color: 'rgb(134, 239, 172)',
                    padding: '0.2rem 0.5rem',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.75rem'
                  }}
                >
                  + Add Row
                </button>
              </div>

              {/* Context rows */}
              {contextPairs.map((pair, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                  <input
                    value={pair.key}
                    onChange={(e) => handleUpdateContextPair(idx, 'key', e.target.value)}
                    placeholder="key"
                    style={{ width: '100px', fontSize: '0.8rem' }}
                  />
                  <span style={{ color: 'var(--arctic-frost)' }}>=</span>
                  <input
                    value={pair.value}
                    onChange={(e) => handleUpdateContextPair(idx, 'value', e.target.value)}
                    placeholder="value"
                    style={{ flex: 1, fontSize: '0.8rem' }}
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveContextPair(idx)}
                    style={{
                      background: 'rgba(239, 68, 68, 0.2)',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      color: 'rgb(252, 165, 165)',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.75rem'
                    }}
                  >
                    x
                  </button>
                </div>
              ))}
              <small className="text-muted" style={{ display: 'block', marginTop: '0.25rem' }}>
                Use context:key in grammars to reference these values
              </small>
            </div>

            {/* Count */}
            <div className="form-group">
              <label>Number of Names</label>
              <input
                type="number"
                value={count}
                onChange={(e) => updateField('count', Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                min={1}
                max={100}
              />
            </div>

            {/* Generate Button */}
            <button
              className="primary"
              onClick={handleGenerate}
              disabled={!canGenerate || !hasProfile || generating}
              style={{ width: '100%', marginTop: '0.5rem' }}
            >
              {generating ? 'Generating...' : `Generate ${count} Names`}
            </button>

            {/* Status Messages */}
            {canGenerate && !hasProfile && (
              <div className="warning" style={{ marginTop: '1rem', fontSize: '0.85rem' }}>
                No profile found for {selectedCulture}.
                Go to Workshop → Profiles to create one.
              </div>
            )}

            {error && (
              <div className="error" style={{ marginTop: '1rem', fontSize: '0.85rem' }}>
                {error}
              </div>
            )}
          </div>

          {/* Strategy Usage */}
          {strategyUsage && (
            <div className="card">
              <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem' }}>Strategy Usage</h4>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {Object.entries(strategyUsage)
                  .filter(([, stratCount]) => stratCount > 0)
                  .map(([strategy, stratCount]) => (
                    <span
                      key={strategy}
                      style={{
                        background: strategy === 'phonotactic' ? 'rgba(96, 165, 250, 0.2)' :
                                   strategy === 'grammar' ? 'rgba(167, 139, 250, 0.2)' :
                                   'rgba(74, 222, 128, 0.2)',
                        border: `1px solid ${
                          strategy === 'phonotactic' ? 'rgba(96, 165, 250, 0.4)' :
                          strategy === 'grammar' ? 'rgba(167, 139, 250, 0.4)' :
                          'rgba(74, 222, 128, 0.4)'
                        }`,
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.8rem'
                      }}
                    >
                      {strategy}: {stratCount}
                    </span>
                  ))}
              </div>
            </div>
          )}

          {/* Profile Preview */}
          {context?.profile && (
            <div className="card" style={{ marginTop: '1rem' }}>
              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>Active Profile</h4>
              <div style={{ fontSize: '0.8rem', color: 'var(--arctic-frost)' }}>
                <div><strong>ID:</strong> {context.profile.id}</div>
                <div><strong>Groups:</strong> {context.profile.strategyGroups?.length || 0}</div>
                <div><strong>Domains:</strong> {context.domains?.length || 0}</div>
                <div><strong>Grammars:</strong> {context.grammars?.length || 0}</div>
                <div><strong>Lexeme Lists:</strong> {Object.keys(context.lexemes || {}).length}</div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Results */}
        <div className="generate-results">
          <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0 }}>
                Generated Names
                {generatedNames.length > 0 && (
                  <span style={{ fontWeight: 'normal', fontSize: '0.9rem', marginLeft: '0.5rem', color: 'var(--arctic-frost)' }}>
                    ({generatedNames.length})
                  </span>
                )}
              </h3>
              {generatedNames.length > 0 && (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="secondary" style={{ fontSize: '0.8rem' }} onClick={handleCopy}>
                    Copy Text
                  </button>
                  <button className="secondary" style={{ fontSize: '0.8rem' }} onClick={handleCopyJson}>
                    Copy JSON
                  </button>
                </div>
              )}
            </div>

            {generatedNames.length === 0 ? (
              <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--arctic-frost)',
                textAlign: 'center'
              }}>
                <div>
                  <p style={{ margin: 0, fontSize: '1.1rem' }}>No names generated yet</p>
                  <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem' }}>
                    Select a culture, then click Generate
                  </p>
                </div>
              </div>
            ) : (
              <div style={{
                flex: 1,
                overflowY: 'auto',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: '0.5rem',
                alignContent: 'start'
              }}>
                {generatedNames.map((name, i) => (
                  <div
                    key={i}
                    style={{
                      background: 'rgba(20, 45, 75, 0.5)',
                      padding: '0.75rem 1rem',
                      borderRadius: '6px',
                      fontFamily: 'monospace',
                      fontSize: '1rem',
                      color: 'var(--gold-accent)',
                      cursor: 'pointer',
                      transition: 'background 0.2s'
                    }}
                    onClick={() => navigator.clipboard.writeText(name)}
                    title="Click to copy"
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(30, 58, 95, 0.7)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(20, 45, 75, 0.5)'}
                  >
                    {name}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default GenerateTab;

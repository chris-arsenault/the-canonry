import { useState, useEffect, useRef } from 'react';

const API_URL = 'http://localhost:3001';

function EntityWorkspace({
  metaDomain,
  worldSchema,
  cultureId,
  entityKind,
  entityConfig,
  cultureConfig,
  allCultures,
  activeTab = 'domain',
  onTabChange,
  onConfigChange
}) {
  const [error, setError] = useState(null);

  // Use prop or fallback to local handling
  const setActiveTab = onTabChange || (() => {});
  const [saveStatus, setSaveStatus] = useState(null); // 'saving' | 'saved' | 'error'
  const saveTimeoutRef = useRef(null);
  const lastSavedConfigRef = useRef(null);
  const isInitialMount = useRef(true);

  // Autosave effect - debounced save when entityConfig changes
  useEffect(() => {
    // Skip if no valid selection
    if (!cultureId || !entityKind || !entityConfig) return;

    // Skip initial mount to avoid saving on load
    if (isInitialMount.current) {
      isInitialMount.current = false;
      lastSavedConfigRef.current = JSON.stringify(entityConfig);
      return;
    }

    // Check if config actually changed
    const configStr = JSON.stringify(entityConfig);
    if (configStr === lastSavedConfigRef.current) return;

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Debounced save after 1.5 seconds of no changes
    saveTimeoutRef.current = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        const response = await fetch(
          `${API_URL}/api/v2/entity-config/${metaDomain}/${cultureId}/${entityKind}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ config: entityConfig })
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to save');
        }

        lastSavedConfigRef.current = configStr;
        setSaveStatus('saved');
        console.log(`✅ Autosaved ${entityKind} config for ${cultureId}`);

        // Clear "saved" status after 2 seconds
        setTimeout(() => setSaveStatus(null), 2000);
      } catch (err) {
        setSaveStatus('error');
        setError(err.message);
      }
    }, 1500);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [entityConfig, cultureId, entityKind, metaDomain]);

  // Reset initial mount flag when culture/entity changes
  useEffect(() => {
    isInitialMount.current = true;
    lastSavedConfigRef.current = null;
    setSaveStatus(null);
  }, [cultureId, entityKind]);

  if (!cultureId || !entityKind) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
        <p>Select a culture and entity type from the sidebar to begin</p>
      </div>
    );
  }

  const handleAutoGenerateProfile = async () => {
    try {
      const response = await fetch(
        `${API_URL}/api/v2/auto-profile/${metaDomain}/${cultureId}/${entityKind}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ config: entityConfig })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate profile');
      }

      const data = await response.json();

      // Update entity config with new profile
      const updatedConfig = {
        ...entityConfig,
        profile: data.profile,
        completionStatus: {
          ...entityConfig.completionStatus,
          profile: true
        }
      };

      onConfigChange(updatedConfig);

      console.log(`✅ Auto-generated profile for ${cultureId}:${entityKind}`);
    } catch (err) {
      setError(err.message);
    }
  };

  // Check if any domain in this culture applies to current entity type
  const hasSharedDomain = () => {
    if (!cultureConfig?.entityConfigs || !entityKind) return false;
    for (const [kind, config] of Object.entries(cultureConfig.entityConfigs)) {
      if (config?.domain && kind !== entityKind) {
        const appliesTo = config.domain.appliesTo?.kind || [];
        if (appliesTo.includes(entityKind)) return true;
      }
    }
    return false;
  };

  const getCompletionBadge = (key) => {
    // Compute status directly from data rather than stored completionStatus
    if (key === 'domain') {
      if (entityConfig?.domain) return '✅';
      if (hasSharedDomain()) return '🔗';
      return '⭕';
    } else if (key === 'lexemes') {
      const count = Object.keys(entityConfig?.lexemeLists || {}).length;
      return count > 0 ? `✅ (${count})` : '⭕';
    } else if (key === 'templates') {
      const count = (entityConfig?.templates || []).length;
      return count > 0 ? `✅ (${count})` : '⭕';
    } else if (key === 'grammars') {
      const count = (entityConfig?.grammars || []).length;
      return count > 0 ? `✅ (${count})` : '⭕';
    } else if (key === 'profile') {
      return entityConfig?.profile ? '✅' : '⭕';
    }

    return '⭕';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        borderBottom: '1px solid var(--border-color)',
        padding: '1rem 1.5rem',
        background: 'rgba(30, 58, 95, 0.2)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, marginBottom: '0.25rem' }}>
              <span style={{ textTransform: 'capitalize', color: 'var(--gold-accent)' }}>
                {cultureId}
              </span>
              {' '}/{' '}
              <span style={{ textTransform: 'capitalize' }}>
                {entityKind}
              </span>
            </h2>
            <div style={{ fontSize: '0.875rem', color: 'var(--arctic-frost)' }}>
              Configure naming components for this entity type
            </div>
          </div>

          {/* Autosave status indicator */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.875rem',
            color: saveStatus === 'error' ? 'var(--error-color)' : 'var(--arctic-frost)'
          }}>
            {saveStatus === 'saving' && (
              <>
                <span style={{
                  display: 'inline-block',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: 'var(--gold-accent)',
                  animation: 'pulse 1s infinite'
                }} />
                Saving...
              </>
            )}
            {saveStatus === 'saved' && (
              <>
                <span style={{ color: '#22c55e' }}>✓</span>
                Saved
              </>
            )}
            {saveStatus === 'error' && (
              <>
                <span style={{ color: 'var(--error-color)' }}>✗</span>
                Save failed
              </>
            )}
            {!saveStatus && (
              <span style={{ opacity: 0.6 }}>Autosave enabled</span>
            )}
          </div>
        </div>

        {error && (
          <div className="error" style={{ marginTop: '1rem' }}>
            {error}
            <button
              onClick={() => setError(null)}
              style={{ marginLeft: '1rem', padding: '0.25rem 0.5rem' }}
            >
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{
        borderBottom: '1px solid var(--border-color)',
        padding: '0 1.5rem',
        background: 'rgba(30, 58, 95, 0.1)',
        display: 'flex',
        gap: '0.5rem'
      }}>
        {['domain', 'lexemes', 'templates', 'grammars', 'profile'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '0.75rem 1rem',
              border: 'none',
              background: activeTab === tab ? 'var(--card-bg)' : 'transparent',
              color: activeTab === tab ? 'var(--gold-accent)' : 'var(--text-color)',
              borderBottom: activeTab === tab ? '2px solid var(--gold-accent)' : '2px solid transparent',
              cursor: 'pointer',
              fontWeight: activeTab === tab ? 'bold' : 'normal',
              textTransform: 'capitalize',
              transition: 'all 0.2s'
            }}
          >
            {tab} {getCompletionBadge(tab)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
        {activeTab === 'domain' && (
          <DomainTab
            cultureId={cultureId}
            entityKind={entityKind}
            entityConfig={entityConfig}
            onConfigChange={onConfigChange}
            worldSchema={worldSchema}
            cultureConfig={cultureConfig}
          />
        )}

        {activeTab === 'lexemes' && (
          <LexemesTab
            metaDomain={metaDomain}
            cultureId={cultureId}
            entityKind={entityKind}
            entityConfig={entityConfig}
            onConfigChange={onConfigChange}
            worldSchema={worldSchema}
            cultureConfig={cultureConfig}
            allCultures={allCultures}
          />
        )}

        {activeTab === 'templates' && (
          <TemplatesTab
            metaDomain={metaDomain}
            cultureId={cultureId}
            entityKind={entityKind}
            entityConfig={entityConfig}
            onConfigChange={onConfigChange}
            worldSchema={worldSchema}
            cultureConfig={cultureConfig}
            allCultures={allCultures}
          />
        )}

        {activeTab === 'grammars' && (
          <GrammarsTab
            entityConfig={entityConfig}
            onConfigChange={onConfigChange}
            cultureId={cultureId}
            entityKind={entityKind}
            cultureConfig={cultureConfig}
            allCultures={allCultures}
            worldSchema={worldSchema}
          />
        )}

        {activeTab === 'profile' && (
          <ProfileTab
            cultureId={cultureId}
            entityKind={entityKind}
            entityConfig={entityConfig}
            onConfigChange={onConfigChange}
            onAutoGenerate={handleAutoGenerateProfile}
            cultureConfig={cultureConfig}
            allCultures={allCultures}
          />
        )}
      </div>
    </div>
  );
}

// Domain Tab Component
function DomainTab({ cultureId, entityKind, entityConfig, onConfigChange, worldSchema, cultureConfig }) {
  const [editing, setEditing] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    phonology: true,
    morphology: false,
    style: false
  });

  // Get all entity kinds from schema
  const entityKinds = worldSchema?.hardState?.map(e => e.kind) || [];

  // Find existing domains in this culture (from other entity configs)
  // Also find if any domain already applies to this entity type
  const existingDomains = [];
  let applicableDomain = null;
  let applicableDomainSource = null;

  if (cultureConfig?.entityConfigs) {
    Object.entries(cultureConfig.entityConfigs).forEach(([kind, config]) => {
      if (config?.domain) {
        const domain = config.domain;
        const appliesTo = domain.appliesTo?.kind || [];

        // Check if this domain applies to our current entity type
        if (appliesTo.includes(entityKind) && kind !== entityKind) {
          applicableDomain = domain;
          applicableDomainSource = kind;
        }

        // Add to existing domains list (for copy option)
        if (kind !== entityKind) {
          existingDomains.push({
            ...domain,
            sourceEntity: kind
          });
        }
      }
    });
  }

  // Use applicable domain from another entity if current entity has none
  const effectiveDomain = entityConfig?.domain || applicableDomain;

  const defaultDomain = {
    id: `${cultureId}_domain`,
    cultureId: cultureId,
    appliesTo: { kind: [entityKind], subKind: [], tags: [] },
    phonology: {
      consonants: [], vowels: [], syllableTemplates: ['CV', 'CVC'], lengthRange: [2, 4],
      favoredClusters: [], forbiddenClusters: [], favoredClusterBoost: 1.0
    },
    morphology: { prefixes: [], suffixes: [], structure: ['root', 'root-suffix'], structureWeights: [0.5, 0.5] },
    style: {
      capitalization: 'title', apostropheRate: 0, hyphenRate: 0,
      preferredEndings: [], preferredEndingBoost: 1.0, rhythmBias: 'neutral'
    }
  };

  const [formData, setFormData] = useState(entityConfig?.domain || defaultDomain);

  const toggleSection = (section) => {
    setExpandedSections(prev => ({...prev, [section]: !prev[section]}));
  };

  const handleSave = () => {
    const updatedConfig = {
      ...entityConfig,
      domain: formData,
      completionStatus: {
        ...entityConfig?.completionStatus,
        domain: true
      }
    };
    onConfigChange(updatedConfig);
    setEditing(false);
  };

  const handleCreateNew = () => {
    setFormData({
      ...defaultDomain,
      id: `${cultureId}_domain`,
      appliesTo: { kind: [entityKind], subKind: [], tags: [] }
    });
    setEditing(true);
  };

  const handleCopyFromExisting = (existingDomain) => {
    // Copy the domain but add current entity kind to appliesTo
    const kinds = existingDomain.appliesTo?.kind || [];
    const newKinds = kinds.includes(entityKind) ? kinds : [...kinds, entityKind];

    setFormData({
      ...existingDomain,
      appliesTo: {
        ...existingDomain.appliesTo,
        kind: newKinds
      }
    });
    setEditing(true);
  };

  const toggleEntityKind = (kind) => {
    const currentKinds = formData.appliesTo?.kind || [];
    const newKinds = currentKinds.includes(kind)
      ? currentKinds.filter(k => k !== kind)
      : [...currentKinds, kind];

    setFormData({
      ...formData,
      appliesTo: {
        ...formData.appliesTo,
        kind: newKinds
      }
    });
  };

  if (!editing && effectiveDomain) {
    const domain = effectiveDomain;
    const isShared = !entityConfig?.domain && applicableDomain;

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0 }}>Phonological Domain</h3>
          <button className="secondary" onClick={() => { setFormData(domain); setEditing(true); }}>
            Edit Domain
          </button>
        </div>

        <div style={{
          background: isShared ? 'rgba(59, 130, 246, 0.1)' : 'rgba(34, 197, 94, 0.1)',
          border: `1px solid ${isShared ? 'rgba(59, 130, 246, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`,
          borderRadius: '6px',
          padding: '1rem',
          marginBottom: '1rem'
        }}>
          <strong style={{ color: isShared ? 'rgb(147, 197, 253)' : 'rgb(134, 239, 172)' }}>
            {isShared ? '🔗 Shared Domain:' : '✓ Domain:'} {domain.id}
          </strong>
          <div style={{ fontSize: '0.875rem', marginTop: '0.25rem', color: 'var(--arctic-frost)' }}>
            Applies to: {domain.appliesTo?.kind?.join(', ') || entityKind}
            {isShared && (
              <span style={{ marginLeft: '0.5rem', opacity: 0.7 }}>
                (configured in {applicableDomainSource})
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gap: '1rem' }}>
          <div style={{ background: 'rgba(30, 58, 95, 0.3)', padding: '1rem', borderRadius: '6px' }}>
            <strong>Phonology</strong>
            <div style={{ fontSize: '0.875rem', marginTop: '0.5rem', color: 'var(--arctic-frost)' }}>
              <div>Consonants: {domain.phonology?.consonants?.join(', ') || 'None'}</div>
              <div>Vowels: {domain.phonology?.vowels?.join(', ') || 'None'}</div>
              <div>Syllables: {domain.phonology?.syllableTemplates?.join(', ') || 'None'}</div>
              <div>Length: {domain.phonology?.lengthRange?.join('-') || '2-4'}</div>
            </div>
          </div>

          <div style={{ background: 'rgba(30, 58, 95, 0.3)', padding: '1rem', borderRadius: '6px' }}>
            <strong>Morphology</strong>
            <div style={{ fontSize: '0.875rem', marginTop: '0.5rem', color: 'var(--arctic-frost)' }}>
              <div>Prefixes: {domain.morphology?.prefixes?.join(', ') || 'None'}</div>
              <div>Suffixes: {domain.morphology?.suffixes?.join(', ') || 'None'}</div>
              <div>Structure: {domain.morphology?.structure?.join(', ') || 'None'}</div>
            </div>
          </div>

          <div style={{ background: 'rgba(30, 58, 95, 0.3)', padding: '1rem', borderRadius: '6px' }}>
            <strong>Style</strong>
            <div style={{ fontSize: '0.875rem', marginTop: '0.5rem', color: 'var(--arctic-frost)' }}>
              <div>Capitalization: {domain.style?.capitalization || 'title'}</div>
              <div>Rhythm: {domain.style?.rhythmBias || 'neutral'}</div>
              <div>Apostrophe rate: {domain.style?.apostropheRate || 0}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!editing && !effectiveDomain) {
    return (
      <div>
        <h3>Phonological Domain</h3>
        <p className="text-muted">
          Define the sound patterns and morphology for <strong>{cultureId}</strong> names.
        </p>

        {existingDomains.length > 0 && (
          <div style={{ marginTop: '1rem', marginBottom: '1rem' }}>
            <h4 style={{ marginBottom: '0.5rem' }}>Use Existing Domain</h4>
            <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>
              Copy a domain already configured for this culture:
            </p>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {existingDomains.map((domain) => (
                <div
                  key={domain.id}
                  style={{
                    background: 'rgba(30, 58, 95, 0.3)',
                    padding: '0.75rem 1rem',
                    borderRadius: '6px',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <strong>{domain.id}</strong>
                    <div style={{ fontSize: '0.75rem', color: 'var(--arctic-frost)' }}>
                      From: {domain.sourceEntity} • Applies to: {domain.appliesTo?.kind?.join(', ')}
                    </div>
                  </div>
                  <button
                    className="secondary"
                    style={{ fontSize: '0.875rem' }}
                    onClick={() => handleCopyFromExisting(domain)}
                  >
                    Copy & Edit
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{
          background: 'rgba(59, 130, 246, 0.1)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          borderRadius: '6px',
          padding: '1.5rem',
          textAlign: 'center',
          marginTop: '1rem'
        }}>
          <p style={{ margin: '0 0 1rem 0' }}>
            {existingDomains.length > 0 ? 'Or create a new domain from scratch:' : 'No domain configured yet.'}
          </p>
          <button className="primary" onClick={handleCreateNew}>
            + Create New Domain
          </button>
        </div>
      </div>
    );
  }

  // Editing mode - full form
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0 }}>{entityConfig?.domain ? 'Edit Domain' : 'Create Domain'}</h3>
      </div>

      <div className="form-group" style={{ marginBottom: '1rem' }}>
        <label>Domain ID</label>
        <input
          value={formData.id}
          onChange={(e) => setFormData({...formData, id: e.target.value})}
          placeholder={`${cultureId}_domain`}
        />
        <small className="text-muted">Unique identifier for this domain</small>
      </div>

      {/* Applies To Section */}
      <div style={{ marginBottom: '1rem', padding: '1rem', background: 'rgba(30, 58, 95, 0.2)', borderRadius: '6px' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem' }}>Applies To Entity Types</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {entityKinds.map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => toggleEntityKind(kind)}
              style={{
                padding: '0.25rem 0.75rem',
                borderRadius: '4px',
                border: '1px solid',
                borderColor: formData.appliesTo?.kind?.includes(kind) ? 'var(--gold-accent)' : 'var(--border-color)',
                background: formData.appliesTo?.kind?.includes(kind) ? 'rgba(212, 175, 55, 0.2)' : 'transparent',
                color: formData.appliesTo?.kind?.includes(kind) ? 'var(--gold-accent)' : 'var(--text-color)',
                cursor: 'pointer',
                fontSize: '0.875rem',
                textTransform: 'capitalize'
              }}
            >
              {kind}
            </button>
          ))}
        </div>
        <small className="text-muted">Select all entity types this domain should apply to</small>
      </div>

      {/* Phonology Section */}
      <div className="collapsible-section">
        <div className="collapsible-header" onClick={() => toggleSection('phonology')} style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'rgba(30, 58, 95, 0.3)', borderRadius: '6px', marginBottom: '0.5rem' }}>
          <h4 style={{ margin: 0 }}>Phonology</h4>
          <span>{expandedSections.phonology ? '▼' : '▶'}</span>
        </div>
        {expandedSections.phonology && (
          <div style={{ padding: '1rem', background: 'rgba(30, 58, 95, 0.1)', borderRadius: '6px', marginBottom: '1rem' }}>
            <div className="form-grid-2">
              <div className="form-group">
                <label>Consonants (space-separated)</label>
                <input
                  defaultValue={formData.phonology?.consonants?.join(' ') || ''}
                  onBlur={(e) => setFormData({
                    ...formData,
                    phonology: {...formData.phonology, consonants: e.target.value.split(/\s+/).filter(s => s)}
                  })}
                  placeholder="l r th f n m v s"
                />
              </div>
              <div className="form-group">
                <label>Vowels (space-separated)</label>
                <input
                  defaultValue={formData.phonology?.vowels?.join(' ') || ''}
                  onBlur={(e) => setFormData({
                    ...formData,
                    phonology: {...formData.phonology, vowels: e.target.value.split(/\s+/).filter(s => s)}
                  })}
                  placeholder="a e i o u ae"
                />
              </div>
              <div className="form-group">
                <label>Syllable Templates</label>
                <input
                  defaultValue={formData.phonology?.syllableTemplates?.join(' ') || ''}
                  onBlur={(e) => setFormData({
                    ...formData,
                    phonology: {...formData.phonology, syllableTemplates: e.target.value.split(/\s+/).filter(s => s)}
                  })}
                  placeholder="CV CVC CVV"
                />
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Min Length</label>
                  <input
                    type="number"
                    value={formData.phonology?.lengthRange?.[0] || 2}
                    onChange={(e) => setFormData({
                      ...formData,
                      phonology: {...formData.phonology, lengthRange: [parseInt(e.target.value) || 2, formData.phonology?.lengthRange?.[1] || 4]}
                    })}
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Max Length</label>
                  <input
                    type="number"
                    value={formData.phonology?.lengthRange?.[1] || 4}
                    onChange={(e) => setFormData({
                      ...formData,
                      phonology: {...formData.phonology, lengthRange: [formData.phonology?.lengthRange?.[0] || 2, parseInt(e.target.value) || 4]}
                    })}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Favored Clusters (optional)</label>
                <input
                  defaultValue={formData.phonology?.favoredClusters?.join(' ') || ''}
                  onBlur={(e) => setFormData({
                    ...formData,
                    phonology: {...formData.phonology, favoredClusters: e.target.value.split(/\s+/).filter(s => s)}
                  })}
                  placeholder="th ae gr"
                />
              </div>
              <div className="form-group">
                <label>Forbidden Clusters (optional)</label>
                <input
                  defaultValue={formData.phonology?.forbiddenClusters?.join(' ') || ''}
                  onBlur={(e) => setFormData({
                    ...formData,
                    phonology: {...formData.phonology, forbiddenClusters: e.target.value.split(/\s+/).filter(s => s)}
                  })}
                  placeholder="ii uu xx"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Morphology Section */}
      <div className="collapsible-section">
        <div className="collapsible-header" onClick={() => toggleSection('morphology')} style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'rgba(30, 58, 95, 0.3)', borderRadius: '6px', marginBottom: '0.5rem' }}>
          <h4 style={{ margin: 0 }}>Morphology</h4>
          <span>{expandedSections.morphology ? '▼' : '▶'}</span>
        </div>
        {expandedSections.morphology && (
          <div style={{ padding: '1rem', background: 'rgba(30, 58, 95, 0.1)', borderRadius: '6px', marginBottom: '1rem' }}>
            <div className="form-grid-2">
              <div className="form-group">
                <label>Prefixes (space-separated)</label>
                <input
                  defaultValue={formData.morphology?.prefixes?.join(' ') || ''}
                  onBlur={(e) => setFormData({
                    ...formData,
                    morphology: {...formData.morphology, prefixes: e.target.value.split(/\s+/).filter(s => s)}
                  })}
                  placeholder="Ael Ith Vor"
                />
              </div>
              <div className="form-group">
                <label>Suffixes (space-separated)</label>
                <input
                  defaultValue={formData.morphology?.suffixes?.join(' ') || ''}
                  onBlur={(e) => setFormData({
                    ...formData,
                    morphology: {...formData.morphology, suffixes: e.target.value.split(/\s+/).filter(s => s)}
                  })}
                  placeholder="riel ion aen"
                />
              </div>
              <div className="form-group">
                <label>Structure (comma-separated)</label>
                <input
                  defaultValue={formData.morphology?.structure?.join(', ') || ''}
                  onBlur={(e) => setFormData({
                    ...formData,
                    morphology: {...formData.morphology, structure: e.target.value.split(',').map(s => s.trim()).filter(s => s)}
                  })}
                  placeholder="root, root-suffix, prefix-root"
                />
              </div>
              <div className="form-group">
                <label>Structure Weights (comma-separated)</label>
                <input
                  defaultValue={formData.morphology?.structureWeights?.join(', ') || ''}
                  onBlur={(e) => setFormData({
                    ...formData,
                    morphology: {...formData.morphology, structureWeights: e.target.value.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n))}
                  })}
                  placeholder="0.5, 0.3, 0.2"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Style Section */}
      <div className="collapsible-section">
        <div className="collapsible-header" onClick={() => toggleSection('style')} style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'rgba(30, 58, 95, 0.3)', borderRadius: '6px', marginBottom: '0.5rem' }}>
          <h4 style={{ margin: 0 }}>Style</h4>
          <span>{expandedSections.style ? '▼' : '▶'}</span>
        </div>
        {expandedSections.style && (
          <div style={{ padding: '1rem', background: 'rgba(30, 58, 95, 0.1)', borderRadius: '6px', marginBottom: '1rem' }}>
            <div className="form-grid-3">
              <div className="form-group">
                <label>Capitalization</label>
                <select
                  value={formData.style?.capitalization || 'title'}
                  onChange={(e) => setFormData({
                    ...formData,
                    style: {...formData.style, capitalization: e.target.value}
                  })}
                >
                  <option value="title">Title Case</option>
                  <option value="lower">lowercase</option>
                  <option value="upper">UPPERCASE</option>
                  <option value="mixed">MiXeD</option>
                </select>
              </div>
              <div className="form-group">
                <label>Rhythm Bias</label>
                <select
                  value={formData.style?.rhythmBias || 'neutral'}
                  onChange={(e) => setFormData({
                    ...formData,
                    style: {...formData.style, rhythmBias: e.target.value}
                  })}
                >
                  <option value="neutral">Neutral</option>
                  <option value="flowing">Flowing</option>
                  <option value="harsh">Harsh</option>
                  <option value="staccato">Staccato</option>
                </select>
              </div>
              <div className="form-group">
                <label>Apostrophe Rate</label>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="1"
                  value={formData.style?.apostropheRate || 0}
                  onChange={(e) => setFormData({
                    ...formData,
                    style: {...formData.style, apostropheRate: parseFloat(e.target.value) || 0}
                  })}
                />
              </div>
              <div className="form-group">
                <label>Hyphen Rate</label>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="1"
                  value={formData.style?.hyphenRate || 0}
                  onChange={(e) => setFormData({
                    ...formData,
                    style: {...formData.style, hyphenRate: parseFloat(e.target.value) || 0}
                  })}
                />
              </div>
              <div className="form-group">
                <label>Preferred Endings</label>
                <input
                  defaultValue={formData.style?.preferredEndings?.join(' ') || ''}
                  onBlur={(e) => setFormData({
                    ...formData,
                    style: {...formData.style, preferredEndings: e.target.value.split(/\s+/).filter(s => s)}
                  })}
                  placeholder="iel ion riel"
                />
              </div>
              <div className="form-group">
                <label>Ending Boost</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.style?.preferredEndingBoost || 1.0}
                  onChange={(e) => setFormData({
                    ...formData,
                    style: {...formData.style, preferredEndingBoost: parseFloat(e.target.value) || 1.0}
                  })}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
        <button className="primary" onClick={handleSave}>Save Domain</button>
        <button className="secondary" onClick={() => setEditing(false)}>Cancel</button>
      </div>
    </div>
  );
}

// Lexemes Tab Component
const POS_TAGS = ['noun', 'verb_3sg', 'adj', 'noun_abstract', 'prep', 'ordinal'];

function LexemesTab({ metaDomain, cultureId, entityKind, entityConfig, onConfigChange, worldSchema, cultureConfig, allCultures }) {
  const [mode, setMode] = useState('view'); // 'view', 'create-spec', 'create-manual', 'generate'
  const [selectedList, setSelectedList] = useState(null);
  const [selectedListSource, setSelectedListSource] = useState(null); // { cultureId, entityKind } or null for local
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [apiKey, setApiKey] = useState('');

  // Get all cultures and entity kinds for sharing options
  const allCultureIds = Object.keys(allCultures || {});
  const allEntityKinds = worldSchema?.hardState?.map(e => e.kind) || [];

  // Form state for spec creation
  const [specForm, setSpecForm] = useState({
    id: `${cultureId}_${entityKind}_nouns`,
    pos: 'noun',
    style: '',
    targetCount: 30,
    qualityFilter: { minLength: 3, maxLength: 15 },
    appliesTo: {
      cultures: [cultureId],
      entityKinds: [entityKind]
    }
  });

  // Form state for manual list creation
  const [manualForm, setManualForm] = useState({
    id: `${cultureId}_${entityKind}_manual`,
    description: '',
    entries: '',
    appliesTo: {
      cultures: [cultureId],
      entityKinds: [entityKind]
    }
  });

  // Get entity subtypes from schema for style hints
  const entitySchema = worldSchema?.hardState?.find(e => e.kind === entityKind);
  const subtypes = entitySchema?.subtype || [];

  // Get existing lexeme lists from entity config
  const lexemeLists = entityConfig?.lexemeLists || {};
  const lexemeSpecs = entityConfig?.lexemeSpecs || [];

  // Get domain for phonology hints
  const getEffectiveDomain = () => {
    if (entityConfig?.domain) return entityConfig.domain;
    if (cultureConfig?.entityConfigs) {
      for (const [kind, config] of Object.entries(cultureConfig.entityConfigs)) {
        if (config?.domain) {
          const appliesTo = config.domain.appliesTo?.kind || [];
          if (appliesTo.includes(entityKind)) return config.domain;
        }
      }
    }
    return null;
  };
  const effectiveDomain = getEffectiveDomain();

  // Find shared lexeme lists from other cultures/entity types
  const getSharedLists = () => {
    const shared = [];

    // Helper to check if list applies to current culture/entity
    const listAppliesHere = (list) => {
      const appliesTo = list.appliesTo || {};
      const cultures = appliesTo.cultures || [];
      const entityKinds = appliesTo.entityKinds || [];

      // Check culture match (empty array or '*' means all)
      const cultureMatch = cultures.length === 0 ||
        cultures.includes('*') ||
        cultures.includes(cultureId);

      // Check entity kind match
      const entityMatch = entityKinds.length === 0 ||
        entityKinds.includes('*') ||
        entityKinds.includes(entityKind);

      return cultureMatch && entityMatch;
    };

    // Search all cultures and their entity configs
    if (allCultures) {
      Object.entries(allCultures).forEach(([cultId, cultConfig]) => {
        if (cultConfig?.entityConfigs) {
          Object.entries(cultConfig.entityConfigs).forEach(([entKind, entConfig]) => {
            // Skip current culture/entity - those are local, not shared
            if (cultId === cultureId && entKind === entityKind) return;

            const lists = entConfig?.lexemeLists || {};
            Object.entries(lists).forEach(([listId, list]) => {
              if (listAppliesHere(list)) {
                shared.push({
                  ...list,
                  id: listId,
                  sourceCulture: cultId,
                  sourceEntity: entKind,
                  isShared: true
                });
              }
            });
          });
        }
      });
    }

    return shared;
  };

  const sharedLists = getSharedLists();

  const handleSaveSpec = () => {
    const newSpec = {
      ...specForm,
      cultureId,
      entityKind
    };

    const updatedSpecs = [...lexemeSpecs.filter(s => s.id !== newSpec.id), newSpec];
    const updatedConfig = {
      ...entityConfig,
      lexemeSpecs: updatedSpecs
    };
    onConfigChange(updatedConfig);
    setMode('view');
    setSpecForm({
      id: `${cultureId}_${entityKind}_nouns`,
      pos: 'noun',
      style: '',
      targetCount: 30,
      qualityFilter: { minLength: 3, maxLength: 15 }
    });
  };

  const handleDeleteSpec = (specId) => {
    const updatedSpecs = lexemeSpecs.filter(s => s.id !== specId);
    const updatedConfig = {
      ...entityConfig,
      lexemeSpecs: updatedSpecs
    };
    onConfigChange(updatedConfig);
  };

  const handleSaveManualList = async () => {
    if (!manualForm.id.trim()) {
      setError('Please enter a list ID');
      return;
    }

    const entries = manualForm.entries
      .split(/[\n,]/)
      .map(e => e.trim())
      .filter(e => e);

    if (entries.length === 0) {
      setError('Please enter at least one entry');
      return;
    }

    const newList = {
      id: manualForm.id,
      description: manualForm.description || 'Manual list',
      entries: entries,
      source: 'manual',
      appliesTo: manualForm.appliesTo
    };

    const updatedLists = {
      ...lexemeLists,
      [manualForm.id]: newList
    };

    const updatedConfig = {
      ...entityConfig,
      lexemeLists: updatedLists,
      completionStatus: {
        ...entityConfig?.completionStatus,
        lexemes: Object.keys(updatedLists).length
      }
    };

    onConfigChange(updatedConfig);
    setMode('view');
    setManualForm({
      id: `${cultureId}_${entityKind}_manual`,
      description: '',
      entries: '',
      appliesTo: {
        cultures: [cultureId],
        entityKinds: [entityKind]
      }
    });
    setError(null);
  };

  const handleGenerate = async (spec) => {
    setLoading(true);
    setError(null);

    try {
      const requestBody = {
        spec: {
          ...spec,
          cultureId,
          domain: effectiveDomain
        },
        metaDomain: metaDomain
      };

      // Only include apiKey if user provided one (otherwise server uses env var)
      if (apiKey && apiKey.trim()) {
        requestBody.apiKey = apiKey.trim();
      }

      console.log('[LexemesTab] Generate request:', {
        specId: spec.id,
        hasApiKey: !!requestBody.apiKey,
        metaDomain
      });

      const response = await fetch(`${API_URL}/api/generate/lexeme`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Generation failed');
      }

      const data = await response.json();

      const newList = {
        id: spec.id,
        description: `Generated ${spec.pos} list: ${spec.style}`,
        entries: data.result.entries,
        source: 'llm',
        filtered: data.result.filtered,
        tokensUsed: data.result.tokensUsed,
        appliesTo: spec.appliesTo || { cultures: [cultureId], entityKinds: [entityKind] }
      };

      const updatedLists = {
        ...lexemeLists,
        [spec.id]: newList
      };

      const updatedConfig = {
        ...entityConfig,
        lexemeLists: updatedLists,
        completionStatus: {
          ...entityConfig?.completionStatus,
          lexemes: Object.keys(updatedLists).length
        }
      };

      onConfigChange(updatedConfig);
      setSelectedList(spec.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteList = (listId) => {
    const updatedLists = { ...lexemeLists };
    delete updatedLists[listId];

    const updatedConfig = {
      ...entityConfig,
      lexemeLists: updatedLists,
      completionStatus: {
        ...entityConfig?.completionStatus,
        lexemes: Object.keys(updatedLists).length
      }
    };

    onConfigChange(updatedConfig);
    if (selectedList === listId) setSelectedList(null);
  };

  // View mode - show existing lists and specs
  if (mode === 'view') {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0 }}>Lexeme Lists</h3>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="primary" onClick={() => setMode('create-spec')}>
              + New Spec
            </button>
            <button className="secondary" onClick={() => setMode('create-manual')}>
              + Manual List
            </button>
          </div>
        </div>

        <p className="text-muted" style={{ marginBottom: '1rem' }}>
          Create lexeme specs to generate word lists via LLM, or add manual lists for function words.
        </p>

        {error && <div className="error" style={{ marginBottom: '1rem' }}>{error}</div>}

        {/* Lexeme Specs Section */}
        {lexemeSpecs.length > 0 && (
          <div style={{ marginBottom: '1.5rem' }}>
            <h4 style={{ marginBottom: '0.5rem' }}>Generation Specs ({lexemeSpecs.length})</h4>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {lexemeSpecs.map(spec => {
                const hasGenerated = lexemeLists[spec.id];
                return (
                  <div
                    key={spec.id}
                    style={{
                      background: 'rgba(30, 58, 95, 0.3)',
                      padding: '0.75rem 1rem',
                      borderRadius: '6px',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <strong>{spec.id}</strong>
                      {hasGenerated && (
                        <span style={{
                          marginLeft: '0.5rem',
                          padding: '0.125rem 0.5rem',
                          background: 'rgba(34, 197, 94, 0.2)',
                          border: '1px solid rgba(34, 197, 94, 0.4)',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          color: 'rgb(134, 239, 172)'
                        }}>
                          Generated ({lexemeLists[spec.id]?.entries?.length || 0})
                        </span>
                      )}
                      <div style={{ fontSize: '0.875rem', color: 'var(--arctic-frost)', marginTop: '0.25rem' }}>
                        {spec.pos} • {spec.targetCount} words
                        {spec.style && ` • ${spec.style.substring(0, 50)}${spec.style.length > 50 ? '...' : ''}`}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {hasGenerated && (
                        <button
                          className="secondary"
                          style={{ fontSize: '0.875rem' }}
                          onClick={() => setSelectedList(spec.id)}
                        >
                          View
                        </button>
                      )}
                      <button
                        className="primary"
                        style={{ fontSize: '0.875rem' }}
                        onClick={() => handleGenerate(spec)}
                        disabled={loading}
                      >
                        {loading ? '...' : hasGenerated ? 'Regenerate' : 'Generate'}
                      </button>
                      <button
                        className="danger"
                        style={{ fontSize: '0.875rem' }}
                        onClick={() => handleDeleteSpec(spec.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Generated & Manual Lists Section */}
        <div style={{ display: 'flex', gap: '1.5rem' }}>
          <div style={{ flex: selectedList ? '0 0 50%' : '1' }}>
            <h4 style={{ marginBottom: '0.5rem' }}>
              Local Lists ({Object.keys(lexemeLists).length})
            </h4>

            {Object.keys(lexemeLists).length === 0 ? (
              <div style={{
                background: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: '6px',
                padding: '1.5rem',
                textAlign: 'center'
              }}>
                <p style={{ margin: 0 }}>No local lexeme lists yet.</p>
                <p className="text-muted" style={{ marginTop: '0.5rem' }}>
                  Create a spec and generate via LLM, or add a manual list.
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                {Object.entries(lexemeLists).map(([listId, list]) => {
                  const isSelected = selectedList === listId && !selectedListSource;
                  const sharingInfo = list.appliesTo || {};
                  const sharesWithOthers = (sharingInfo.cultures?.length > 1 || sharingInfo.cultures?.includes('*')) ||
                    (sharingInfo.entityKinds?.length > 1 || sharingInfo.entityKinds?.includes('*'));

                  return (
                    <div
                      key={listId}
                      style={{
                        background: isSelected ? 'rgba(212, 175, 55, 0.1)' : 'rgba(30, 58, 95, 0.3)',
                        padding: '0.75rem 1rem',
                        borderRadius: '6px',
                        border: isSelected ? '1px solid var(--gold-accent)' : '1px solid rgba(59, 130, 246, 0.3)',
                        cursor: 'pointer'
                      }}
                      onClick={() => { setSelectedList(listId); setSelectedListSource(null); }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <strong>{listId}</strong>
                          <span style={{
                            marginLeft: '0.5rem',
                            padding: '0.125rem 0.5rem',
                            background: list.source === 'manual' ? 'rgba(251, 191, 36, 0.2)' : 'rgba(34, 197, 94, 0.2)',
                            border: `1px solid ${list.source === 'manual' ? 'rgba(251, 191, 36, 0.4)' : 'rgba(34, 197, 94, 0.4)'}`,
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            color: list.source === 'manual' ? 'rgb(253, 224, 71)' : 'rgb(134, 239, 172)'
                          }}>
                            {list.source === 'manual' ? 'Manual' : 'LLM'}
                          </span>
                          {sharesWithOthers && (
                            <span style={{
                              marginLeft: '0.25rem',
                              padding: '0.125rem 0.5rem',
                              background: 'rgba(147, 51, 234, 0.2)',
                              border: '1px solid rgba(147, 51, 234, 0.4)',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              color: 'rgb(192, 132, 252)'
                            }}>
                              Shared
                            </span>
                          )}
                          <div style={{ fontSize: '0.875rem', color: 'var(--arctic-frost)', marginTop: '0.25rem' }}>
                            {list.entries?.length || 0} entries
                            {list.tokensUsed > 0 && ` • ${list.tokensUsed} tokens`}
                          </div>
                        </div>
                        <button
                          className="danger"
                          style={{ fontSize: '0.75rem' }}
                          onClick={(e) => { e.stopPropagation(); handleDeleteList(listId); }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Shared Lists Section */}
            {sharedLists.length > 0 && (
              <div style={{ marginTop: '1.5rem' }}>
                <h4 style={{ marginBottom: '0.5rem' }}>
                  Shared Lists ({sharedLists.length})
                </h4>
                <p className="text-muted" style={{ fontSize: '0.75rem', marginBottom: '0.5rem' }}>
                  Lists from other cultures/entity types that apply here
                </p>
                <div style={{ display: 'grid', gap: '0.5rem' }}>
                  {sharedLists.map((list) => {
                    const isSelected = selectedList === list.id &&
                      selectedListSource?.cultureId === list.sourceCulture &&
                      selectedListSource?.entityKind === list.sourceEntity;

                    return (
                      <div
                        key={`${list.sourceCulture}-${list.sourceEntity}-${list.id}`}
                        style={{
                          background: isSelected ? 'rgba(147, 51, 234, 0.1)' : 'rgba(30, 58, 95, 0.2)',
                          padding: '0.75rem 1rem',
                          borderRadius: '6px',
                          border: isSelected ? '1px solid rgba(147, 51, 234, 0.6)' : '1px solid rgba(147, 51, 234, 0.3)',
                          cursor: 'pointer'
                        }}
                        onClick={() => {
                          setSelectedList(list.id);
                          setSelectedListSource({ cultureId: list.sourceCulture, entityKind: list.sourceEntity });
                        }}
                      >
                        <div>
                          <strong>{list.id}</strong>
                          <span style={{
                            marginLeft: '0.5rem',
                            padding: '0.125rem 0.5rem',
                            background: 'rgba(147, 51, 234, 0.2)',
                            border: '1px solid rgba(147, 51, 234, 0.4)',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            color: 'rgb(192, 132, 252)'
                          }}>
                            from {list.sourceCulture}/{list.sourceEntity}
                          </span>
                          <div style={{ fontSize: '0.875rem', color: 'var(--arctic-frost)', marginTop: '0.25rem' }}>
                            {list.entries?.length || 0} entries
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Selected List Viewer */}
          {selectedList && (
            <div style={{
              flex: '0 0 45%',
              background: selectedListSource ? 'rgba(147, 51, 234, 0.1)' : 'rgba(30, 58, 95, 0.2)',
              borderRadius: '6px',
              padding: '1rem',
              border: selectedListSource ? '1px solid rgba(147, 51, 234, 0.3)' : '1px solid rgba(59, 130, 246, 0.3)',
              maxHeight: '500px',
              overflowY: 'auto'
            }}>
              {(() => {
                const list = selectedListSource
                  ? sharedLists.find(l => l.id === selectedList && l.sourceCulture === selectedListSource.cultureId && l.sourceEntity === selectedListSource.entityKind)
                  : lexemeLists[selectedList];

                if (!list) return null;

                return (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <h4 style={{ margin: 0 }}>{selectedList}</h4>
                      <button className="secondary" style={{ fontSize: '0.75rem' }} onClick={() => { setSelectedList(null); setSelectedListSource(null); }}>
                        Close
                      </button>
                    </div>

                    {selectedListSource && (
                      <div style={{
                        background: 'rgba(147, 51, 234, 0.2)',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '4px',
                        marginBottom: '1rem',
                        fontSize: '0.75rem',
                        color: 'rgb(192, 132, 252)'
                      }}>
                        Shared from: {selectedListSource.cultureId} / {selectedListSource.entityKind}
                      </div>
                    )}

                    {list.description && (
                      <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>
                        {list.description}
                      </p>
                    )}

                    {/* Sharing info */}
                    {list.appliesTo && (
                      <div style={{ marginBottom: '1rem', fontSize: '0.75rem', color: 'var(--arctic-frost)' }}>
                        <div>Cultures: {list.appliesTo.cultures?.includes('*') ? 'All' : list.appliesTo.cultures?.join(', ') || 'This only'}</div>
                        <div>Entities: {list.appliesTo.entityKinds?.includes('*') ? 'All' : list.appliesTo.entityKinds?.join(', ') || 'This only'}</div>
                      </div>
                    )}

                    <div style={{
                      background: 'rgba(0, 0, 0, 0.2)',
                      padding: '0.75rem',
                      borderRadius: '4px',
                      fontFamily: 'monospace',
                      fontSize: '0.875rem',
                      whiteSpace: 'pre-wrap',
                      maxHeight: '300px',
                      overflowY: 'auto'
                    }}>
                      {JSON.stringify(list.entries, null, 2)}
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>

        {/* API Key Section (collapsed by default) */}
        {lexemeSpecs.length > 0 && (
          <div style={{ marginTop: '1.5rem' }}>
            <details>
              <summary style={{ cursor: 'pointer', color: 'var(--arctic-frost)' }}>
                API Key Settings
              </summary>
              <div style={{ marginTop: '0.5rem' }}>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-ant-... (required if not set in server environment)"
                  style={{ width: '100%' }}
                />
              </div>
            </details>
          </div>
        )}
      </div>
    );
  }

  // Create Spec Mode
  if (mode === 'create-spec') {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0 }}>New Lexeme Spec</h3>
        </div>

        <p className="text-muted" style={{ marginBottom: '1rem' }}>
          Define what kind of words to generate. The LLM will create words matching your domain's phonology.
        </p>

        {error && <div className="error" style={{ marginBottom: '1rem' }}>{error}</div>}

        <div className="form-group">
          <label>Spec ID</label>
          <input
            value={specForm.id}
            onChange={(e) => setSpecForm({ ...specForm, id: e.target.value })}
            placeholder={`${cultureId}_${entityKind}_nouns`}
          />
          <small className="text-muted">Unique identifier for this spec</small>
        </div>

        <div className="form-grid-2">
          <div className="form-group">
            <label>Part of Speech</label>
            <select
              value={specForm.pos}
              onChange={(e) => setSpecForm({ ...specForm, pos: e.target.value })}
            >
              {POS_TAGS.map(tag => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Target Count</label>
            <input
              type="number"
              value={specForm.targetCount}
              onChange={(e) => setSpecForm({ ...specForm, targetCount: parseInt(e.target.value) || 30 })}
            />
          </div>
        </div>

        <div className="form-group">
          <label>Style Description</label>
          <textarea
            value={specForm.style}
            onChange={(e) => setSpecForm({ ...specForm, style: e.target.value })}
            placeholder={`e.g., ${entityKind === 'npc' ? 'heroic, noble-sounding personal names' : entityKind === 'location' ? 'mystical, ancient place names' : 'powerful, evocative names'}`}
            rows={3}
          />
          <small className="text-muted">
            Describe the feel/theme for these words.
            {subtypes.length > 0 && (
              <span> Subtypes for {entityKind}: <em>{subtypes.join(', ')}</em></span>
            )}
          </small>
        </div>

        {effectiveDomain && (
          <div style={{
            background: 'rgba(34, 197, 94, 0.1)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            borderRadius: '6px',
            padding: '0.75rem',
            marginBottom: '1rem',
            fontSize: '0.875rem'
          }}>
            Using domain: <strong>{effectiveDomain.id}</strong>
            <span className="text-muted" style={{ marginLeft: '0.5rem' }}>
              (consonants: {effectiveDomain.phonology?.consonants?.length || 0},
              vowels: {effectiveDomain.phonology?.vowels?.length || 0})
            </span>
          </div>
        )}

        {!effectiveDomain && (
          <div style={{
            background: 'rgba(251, 191, 36, 0.1)',
            border: '1px solid rgba(251, 191, 36, 0.3)',
            borderRadius: '6px',
            padding: '0.75rem',
            marginBottom: '1rem',
            fontSize: '0.875rem',
            color: 'rgb(253, 224, 71)'
          }}>
            No domain configured. Create a domain first for better phonology-guided generation.
          </div>
        )}

        <div className="form-grid-2">
          <div className="form-group">
            <label>Min Length</label>
            <input
              type="number"
              value={specForm.qualityFilter.minLength}
              onChange={(e) => setSpecForm({
                ...specForm,
                qualityFilter: { ...specForm.qualityFilter, minLength: parseInt(e.target.value) || 3 }
              })}
            />
          </div>
          <div className="form-group">
            <label>Max Length</label>
            <input
              type="number"
              value={specForm.qualityFilter.maxLength}
              onChange={(e) => setSpecForm({
                ...specForm,
                qualityFilter: { ...specForm.qualityFilter, maxLength: parseInt(e.target.value) || 15 }
              })}
            />
          </div>
        </div>

        {/* Sharing Options */}
        <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(147, 51, 234, 0.1)', borderRadius: '6px', border: '1px solid rgba(147, 51, 234, 0.3)' }}>
          <h4 style={{ margin: '0 0 0.75rem 0', color: 'rgb(192, 132, 252)' }}>Sharing Options</h4>

          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label style={{ fontSize: '0.875rem' }}>Share with Cultures</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.25rem' }}>
              <button
                type="button"
                onClick={() => setSpecForm({
                  ...specForm,
                  appliesTo: { ...specForm.appliesTo, cultures: ['*'] }
                })}
                style={{
                  padding: '0.25rem 0.75rem',
                  borderRadius: '4px',
                  border: '1px solid',
                  borderColor: specForm.appliesTo?.cultures?.includes('*') ? 'rgb(192, 132, 252)' : 'var(--border-color)',
                  background: specForm.appliesTo?.cultures?.includes('*') ? 'rgba(147, 51, 234, 0.2)' : 'transparent',
                  color: specForm.appliesTo?.cultures?.includes('*') ? 'rgb(192, 132, 252)' : 'var(--text-color)',
                  cursor: 'pointer',
                  fontSize: '0.875rem'
                }}
              >
                All Cultures
              </button>
              {allCultureIds.map(cultId => (
                <button
                  key={cultId}
                  type="button"
                  onClick={() => {
                    const current = specForm.appliesTo?.cultures || [];
                    const filtered = current.filter(c => c !== '*');
                    const newCultures = filtered.includes(cultId)
                      ? filtered.filter(c => c !== cultId)
                      : [...filtered, cultId];
                    setSpecForm({
                      ...specForm,
                      appliesTo: { ...specForm.appliesTo, cultures: newCultures.length ? newCultures : [cultureId] }
                    });
                  }}
                  style={{
                    padding: '0.25rem 0.75rem',
                    borderRadius: '4px',
                    border: '1px solid',
                    borderColor: specForm.appliesTo?.cultures?.includes(cultId) && !specForm.appliesTo?.cultures?.includes('*') ? 'var(--gold-accent)' : 'var(--border-color)',
                    background: specForm.appliesTo?.cultures?.includes(cultId) && !specForm.appliesTo?.cultures?.includes('*') ? 'rgba(212, 175, 55, 0.2)' : 'transparent',
                    color: specForm.appliesTo?.cultures?.includes(cultId) && !specForm.appliesTo?.cultures?.includes('*') ? 'var(--gold-accent)' : 'var(--text-color)',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    textTransform: 'capitalize'
                  }}
                >
                  {cultId}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: '0.875rem' }}>Share with Entity Types</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.25rem' }}>
              <button
                type="button"
                onClick={() => setSpecForm({
                  ...specForm,
                  appliesTo: { ...specForm.appliesTo, entityKinds: ['*'] }
                })}
                style={{
                  padding: '0.25rem 0.75rem',
                  borderRadius: '4px',
                  border: '1px solid',
                  borderColor: specForm.appliesTo?.entityKinds?.includes('*') ? 'rgb(192, 132, 252)' : 'var(--border-color)',
                  background: specForm.appliesTo?.entityKinds?.includes('*') ? 'rgba(147, 51, 234, 0.2)' : 'transparent',
                  color: specForm.appliesTo?.entityKinds?.includes('*') ? 'rgb(192, 132, 252)' : 'var(--text-color)',
                  cursor: 'pointer',
                  fontSize: '0.875rem'
                }}
              >
                All Types
              </button>
              {allEntityKinds.map(kind => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => {
                    const current = specForm.appliesTo?.entityKinds || [];
                    const filtered = current.filter(k => k !== '*');
                    const newKinds = filtered.includes(kind)
                      ? filtered.filter(k => k !== kind)
                      : [...filtered, kind];
                    setSpecForm({
                      ...specForm,
                      appliesTo: { ...specForm.appliesTo, entityKinds: newKinds.length ? newKinds : [entityKind] }
                    });
                  }}
                  style={{
                    padding: '0.25rem 0.75rem',
                    borderRadius: '4px',
                    border: '1px solid',
                    borderColor: specForm.appliesTo?.entityKinds?.includes(kind) && !specForm.appliesTo?.entityKinds?.includes('*') ? 'var(--gold-accent)' : 'var(--border-color)',
                    background: specForm.appliesTo?.entityKinds?.includes(kind) && !specForm.appliesTo?.entityKinds?.includes('*') ? 'rgba(212, 175, 55, 0.2)' : 'transparent',
                    color: specForm.appliesTo?.entityKinds?.includes(kind) && !specForm.appliesTo?.entityKinds?.includes('*') ? 'var(--gold-accent)' : 'var(--text-color)',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    textTransform: 'capitalize'
                  }}
                >
                  {kind}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
          <button className="primary" onClick={handleSaveSpec}>Save Spec</button>
          <button className="secondary" onClick={() => setMode('view')}>Cancel</button>
        </div>
      </div>
    );
  }

  // Create Manual List Mode
  if (mode === 'create-manual') {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0 }}>Create Manual List</h3>
        </div>

        <p className="text-muted" style={{ marginBottom: '1rem' }}>
          Manually create a lexeme list without LLM generation. Perfect for function words like prepositions, articles, connectors, titles, etc.
        </p>

        {error && <div className="error" style={{ marginBottom: '1rem' }}>{error}</div>}

        <div className="form-group">
          <label>List ID</label>
          <input
            value={manualForm.id}
            onChange={(e) => setManualForm({ ...manualForm, id: e.target.value })}
            placeholder={`${cultureId}_${entityKind}_titles`}
          />
          <small className="text-muted">Use this ID with slot:list_id syntax in templates</small>
        </div>

        <div className="form-group">
          <label>Description (optional)</label>
          <input
            value={manualForm.description}
            onChange={(e) => setManualForm({ ...manualForm, description: e.target.value })}
            placeholder="e.g., Common titles and honorifics"
          />
        </div>

        <div className="form-group">
          <label>Entries</label>
          <textarea
            value={manualForm.entries}
            onChange={(e) => setManualForm({ ...manualForm, entries: e.target.value })}
            placeholder={`Enter one per line or comma-separated:\nLord\nLady\nSir\nMaster\nElder`}
            rows={10}
            style={{ fontFamily: 'monospace' }}
          />
          <small className="text-muted">
            Enter one entry per line, or use commas to separate. Empty lines will be ignored.
          </small>
        </div>

        {/* Sharing Options */}
        <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(147, 51, 234, 0.1)', borderRadius: '6px', border: '1px solid rgba(147, 51, 234, 0.3)' }}>
          <h4 style={{ margin: '0 0 0.75rem 0', color: 'rgb(192, 132, 252)' }}>Sharing Options</h4>

          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label style={{ fontSize: '0.875rem' }}>Share with Cultures</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.25rem' }}>
              <button
                type="button"
                onClick={() => setManualForm({
                  ...manualForm,
                  appliesTo: { ...manualForm.appliesTo, cultures: ['*'] }
                })}
                style={{
                  padding: '0.25rem 0.75rem',
                  borderRadius: '4px',
                  border: '1px solid',
                  borderColor: manualForm.appliesTo?.cultures?.includes('*') ? 'rgb(192, 132, 252)' : 'var(--border-color)',
                  background: manualForm.appliesTo?.cultures?.includes('*') ? 'rgba(147, 51, 234, 0.2)' : 'transparent',
                  color: manualForm.appliesTo?.cultures?.includes('*') ? 'rgb(192, 132, 252)' : 'var(--text-color)',
                  cursor: 'pointer',
                  fontSize: '0.875rem'
                }}
              >
                All Cultures
              </button>
              {allCultureIds.map(cultId => (
                <button
                  key={cultId}
                  type="button"
                  onClick={() => {
                    const current = manualForm.appliesTo?.cultures || [];
                    const filtered = current.filter(c => c !== '*');
                    const newCultures = filtered.includes(cultId)
                      ? filtered.filter(c => c !== cultId)
                      : [...filtered, cultId];
                    setManualForm({
                      ...manualForm,
                      appliesTo: { ...manualForm.appliesTo, cultures: newCultures.length ? newCultures : [cultureId] }
                    });
                  }}
                  style={{
                    padding: '0.25rem 0.75rem',
                    borderRadius: '4px',
                    border: '1px solid',
                    borderColor: manualForm.appliesTo?.cultures?.includes(cultId) && !manualForm.appliesTo?.cultures?.includes('*') ? 'var(--gold-accent)' : 'var(--border-color)',
                    background: manualForm.appliesTo?.cultures?.includes(cultId) && !manualForm.appliesTo?.cultures?.includes('*') ? 'rgba(212, 175, 55, 0.2)' : 'transparent',
                    color: manualForm.appliesTo?.cultures?.includes(cultId) && !manualForm.appliesTo?.cultures?.includes('*') ? 'var(--gold-accent)' : 'var(--text-color)',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    textTransform: 'capitalize'
                  }}
                >
                  {cultId}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: '0.875rem' }}>Share with Entity Types</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.25rem' }}>
              <button
                type="button"
                onClick={() => setManualForm({
                  ...manualForm,
                  appliesTo: { ...manualForm.appliesTo, entityKinds: ['*'] }
                })}
                style={{
                  padding: '0.25rem 0.75rem',
                  borderRadius: '4px',
                  border: '1px solid',
                  borderColor: manualForm.appliesTo?.entityKinds?.includes('*') ? 'rgb(192, 132, 252)' : 'var(--border-color)',
                  background: manualForm.appliesTo?.entityKinds?.includes('*') ? 'rgba(147, 51, 234, 0.2)' : 'transparent',
                  color: manualForm.appliesTo?.entityKinds?.includes('*') ? 'rgb(192, 132, 252)' : 'var(--text-color)',
                  cursor: 'pointer',
                  fontSize: '0.875rem'
                }}
              >
                All Types
              </button>
              {allEntityKinds.map(kind => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => {
                    const current = manualForm.appliesTo?.entityKinds || [];
                    const filtered = current.filter(k => k !== '*');
                    const newKinds = filtered.includes(kind)
                      ? filtered.filter(k => k !== kind)
                      : [...filtered, kind];
                    setManualForm({
                      ...manualForm,
                      appliesTo: { ...manualForm.appliesTo, entityKinds: newKinds.length ? newKinds : [entityKind] }
                    });
                  }}
                  style={{
                    padding: '0.25rem 0.75rem',
                    borderRadius: '4px',
                    border: '1px solid',
                    borderColor: manualForm.appliesTo?.entityKinds?.includes(kind) && !manualForm.appliesTo?.entityKinds?.includes('*') ? 'var(--gold-accent)' : 'var(--border-color)',
                    background: manualForm.appliesTo?.entityKinds?.includes(kind) && !manualForm.appliesTo?.entityKinds?.includes('*') ? 'rgba(212, 175, 55, 0.2)' : 'transparent',
                    color: manualForm.appliesTo?.entityKinds?.includes(kind) && !manualForm.appliesTo?.entityKinds?.includes('*') ? 'var(--gold-accent)' : 'var(--text-color)',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    textTransform: 'capitalize'
                  }}
                >
                  {kind}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
          <button className="primary" onClick={handleSaveManualList}>Save List</button>
          <button className="secondary" onClick={() => setMode('view')}>Cancel</button>
        </div>
      </div>
    );
  }

  return null;
}

// Templates Tab Component
const SLOT_KINDS = ['lexemeList', 'phonotactic', 'grammar', 'entityName'];

function TemplatesTab({ metaDomain, cultureId, entityKind, entityConfig, onConfigChange, worldSchema, cultureConfig, allCultures }) {
  const [mode, setMode] = useState('view');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [apiKey, setApiKey] = useState('');

  // Get all available lexeme lists for slot hints
  const getAvailableLexemeLists = () => {
    const lists = [];
    // Local lists
    if (entityConfig?.lexemeLists) {
      Object.keys(entityConfig.lexemeLists).forEach(id => {
        lists.push({ id, source: 'local' });
      });
    }
    // Shared lists from same culture
    if (cultureConfig?.entityConfigs) {
      Object.entries(cultureConfig.entityConfigs).forEach(([kind, config]) => {
        if (kind !== entityKind && config?.lexemeLists) {
          Object.entries(config.lexemeLists).forEach(([id, list]) => {
            const appliesTo = list.appliesTo || {};
            const cultureMatch = !appliesTo.cultures?.length || appliesTo.cultures.includes('*') || appliesTo.cultures.includes(cultureId);
            const entityMatch = !appliesTo.entityKinds?.length || appliesTo.entityKinds.includes('*') || appliesTo.entityKinds.includes(entityKind);
            if (cultureMatch && entityMatch) {
              lists.push({ id, source: `${cultureId}/${kind}` });
            }
          });
        }
      });
    }
    return lists;
  };

  const availableLexemeLists = getAvailableLexemeLists();

  // Get effective domain for phonotactic generation
  const getEffectiveDomain = () => {
    if (entityConfig?.domain) return entityConfig.domain;
    if (cultureConfig?.entityConfigs) {
      for (const [kind, config] of Object.entries(cultureConfig.entityConfigs)) {
        if (config?.domain) {
          const appliesTo = config.domain.appliesTo?.kind || [];
          if (appliesTo.includes(entityKind) || appliesTo.includes('*')) return config.domain;
        }
      }
    }
    return null;
  };
  const effectiveDomain = getEffectiveDomain();

  // Extract slot names from template pattern
  const extractSlotNames = (templatePattern) => {
    const regex = /\{\{([^}]+)\}\}/g;
    const slots = [];
    let match;
    while ((match = regex.exec(templatePattern)) !== null) {
      if (!slots.includes(match[1])) {
        slots.push(match[1]);
      }
    }
    return slots;
  };

  // Update slot configurations when template changes
  const handleTemplateChange = (newTemplate) => {
    const slotNames = extractSlotNames(newTemplate);
    const newSlots = { ...manualForm.slots };

    // Add new slots with default config
    slotNames.forEach(name => {
      if (!newSlots[name]) {
        newSlots[name] = { kind: 'lexemeList', listId: name };
      }
    });

    // Remove slots that are no longer in template
    Object.keys(newSlots).forEach(name => {
      if (!slotNames.includes(name)) {
        delete newSlots[name];
      }
    });

    setManualForm({ ...manualForm, template: newTemplate, slots: newSlots });
  };

  // Update a specific slot's configuration
  const handleSlotConfigChange = (slotName, field, value) => {
    const newSlots = { ...manualForm.slots };
    newSlots[slotName] = { ...newSlots[slotName], [field]: value };

    // Clear irrelevant fields when kind changes
    if (field === 'kind') {
      if (value === 'lexemeList') {
        delete newSlots[slotName].domainId;
        if (!newSlots[slotName].listId) {
          newSlots[slotName].listId = slotName;
        }
      } else if (value === 'phonotactic') {
        delete newSlots[slotName].listId;
        if (!newSlots[slotName].domainId && effectiveDomain) {
          newSlots[slotName].domainId = effectiveDomain.id;
        }
      }
    }

    setManualForm({ ...manualForm, slots: newSlots });
  };

  // Form state for spec creation
  const [specForm, setSpecForm] = useState({
    id: `${cultureId}_${entityKind}_templates`,
    type: entityKind,
    style: '',
    targetCount: 5,
    slotHints: []
  });

  // Form state for manual template creation
  const [manualForm, setManualForm] = useState({
    id: `${cultureId}_${entityKind}_template_1`,
    template: '',
    description: '',
    slots: {}
  });

  // Get templates and specs from entity config
  const templates = entityConfig?.templates || [];
  const templateSpecs = entityConfig?.templateSpecs || [];

  const handleAddSlotHint = () => {
    setSpecForm({
      ...specForm,
      slotHints: [...specForm.slotHints, { name: '', kind: 'lexemeList', description: '' }]
    });
  };

  const handleUpdateSlotHint = (index, field, value) => {
    const updated = [...specForm.slotHints];
    updated[index] = { ...updated[index], [field]: value };
    setSpecForm({ ...specForm, slotHints: updated });
  };

  const handleRemoveSlotHint = (index) => {
    setSpecForm({
      ...specForm,
      slotHints: specForm.slotHints.filter((_, i) => i !== index)
    });
  };

  const handleSaveSpec = () => {
    if (!specForm.id.trim()) {
      setError('Please enter a spec ID');
      return;
    }

    const newSpec = {
      ...specForm,
      cultureId,
      entityKind
    };

    const updatedSpecs = [...templateSpecs.filter(s => s.id !== newSpec.id), newSpec];
    const updatedConfig = {
      ...entityConfig,
      templateSpecs: updatedSpecs
    };
    onConfigChange(updatedConfig);
    setMode('view');
    setSpecForm({
      id: `${cultureId}_${entityKind}_templates`,
      type: entityKind,
      style: '',
      targetCount: 5,
      slotHints: []
    });
    setError(null);
  };

  const handleDeleteSpec = (specId) => {
    const updatedSpecs = templateSpecs.filter(s => s.id !== specId);
    onConfigChange({ ...entityConfig, templateSpecs: updatedSpecs });
  };

  const handleSaveManualTemplate = () => {
    if (!manualForm.id.trim()) {
      setError('Please enter a template ID');
      return;
    }
    if (!manualForm.template.trim()) {
      setError('Please enter the template pattern');
      return;
    }

    const newTemplate = {
      id: manualForm.id,
      template: manualForm.template,
      description: manualForm.description || '',
      slots: manualForm.slots,
      source: 'manual'
    };

    const updatedTemplates = [...templates.filter(t => t.id !== newTemplate.id), newTemplate];
    const updatedConfig = {
      ...entityConfig,
      templates: updatedTemplates,
      completionStatus: {
        ...entityConfig?.completionStatus,
        templates: updatedTemplates.length > 0
      }
    };

    onConfigChange(updatedConfig);
    setMode('view');
    setManualForm({
      id: `${cultureId}_${entityKind}_template_${updatedTemplates.length + 1}`,
      template: '',
      description: '',
      slots: {}
    });
    setError(null);
  };

  const handleGenerate = async (spec) => {
    setLoading(true);
    setError(null);

    try {
      const requestBody = {
        spec: {
          ...spec,
          cultureId,
          entityKind
        },
        metaDomain: metaDomain
      };

      if (apiKey && apiKey.trim()) {
        requestBody.apiKey = apiKey.trim();
      }

      const response = await fetch(`${API_URL}/api/generate/template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Generation failed');
      }

      const data = await response.json();

      // Add generated templates to the list
      const newTemplates = (data.result.templates || []).map(t => ({
        ...t,
        source: 'llm',
        specId: spec.id
      }));

      const updatedTemplates = [
        ...templates.filter(t => t.specId !== spec.id), // Remove old generated from same spec
        ...newTemplates
      ];

      const updatedConfig = {
        ...entityConfig,
        templates: updatedTemplates,
        completionStatus: {
          ...entityConfig?.completionStatus,
          templates: updatedTemplates.length > 0
        }
      };

      onConfigChange(updatedConfig);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTemplate = (templateId) => {
    const updatedTemplates = templates.filter(t => t.id !== templateId);
    const updatedConfig = {
      ...entityConfig,
      templates: updatedTemplates,
      completionStatus: {
        ...entityConfig?.completionStatus,
        templates: updatedTemplates.length > 0
      }
    };
    onConfigChange(updatedConfig);
    if (selectedTemplate === templateId) setSelectedTemplate(null);
  };

  // View mode
  if (mode === 'view') {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0 }}>Name Templates</h3>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="primary" onClick={() => setMode('create-spec')}>
              + New Spec
            </button>
            <button className="secondary" onClick={() => setMode('create-manual')}>
              + Manual Template
            </button>
          </div>
        </div>

        <p className="text-muted" style={{ marginBottom: '1rem' }}>
          Create template specs to generate Handlebars templates via LLM, or add manual templates.
          Templates use slots like <code>{`{{NOUN}}`}</code> that reference lexeme lists.
        </p>

        {error && <div className="error" style={{ marginBottom: '1rem' }}>{error}</div>}

        {/* Template Specs Section */}
        {templateSpecs.length > 0 && (
          <div style={{ marginBottom: '1.5rem' }}>
            <h4 style={{ marginBottom: '0.5rem' }}>Generation Specs ({templateSpecs.length})</h4>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {templateSpecs.map(spec => {
                const generatedCount = templates.filter(t => t.specId === spec.id).length;
                return (
                  <div
                    key={spec.id}
                    style={{
                      background: 'rgba(30, 58, 95, 0.3)',
                      padding: '0.75rem 1rem',
                      borderRadius: '6px',
                      border: '1px solid rgba(59, 130, 246, 0.3)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <strong>{spec.id}</strong>
                        {generatedCount > 0 && (
                          <span style={{
                            marginLeft: '0.5rem',
                            padding: '0.125rem 0.5rem',
                            background: 'rgba(34, 197, 94, 0.2)',
                            border: '1px solid rgba(34, 197, 94, 0.4)',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            color: 'rgb(134, 239, 172)'
                          }}>
                            Generated ({generatedCount})
                          </span>
                        )}
                        <div style={{ fontSize: '0.875rem', color: 'var(--arctic-frost)', marginTop: '0.25rem' }}>
                          {spec.type} • {spec.targetCount} templates • {spec.slotHints?.length || 0} slots
                        </div>
                        {spec.style && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--arctic-frost)', marginTop: '0.25rem' }}>
                            {spec.style.substring(0, 80)}{spec.style.length > 80 ? '...' : ''}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          className="primary"
                          style={{ fontSize: '0.875rem' }}
                          onClick={() => handleGenerate(spec)}
                          disabled={loading}
                        >
                          {loading ? '...' : generatedCount > 0 ? 'Regenerate' : 'Generate'}
                        </button>
                        <button
                          className="danger"
                          style={{ fontSize: '0.875rem' }}
                          onClick={() => handleDeleteSpec(spec.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Templates List */}
        <div style={{ display: 'flex', gap: '1.5rem' }}>
          <div style={{ flex: selectedTemplate ? '0 0 50%' : '1' }}>
            <h4 style={{ marginBottom: '0.5rem' }}>
              All Templates ({templates.length})
            </h4>

            {templates.length === 0 ? (
              <div style={{
                background: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: '6px',
                padding: '1.5rem',
                textAlign: 'center'
              }}>
                <p style={{ margin: 0 }}>No templates yet.</p>
                <p className="text-muted" style={{ marginTop: '0.5rem' }}>
                  Create a spec and generate via LLM, or add a manual template.
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                {templates.map((template) => (
                  <div
                    key={template.id}
                    style={{
                      background: selectedTemplate === template.id ? 'rgba(212, 175, 55, 0.1)' : 'rgba(30, 58, 95, 0.3)',
                      padding: '0.75rem 1rem',
                      borderRadius: '6px',
                      border: selectedTemplate === template.id ? '1px solid var(--gold-accent)' : '1px solid rgba(59, 130, 246, 0.3)',
                      cursor: 'pointer'
                    }}
                    onClick={() => setSelectedTemplate(template.id)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <strong>{template.id}</strong>
                          <span style={{
                            padding: '0.125rem 0.5rem',
                            background: template.source === 'manual' ? 'rgba(251, 191, 36, 0.2)' : 'rgba(34, 197, 94, 0.2)',
                            border: `1px solid ${template.source === 'manual' ? 'rgba(251, 191, 36, 0.4)' : 'rgba(34, 197, 94, 0.4)'}`,
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            color: template.source === 'manual' ? 'rgb(253, 224, 71)' : 'rgb(134, 239, 172)'
                          }}>
                            {template.source === 'manual' ? 'Manual' : 'LLM'}
                          </span>
                        </div>
                        <code style={{
                          display: 'block',
                          marginTop: '0.5rem',
                          fontSize: '0.875rem',
                          color: 'var(--gold-accent)',
                          wordBreak: 'break-all'
                        }}>
                          {template.template}
                        </code>
                      </div>
                      <button
                        className="danger"
                        style={{ fontSize: '0.75rem', marginLeft: '0.5rem' }}
                        onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(template.id); }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Selected Template Viewer */}
          {selectedTemplate && templates.find(t => t.id === selectedTemplate) && (
            <div style={{
              flex: '0 0 45%',
              background: 'rgba(30, 58, 95, 0.2)',
              borderRadius: '6px',
              padding: '1rem',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              maxHeight: '400px',
              overflowY: 'auto'
            }}>
              {(() => {
                const template = templates.find(t => t.id === selectedTemplate);
                return (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <h4 style={{ margin: 0 }}>{template.id}</h4>
                      <button className="secondary" style={{ fontSize: '0.75rem' }} onClick={() => setSelectedTemplate(null)}>
                        Close
                      </button>
                    </div>

                    {template.description && (
                      <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>
                        {template.description}
                      </p>
                    )}

                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ fontSize: '0.75rem', color: 'var(--arctic-frost)' }}>Template:</label>
                      <code style={{
                        display: 'block',
                        marginTop: '0.25rem',
                        padding: '0.5rem',
                        background: 'rgba(0, 0, 0, 0.2)',
                        borderRadius: '4px',
                        color: 'var(--gold-accent)',
                        wordBreak: 'break-all'
                      }}>
                        {template.template}
                      </code>
                    </div>

                    {template.slots && Object.keys(template.slots).length > 0 && (
                      <div>
                        <label style={{ fontSize: '0.75rem', color: 'var(--arctic-frost)' }}>Slots:</label>
                        <div style={{
                          marginTop: '0.25rem',
                          padding: '0.5rem',
                          background: 'rgba(0, 0, 0, 0.2)',
                          borderRadius: '4px',
                          fontSize: '0.875rem'
                        }}>
                          {Object.entries(template.slots).map(([name, config]) => (
                            <div key={name} style={{ marginBottom: '0.25rem' }}>
                              <code>{name}</code>: {config.kind || 'lexemeList'}
                              {config.description && <span className="text-muted"> - {config.description}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}
        </div>

        {/* API Key Section */}
        {templateSpecs.length > 0 && (
          <div style={{ marginTop: '1.5rem' }}>
            <details>
              <summary style={{ cursor: 'pointer', color: 'var(--arctic-frost)' }}>
                API Key Settings
              </summary>
              <div style={{ marginTop: '0.5rem' }}>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-ant-... (required if not set in server environment)"
                  style={{ width: '100%' }}
                />
              </div>
            </details>
          </div>
        )}
      </div>
    );
  }

  // Create Spec Mode
  if (mode === 'create-spec') {
    return (
      <div>
        <h3>New Template Spec</h3>
        <p className="text-muted" style={{ marginBottom: '1rem' }}>
          Define what kind of templates to generate. The LLM will create Handlebars templates using your slot definitions.
        </p>

        {error && <div className="error" style={{ marginBottom: '1rem' }}>{error}</div>}

        <div className="form-group">
          <label>Spec ID</label>
          <input
            value={specForm.id}
            onChange={(e) => setSpecForm({ ...specForm, id: e.target.value })}
            placeholder={`${cultureId}_${entityKind}_templates`}
          />
        </div>

        <div className="form-grid-2">
          <div className="form-group">
            <label>Entity Type</label>
            <input
              value={specForm.type}
              onChange={(e) => setSpecForm({ ...specForm, type: e.target.value })}
              placeholder="e.g., person, location, spell"
            />
          </div>

          <div className="form-group">
            <label>Target Count</label>
            <input
              type="number"
              value={specForm.targetCount}
              onChange={(e) => setSpecForm({ ...specForm, targetCount: parseInt(e.target.value) || 5 })}
            />
          </div>
        </div>

        <div className="form-group">
          <label>Style Description</label>
          <textarea
            value={specForm.style}
            onChange={(e) => setSpecForm({ ...specForm, style: e.target.value })}
            placeholder="e.g., elegant flowing names with nature themes, titles with honorifics"
            rows={3}
          />
        </div>

        {/* Slot Hints */}
        <div className="form-group">
          <label>Slot Hints</label>
          <small className="text-muted" style={{ display: 'block', marginBottom: '0.5rem' }}>
            Define available slots that templates can use (e.g., NOUN, ADJECTIVE, TITLE)
          </small>

          {specForm.slotHints.map((hint, index) => (
            <div key={index} style={{
              background: 'rgba(30, 58, 95, 0.4)',
              padding: '1rem',
              borderRadius: '6px',
              marginBottom: '0.5rem',
              border: '1px solid rgba(59, 130, 246, 0.3)'
            }}>
              <div className="form-grid-2">
                <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                  <label style={{ fontSize: '0.875rem' }}>Slot Name</label>
                  {hint.kind === 'lexemeList' && availableLexemeLists.length > 0 ? (
                    <select
                      value={hint.name}
                      onChange={(e) => handleUpdateSlotHint(index, 'name', e.target.value)}
                    >
                      <option value="">Select a lexeme list...</option>
                      {availableLexemeLists.map(({ id, source }) => (
                        <option key={`${source}-${id}`} value={id}>
                          {id} {source !== 'local' && `(${source})`}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={hint.name}
                      onChange={(e) => handleUpdateSlotHint(index, 'name', e.target.value)}
                      placeholder={hint.kind === 'lexemeList' ? 'No lists available' : 'e.g., NOUN, TITLE'}
                    />
                  )}
                </div>

                <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                  <label style={{ fontSize: '0.875rem' }}>Kind</label>
                  <select
                    value={hint.kind}
                    onChange={(e) => handleUpdateSlotHint(index, 'kind', e.target.value)}
                  >
                    {SLOT_KINDS.map(kind => (
                      <option key={kind} value={kind}>{kind}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                <label style={{ fontSize: '0.875rem' }}>Description</label>
                <input
                  value={hint.description}
                  onChange={(e) => handleUpdateSlotHint(index, 'description', e.target.value)}
                  placeholder="e.g., A descriptive adjective"
                />
              </div>

              <button
                className="danger"
                style={{ fontSize: '0.875rem' }}
                onClick={() => handleRemoveSlotHint(index)}
              >
                Remove Slot
              </button>
            </div>
          ))}

          <button className="secondary" onClick={handleAddSlotHint}>
            + Add Slot Hint
          </button>
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
          <button className="primary" onClick={handleSaveSpec}>Save Spec</button>
          <button className="secondary" onClick={() => setMode('view')}>Cancel</button>
        </div>
      </div>
    );
  }

  // Create Manual Template Mode
  if (mode === 'create-manual') {
    return (
      <div>
        <h3>Create Manual Template</h3>
        <p className="text-muted" style={{ marginBottom: '1rem' }}>
          Manually create a Handlebars template. Use <code>{`{{SLOT_NAME}}`}</code> for slots.
        </p>

        {error && <div className="error" style={{ marginBottom: '1rem' }}>{error}</div>}

        <div className="form-group">
          <label>Template ID</label>
          <input
            value={manualForm.id}
            onChange={(e) => setManualForm({ ...manualForm, id: e.target.value })}
            placeholder={`${cultureId}_${entityKind}_template_1`}
          />
        </div>

        <div className="form-group">
          <label>Template Pattern</label>
          <input
            value={manualForm.template}
            onChange={(e) => handleTemplateChange(e.target.value)}
            placeholder={`e.g., {{title}} {{name}} of {{place}}`}
            style={{ fontFamily: 'monospace' }}
          />
          <small className="text-muted">
            Use <code>{`{{slot_name}}`}</code> syntax. Each slot can be configured below.
          </small>
        </div>

        {/* Slot Configuration */}
        {Object.keys(manualForm.slots).length > 0 && (
          <div style={{
            marginTop: '1rem',
            padding: '1rem',
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '6px'
          }}>
            <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: 'bold' }}>
              Slot Configuration
            </label>
            <small className="text-muted" style={{ display: 'block', marginBottom: '1rem' }}>
              Configure each slot to pull from a lexeme list or generate phonotactically from a domain.
            </small>

            {Object.entries(manualForm.slots).map(([slotName, config]) => (
              <div
                key={slotName}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 2fr',
                  gap: '0.5rem',
                  alignItems: 'center',
                  marginBottom: '0.5rem',
                  padding: '0.5rem',
                  background: 'rgba(0, 0, 0, 0.2)',
                  borderRadius: '4px'
                }}
              >
                <code style={{ color: 'var(--gold-accent)' }}>{`{{${slotName}}}`}</code>

                <select
                  value={config.kind || 'lexemeList'}
                  onChange={(e) => handleSlotConfigChange(slotName, 'kind', e.target.value)}
                  style={{ padding: '0.25rem' }}
                >
                  <option value="lexemeList">Lexeme List</option>
                  <option value="phonotactic">Phonotactic (Domain)</option>
                </select>

                {config.kind === 'phonotactic' ? (
                  <select
                    value={config.domainId || ''}
                    onChange={(e) => handleSlotConfigChange(slotName, 'domainId', e.target.value)}
                    style={{ padding: '0.25rem' }}
                  >
                    <option value="">Select domain...</option>
                    {effectiveDomain && (
                      <option value={effectiveDomain.id}>{effectiveDomain.id} (current)</option>
                    )}
                  </select>
                ) : (
                  <select
                    value={config.listId || slotName}
                    onChange={(e) => handleSlotConfigChange(slotName, 'listId', e.target.value)}
                    style={{ padding: '0.25rem' }}
                  >
                    <option value={slotName}>{slotName} (match slot name)</option>
                    {availableLexemeLists.map(list => (
                      <option key={list.id} value={list.id}>
                        {list.id} {list.source !== 'local' ? `(${list.source})` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="form-group" style={{ marginTop: '1rem' }}>
          <label>Description (optional)</label>
          <input
            value={manualForm.description}
            onChange={(e) => setManualForm({ ...manualForm, description: e.target.value })}
            placeholder="e.g., Template for noble titles"
          />
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
          <button className="primary" onClick={handleSaveManualTemplate}>Save Template</button>
          <button className="secondary" onClick={() => setMode('view')}>Cancel</button>
        </div>
      </div>
    );
  }

  return null;
}

// Grammars Tab Component
function GrammarsTab({ entityConfig, onConfigChange, cultureId, entityKind, cultureConfig, allCultures, worldSchema }) {
  const [mode, setMode] = useState('view');
  const [editingGrammar, setEditingGrammar] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const [formData, setFormData] = useState({
    id: `${cultureId}_${entityKind}_grammar`,
    start: 'name',
    rules: {},
    appliesTo: { cultures: [cultureId], entityKinds: [entityKind] }
  });
  const [newRuleKey, setNewRuleKey] = useState('');
  const [newRuleValue, setNewRuleValue] = useState('');

  const grammars = entityConfig?.grammars || [];

  // Get all cultures and entity kinds for sharing options
  const allCultureIds = Object.keys(allCultures || {});
  const allEntityKinds = worldSchema?.hardState?.map(e => e.kind) || [];

  // Get effective domain for phonology hints
  const getEffectiveDomain = () => {
    if (entityConfig?.domain) return entityConfig.domain;
    if (cultureConfig?.entityConfigs) {
      for (const [kind, config] of Object.entries(cultureConfig.entityConfigs)) {
        if (config?.domain) {
          const appliesTo = config.domain.appliesTo?.kind || [];
          if (appliesTo.includes(entityKind)) return config.domain;
        }
      }
    }
    return null;
  };
  const effectiveDomain = getEffectiveDomain();

  // Get available lexeme lists (local and shared)
  const getAvailableLexemeLists = () => {
    const lists = [];
    // Local lists
    if (entityConfig?.lexemeLists) {
      Object.keys(entityConfig.lexemeLists).forEach(id => {
        lists.push({ id, source: 'local' });
      });
    }
    // Shared lists from same culture
    if (cultureConfig?.entityConfigs) {
      Object.entries(cultureConfig.entityConfigs).forEach(([kind, config]) => {
        if (kind !== entityKind && config?.lexemeLists) {
          Object.entries(config.lexemeLists).forEach(([id, list]) => {
            const appliesTo = list.appliesTo || {};
            const cultureMatch = !appliesTo.cultures?.length || appliesTo.cultures.includes('*') || appliesTo.cultures.includes(cultureId);
            const entityMatch = !appliesTo.entityKinds?.length || appliesTo.entityKinds.includes('*') || appliesTo.entityKinds.includes(entityKind);
            if (cultureMatch && entityMatch) {
              lists.push({ id, source: `${kind}` });
            }
          });
        }
      });
    }
    return lists;
  };
  const availableLexemeLists = getAvailableLexemeLists();

  const handleAddRule = () => {
    if (!newRuleKey.trim() || !newRuleValue.trim()) return;

    const newProductions = newRuleValue.split('|').map(p =>
      p.trim().split(/\s+/).filter(s => s)
    ).filter(p => p.length > 0);

    // If rule already exists, merge productions (add as alternatives)
    const existingProductions = formData.rules[newRuleKey] || [];
    const mergedProductions = [...existingProductions, ...newProductions];

    setFormData({
      ...formData,
      rules: {
        ...formData.rules,
        [newRuleKey]: mergedProductions
      }
    });
    setNewRuleKey('');
    setNewRuleValue('');
  };

  const handleDeleteRule = (key) => {
    const newRules = { ...formData.rules };
    delete newRules[key];
    setFormData({ ...formData, rules: newRules });
  };

  const handleSave = () => {
    if (!formData.id.trim()) return;

    const newGrammars = editingGrammar === 'new'
      ? [...grammars, formData]
      : grammars.map(g => g.id === formData.id ? formData : g);

    onConfigChange({
      ...entityConfig,
      grammars: newGrammars,
      completionStatus: {
        ...entityConfig?.completionStatus,
        grammars: newGrammars.length
      }
    });

    setMode('view');
    setEditingGrammar(null);
  };

  const handleDelete = (id) => {
    const newGrammars = grammars.filter(g => g.id !== id);
    onConfigChange({
      ...entityConfig,
      grammars: newGrammars,
      completionStatus: {
        ...entityConfig?.completionStatus,
        grammars: newGrammars.length
      }
    });
  };

  const handleEdit = (grammar) => {
    setEditingGrammar(grammar.id);
    setFormData(grammar);
    setMode('edit');
  };

  const handleAddNew = () => {
    setEditingGrammar('new');
    setFormData({
      id: `${cultureId}_${entityKind}_grammar`,
      start: 'name',
      rules: {},
      appliesTo: { cultures: [cultureId], entityKinds: [entityKind] }
    });
    setMode('edit');
  };

  const insertIntoRule = (text) => {
    setNewRuleValue(prev => prev ? `${prev} ${text}` : text);
  };

  // View mode
  if (mode === 'view') {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0 }}>Context-Free Grammars</h3>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="secondary" onClick={() => setShowHelp(true)}>? Help</button>
            <button className="primary" onClick={handleAddNew}>+ New Grammar</button>
          </div>
        </div>

        <p className="text-muted" style={{ marginBottom: '1rem' }}>
          Define grammar rules that reference lexeme lists using <code>slot:lexeme_id</code> syntax.
          Grammars provide structured name patterns with variable content.
        </p>

        {grammars.length === 0 ? (
          <div style={{
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '6px',
            padding: '1.5rem',
            textAlign: 'center'
          }}>
            <p style={{ margin: 0 }}>No grammars yet.</p>
            <p className="text-muted" style={{ marginTop: '0.5rem' }}>
              Create lexeme lists first, then define grammars to structure names.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {grammars.map((grammar) => {
              const isShared = grammar.appliesTo?.cultures?.includes('*') ||
                grammar.appliesTo?.entityKinds?.includes('*') ||
                (grammar.appliesTo?.cultures?.length > 1) ||
                (grammar.appliesTo?.entityKinds?.length > 1);

              return (
                <div
                  key={grammar.id}
                  style={{
                    background: isShared ? 'rgba(147, 51, 234, 0.15)' : 'rgba(30, 58, 95, 0.3)',
                    padding: '0.75rem 1rem',
                    borderRadius: '6px',
                    border: isShared ? '1px solid rgba(147, 51, 234, 0.3)' : '1px solid rgba(59, 130, 246, 0.3)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <strong>{grammar.id}</strong>
                      {isShared && (
                        <span style={{
                          marginLeft: '0.5rem',
                          padding: '0.125rem 0.5rem',
                          background: 'rgba(147, 51, 234, 0.3)',
                          color: 'rgb(192, 132, 252)',
                          borderRadius: '4px',
                          fontSize: '0.7rem'
                        }}>
                          SHARED
                        </span>
                      )}
                      <div style={{ fontSize: '0.875rem', color: 'var(--arctic-frost)', marginTop: '0.25rem' }}>
                        Start: <code>{grammar.start}</code> • {Object.keys(grammar.rules || {}).length} rules
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="secondary" style={{ fontSize: '0.875rem' }} onClick={() => handleEdit(grammar)}>
                        Edit
                      </button>
                      <button className="danger" style={{ fontSize: '0.875rem' }} onClick={() => handleDelete(grammar.id)}>
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Help Modal */}
        {showHelp && (
          <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '2rem'
          }} onClick={() => setShowHelp(false)}>
            <div style={{
              background: 'var(--arctic-dark)',
              borderRadius: '8px',
              padding: '2rem',
              maxWidth: '700px',
              maxHeight: '80vh',
              overflowY: 'auto',
              border: '2px solid var(--arctic-ice)'
            }} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0 }}>Context-Free Grammars</h3>
                <button className="secondary" onClick={() => setShowHelp(false)}>Close</button>
              </div>

              <div style={{ lineHeight: '1.6' }}>
                <p>CFGs define structured patterns for name generation. They combine fixed structure with variable content from lexeme lists.</p>

                <h4>Example Grammar</h4>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '4px', fontFamily: 'monospace', fontSize: '0.875rem' }}>
                  <div>Start: <strong>name</strong></div>
                  <div style={{ marginTop: '0.5rem' }}>
                    <div>name → adj - noun</div>
                    <div>adj → slot:adjectives</div>
                    <div>noun → slot:nouns</div>
                  </div>
                </div>
                <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
                  Generates names like: "Swift-Scale", "Dark-Fang", "Silent-Shadow"
                </p>

                <h4>Syntax</h4>
                <ul style={{ fontSize: '0.875rem' }}>
                  <li><code>slot:lexeme_id</code> - Pull from a lexeme list</li>
                  <li><code>domain:domain_id</code> - Generate phonotactic name from a domain</li>
                  <li><code>^suffix</code> - Terminator with literal suffix (e.g., <code>domain:id^'s</code> → "Zixtrex's")</li>
                  <li><code>|</code> - Alternatives (random choice)</li>
                  <li><code>space</code> - Sequence (concatenate with space)</li>
                  <li>Literal text - Use as-is (e.g., "of", "the", "-")</li>
                </ul>

                <h4>Mixing Lexemes with Phonotactic</h4>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '4px', fontFamily: 'monospace', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                  <div>name → slot:titles domain:elven_domain</div>
                  <div style={{ marginTop: '0.5rem', color: 'var(--arctic-frost)' }}>// With suffix:</div>
                  <div>possessive → domain:tech_domain^'s slot:nouns</div>
                </div>
                <p style={{ fontSize: '0.875rem' }}>
                  Generates: "Duke Zixtrexrtra", "Valamorn's fortress"
                </p>

                <h4>Tips</h4>
                <ul style={{ fontSize: '0.875rem' }}>
                  <li>Start simple: adj-noun patterns work well</li>
                  <li>Use descriptive rule names (adj, noun, title)</li>
                  <li>Mix <code>slot:</code> and <code>domain:</code> for "Duke Zixtrexrtra" style names</li>
                  <li>Use <code>^</code> to attach suffixes: <code>domain:id^'s</code> → "Zixtrex's"</li>
                  <li>Create focused lexeme lists for each role</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Edit mode
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0 }}>{editingGrammar === 'new' ? 'New Grammar' : 'Edit Grammar'}</h3>
      </div>

      <div className="form-group">
        <label>Grammar ID</label>
        <input
          value={formData.id}
          onChange={(e) => setFormData({ ...formData, id: e.target.value })}
          placeholder={`${cultureId}_${entityKind}_grammar`}
        />
      </div>

      <div className="form-group">
        <label>Start Symbol</label>
        <input
          value={formData.start}
          onChange={(e) => setFormData({ ...formData, start: e.target.value })}
          placeholder="e.g., name, phrase, title"
        />
        <small className="text-muted">The entry point for name generation</small>
      </div>

      <h4 style={{ marginTop: '1.5rem', marginBottom: '0.75rem' }}>Production Rules</h4>

      {/* Click-to-insert: Lexeme Lists */}
      {availableLexemeLists.length > 0 && (
        <div style={{
          background: 'rgba(59, 130, 246, 0.15)',
          padding: '0.75rem',
          borderRadius: '6px',
          marginBottom: '1rem',
          border: '1px solid rgba(59, 130, 246, 0.3)'
        }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--arctic-frost)', marginBottom: '0.5rem' }}>
            <strong>Lexeme Lists</strong> (click to insert)
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {availableLexemeLists.map(({ id, source }) => (
              <code
                key={`${source}-${id}`}
                style={{
                  background: 'rgba(10, 25, 41, 0.8)',
                  padding: '0.25rem 0.5rem',
                  borderRadius: '4px',
                  color: 'var(--gold-accent)',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  border: '1px solid rgba(59, 130, 246, 0.3)'
                }}
                onClick={() => insertIntoRule(`slot:${id}`)}
                title={source !== 'local' ? `From ${source}` : 'Local list'}
              >
                slot:{id}
              </code>
            ))}
          </div>
        </div>
      )}

      {/* Click-to-insert: Domain Phonology */}
      {effectiveDomain && (
        <div style={{
          background: 'rgba(147, 51, 234, 0.15)',
          padding: '0.75rem',
          borderRadius: '6px',
          marginBottom: '1rem',
          border: '1px solid rgba(147, 51, 234, 0.3)'
        }}>
          <div style={{ fontSize: '0.75rem', color: 'rgb(192, 132, 252)', marginBottom: '0.5rem' }}>
            <strong>Domain: {effectiveDomain.id}</strong>
          </div>

          {/* Phonotactic generation */}
          <div style={{ marginBottom: '0.5rem' }}>
            <code
              style={{
                background: 'rgba(10, 25, 41, 0.8)',
                padding: '0.25rem 0.5rem',
                borderRadius: '4px',
                color: 'var(--gold-accent)',
                cursor: 'pointer',
                fontSize: '0.75rem',
                border: '1px solid rgba(147, 51, 234, 0.5)'
              }}
              onClick={() => insertIntoRule(`domain:${effectiveDomain.id}`)}
              title="Generate phonotactic name from this domain"
            >
              domain:{effectiveDomain.id}
            </code>
            <span style={{ fontSize: '0.7rem', color: 'var(--arctic-frost)', marginLeft: '0.5rem' }}>
              (generates names like "Zixtrexrtra")
            </span>
          </div>

          {effectiveDomain.morphology?.prefixes?.length > 0 && (
            <div style={{ marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--arctic-frost)' }}>Prefixes: </span>
              {effectiveDomain.morphology.prefixes.slice(0, 8).map((p, i) => (
                <code
                  key={i}
                  style={{
                    background: 'rgba(10, 25, 41, 0.8)',
                    padding: '0.125rem 0.375rem',
                    borderRadius: '3px',
                    color: 'rgb(192, 132, 252)',
                    cursor: 'pointer',
                    fontSize: '0.7rem',
                    marginRight: '0.25rem'
                  }}
                  onClick={() => insertIntoRule(p)}
                >
                  {p}
                </code>
              ))}
            </div>
          )}

          {effectiveDomain.morphology?.suffixes?.length > 0 && (
            <div style={{ marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--arctic-frost)' }}>Suffixes: </span>
              {effectiveDomain.morphology.suffixes.slice(0, 8).map((s, i) => (
                <code
                  key={i}
                  style={{
                    background: 'rgba(10, 25, 41, 0.8)',
                    padding: '0.125rem 0.375rem',
                    borderRadius: '3px',
                    color: 'rgb(192, 132, 252)',
                    cursor: 'pointer',
                    fontSize: '0.7rem',
                    marginRight: '0.25rem'
                  }}
                  onClick={() => insertIntoRule(s)}
                >
                  {s}
                </code>
              ))}
            </div>
          )}

          {effectiveDomain.style?.preferredEndings?.length > 0 && (
            <div>
              <span style={{ fontSize: '0.7rem', color: 'var(--arctic-frost)' }}>Endings: </span>
              {effectiveDomain.style.preferredEndings.slice(0, 8).map((e, i) => (
                <code
                  key={i}
                  style={{
                    background: 'rgba(10, 25, 41, 0.8)',
                    padding: '0.125rem 0.375rem',
                    borderRadius: '3px',
                    color: 'rgb(192, 132, 252)',
                    cursor: 'pointer',
                    fontSize: '0.7rem',
                    marginRight: '0.25rem'
                  }}
                  onClick={() => insertIntoRule(e)}
                >
                  {e}
                </code>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Common literals */}
      <div style={{
        background: 'rgba(30, 58, 95, 0.3)',
        padding: '0.75rem',
        borderRadius: '6px',
        marginBottom: '1rem',
        border: '1px solid rgba(59, 130, 246, 0.2)'
      }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--arctic-frost)', marginBottom: '0.5rem' }}>
          <strong>Common Literals</strong> (click to insert)
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {['-', "'", 'of', 'the', 'von', 'de', 'el', 'al'].map((lit) => (
            <code
              key={lit}
              style={{
                background: 'rgba(10, 25, 41, 0.8)',
                padding: '0.25rem 0.5rem',
                borderRadius: '4px',
                color: 'var(--arctic-frost)',
                cursor: 'pointer',
                fontSize: '0.75rem',
                border: '1px solid rgba(59, 130, 246, 0.2)'
              }}
              onClick={() => insertIntoRule(lit)}
            >
              {lit}
            </code>
          ))}
        </div>
      </div>

      {/* Add rule form */}
      <div style={{
        background: 'rgba(30, 58, 95, 0.4)',
        padding: '1rem',
        borderRadius: '6px',
        marginBottom: '1rem',
        border: '1px solid rgba(59, 130, 246, 0.3)'
      }}>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <input
            style={{ flex: '0 0 120px' }}
            value={newRuleKey}
            onChange={(e) => setNewRuleKey(e.target.value)}
            placeholder="Non-terminal"
          />
          <span style={{ alignSelf: 'center', color: 'var(--arctic-frost)' }}>→</span>
          <input
            style={{ flex: 1 }}
            value={newRuleValue}
            onChange={(e) => setNewRuleValue(e.target.value)}
            placeholder="slot:lexeme_id | literal | other_nonterminal"
          />
          <button className="primary" onClick={handleAddRule}>Add</button>
        </div>
        <small className="text-muted">
          Use <code>|</code> for alternatives, <code>space</code> for sequence
        </small>
      </div>

      {/* Current rules */}
      {Object.keys(formData.rules).length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ marginBottom: '0.5rem' }}>Current Rules</h4>
          {Object.entries(formData.rules).map(([key, productions]) => (
            <div
              key={key}
              style={{
                padding: '0.75rem',
                background: 'rgba(30, 58, 95, 0.4)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: '4px',
                marginBottom: '0.5rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                <strong style={{ color: 'var(--gold-accent)' }}>{key}</strong>
                <span style={{ color: 'var(--arctic-frost)' }}> → </span>
                {productions.map((prod, i) => (
                  <span key={i}>
                    <span style={{ color: 'var(--arctic-light)' }}>{prod.join(' ')}</span>
                    {i < productions.length - 1 && <span style={{ color: 'var(--arctic-frost)' }}> | </span>}
                  </span>
                ))}
              </div>
              <button
                className="danger"
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                onClick={() => handleDeleteRule(key)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Sharing Options */}
      <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(147, 51, 234, 0.1)', borderRadius: '6px', border: '1px solid rgba(147, 51, 234, 0.3)' }}>
        <h4 style={{ margin: '0 0 0.75rem 0', color: 'rgb(192, 132, 252)' }}>Sharing Options</h4>

        <div className="form-group" style={{ marginBottom: '1rem' }}>
          <label style={{ fontSize: '0.875rem' }}>Share with Cultures</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.25rem' }}>
            <button
              type="button"
              onClick={() => setFormData({
                ...formData,
                appliesTo: { ...formData.appliesTo, cultures: ['*'] }
              })}
              style={{
                padding: '0.25rem 0.75rem',
                borderRadius: '4px',
                border: '1px solid',
                borderColor: formData.appliesTo?.cultures?.includes('*') ? 'rgb(192, 132, 252)' : 'var(--border-color)',
                background: formData.appliesTo?.cultures?.includes('*') ? 'rgba(147, 51, 234, 0.2)' : 'transparent',
                color: formData.appliesTo?.cultures?.includes('*') ? 'rgb(192, 132, 252)' : 'var(--text-color)',
                cursor: 'pointer',
                fontSize: '0.875rem'
              }}
            >
              All Cultures
            </button>
            {allCultureIds.map(cultId => (
              <button
                key={cultId}
                type="button"
                onClick={() => {
                  const current = formData.appliesTo?.cultures || [];
                  const filtered = current.filter(c => c !== '*');
                  const newCultures = filtered.includes(cultId)
                    ? filtered.filter(c => c !== cultId)
                    : [...filtered, cultId];
                  setFormData({
                    ...formData,
                    appliesTo: { ...formData.appliesTo, cultures: newCultures.length ? newCultures : [cultureId] }
                  });
                }}
                style={{
                  padding: '0.25rem 0.75rem',
                  borderRadius: '4px',
                  border: '1px solid',
                  borderColor: formData.appliesTo?.cultures?.includes(cultId) && !formData.appliesTo?.cultures?.includes('*') ? 'var(--gold-accent)' : 'var(--border-color)',
                  background: formData.appliesTo?.cultures?.includes(cultId) && !formData.appliesTo?.cultures?.includes('*') ? 'rgba(212, 175, 55, 0.2)' : 'transparent',
                  color: formData.appliesTo?.cultures?.includes(cultId) && !formData.appliesTo?.cultures?.includes('*') ? 'var(--gold-accent)' : 'var(--text-color)',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  textTransform: 'capitalize'
                }}
              >
                {cultId}
              </button>
            ))}
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label style={{ fontSize: '0.875rem' }}>Share with Entity Types</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.25rem' }}>
            <button
              type="button"
              onClick={() => setFormData({
                ...formData,
                appliesTo: { ...formData.appliesTo, entityKinds: ['*'] }
              })}
              style={{
                padding: '0.25rem 0.75rem',
                borderRadius: '4px',
                border: '1px solid',
                borderColor: formData.appliesTo?.entityKinds?.includes('*') ? 'rgb(192, 132, 252)' : 'var(--border-color)',
                background: formData.appliesTo?.entityKinds?.includes('*') ? 'rgba(147, 51, 234, 0.2)' : 'transparent',
                color: formData.appliesTo?.entityKinds?.includes('*') ? 'rgb(192, 132, 252)' : 'var(--text-color)',
                cursor: 'pointer',
                fontSize: '0.875rem'
              }}
            >
              All Types
            </button>
            {allEntityKinds.map(kind => (
              <button
                key={kind}
                type="button"
                onClick={() => {
                  const current = formData.appliesTo?.entityKinds || [];
                  const filtered = current.filter(k => k !== '*');
                  const newKinds = filtered.includes(kind)
                    ? filtered.filter(k => k !== kind)
                    : [...filtered, kind];
                  setFormData({
                    ...formData,
                    appliesTo: { ...formData.appliesTo, entityKinds: newKinds.length ? newKinds : [entityKind] }
                  });
                }}
                style={{
                  padding: '0.25rem 0.75rem',
                  borderRadius: '4px',
                  border: '1px solid',
                  borderColor: formData.appliesTo?.entityKinds?.includes(kind) && !formData.appliesTo?.entityKinds?.includes('*') ? 'var(--gold-accent)' : 'var(--border-color)',
                  background: formData.appliesTo?.entityKinds?.includes(kind) && !formData.appliesTo?.entityKinds?.includes('*') ? 'rgba(212, 175, 55, 0.2)' : 'transparent',
                  color: formData.appliesTo?.entityKinds?.includes(kind) && !formData.appliesTo?.entityKinds?.includes('*') ? 'var(--gold-accent)' : 'var(--text-color)',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  textTransform: 'capitalize'
                }}
              >
                {kind}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
        <button className="primary" onClick={handleSave}>Save Grammar</button>
        <button className="secondary" onClick={() => { setMode('view'); setEditingGrammar(null); }}>Cancel</button>
      </div>
    </div>
  );
}

// Profile Tab Component
function ProfileTab({ cultureId, entityKind, entityConfig, onConfigChange, onAutoGenerate, cultureConfig, allCultures }) {
  const [editing, setEditing] = useState(false);
  const [editedProfile, setEditedProfile] = useState(null);
  const [testNames, setTestNames] = useState([]);
  const [testLoading, setTestLoading] = useState(false);
  const [testError, setTestError] = useState(null);
  const [strategyUsage, setStrategyUsage] = useState(null);

  const profile = entityConfig?.profile;

  // Get effective domain (local or shared)
  const getEffectiveDomain = () => {
    if (entityConfig?.domain) return entityConfig.domain;
    if (cultureConfig?.entityConfigs) {
      for (const [kind, config] of Object.entries(cultureConfig.entityConfigs)) {
        if (config?.domain) {
          const appliesTo = config.domain.appliesTo?.kind || [];
          if (appliesTo.includes(entityKind)) return config.domain;
        }
      }
    }
    return null;
  };
  const effectiveDomain = getEffectiveDomain();

  // Get shared lexeme lists that apply to this culture/entity
  const getSharedLexemeLists = () => {
    const shared = {};
    const listAppliesHere = (list) => {
      const appliesTo = list.appliesTo || {};
      const cultures = appliesTo.cultures || [];
      const entityKinds = appliesTo.entityKinds || [];
      const cultureMatch = cultures.length === 0 || cultures.includes('*') || cultures.includes(cultureId);
      const entityMatch = entityKinds.length === 0 || entityKinds.includes('*') || entityKinds.includes(entityKind);
      return cultureMatch && entityMatch;
    };

    if (allCultures) {
      Object.entries(allCultures).forEach(([cultId, cultConfig]) => {
        if (cultConfig?.entityConfigs) {
          Object.entries(cultConfig.entityConfigs).forEach(([entKind, entConfig]) => {
            if (cultId === cultureId && entKind === entityKind) return;
            if (entConfig?.lexemeLists) {
              Object.entries(entConfig.lexemeLists).forEach(([listId, list]) => {
                if (listAppliesHere(list) && !shared[listId]) {
                  shared[listId] = list;
                }
              });
            }
          });
        }
      });
    }
    return shared;
  };
  const sharedLexemeLists = getSharedLexemeLists();

  const handleStartEdit = () => {
    setEditedProfile(JSON.parse(JSON.stringify(profile)));
    setEditing(true);
  };

  const handleSave = () => {
    // Normalize weights to sum to 1
    const totalWeight = editedProfile.strategies.reduce((sum, s) => sum + s.weight, 0);
    const normalizedStrategies = editedProfile.strategies.map(s => ({
      ...s,
      weight: totalWeight > 0 ? s.weight / totalWeight : 1 / editedProfile.strategies.length
    }));

    const updatedProfile = {
      ...editedProfile,
      strategies: normalizedStrategies
    };

    onConfigChange({
      ...entityConfig,
      profile: updatedProfile
    });
    setEditing(false);
    setEditedProfile(null);
  };

  const handleCancel = () => {
    setEditing(false);
    setEditedProfile(null);
  };

  const handleWeightChange = (idx, newWeight) => {
    const strategies = [...editedProfile.strategies];
    strategies[idx] = { ...strategies[idx], weight: parseFloat(newWeight) || 0 };
    setEditedProfile({ ...editedProfile, strategies });
  };

  const handleDeleteStrategy = (idx) => {
    const strategies = editedProfile.strategies.filter((_, i) => i !== idx);
    setEditedProfile({ ...editedProfile, strategies });
  };

  const handleAddStrategy = (type) => {
    const newStrategy = { type, weight: 0.25 };

    if (type === 'phonotactic') {
      newStrategy.domainId = entityConfig?.domain?.id || `${cultureId}_${entityKind}_domain`;
    } else if (type === 'grammar') {
      newStrategy.grammarId = entityConfig?.grammars?.[0]?.id || '';
    } else if (type === 'templated') {
      newStrategy.templateIds = (entityConfig?.templates || []).map(t => t.id);
    }

    setEditedProfile({
      ...editedProfile,
      strategies: [...editedProfile.strategies, newStrategy]
    });
  };

  const getStrategyColor = (type) => {
    switch (type) {
      case 'phonotactic': return 'rgba(59, 130, 246, 0.3)';
      case 'grammar': return 'rgba(147, 51, 234, 0.3)';
      case 'templated': return 'rgba(34, 197, 94, 0.3)';
      default: return 'rgba(100, 100, 100, 0.3)';
    }
  };

  const getStrategyBorder = (type) => {
    switch (type) {
      case 'phonotactic': return 'rgba(59, 130, 246, 0.5)';
      case 'grammar': return 'rgba(147, 51, 234, 0.5)';
      case 'templated': return 'rgba(34, 197, 94, 0.5)';
      default: return 'rgba(100, 100, 100, 0.5)';
    }
  };

  const handleTestNames = async (count = 10) => {
    if (!profile) return;

    setTestLoading(true);
    setTestError(null);
    setTestNames([]);
    setStrategyUsage(null);

    try {
      // Merge local + shared lexeme lists
      const localLexemes = entityConfig?.lexemeLists || {};
      const lexemes = { ...sharedLexemeLists, ...localLexemes };

      // Debug: log what we're sending
      console.log('🔍 Test Names - sending:', {
        hasProfile: !!profile,
        profileStrategies: profile?.strategies?.map(s => `${s.type}(${(s.weight * 100).toFixed(0)}%)`),
        localLexemeIds: Object.keys(localLexemes),
        sharedLexemeIds: Object.keys(sharedLexemeLists),
        mergedLexemeIds: Object.keys(lexemes),
        grammarIds: (entityConfig?.grammars || []).map(g => g.id),
        templateIds: (entityConfig?.templates || []).map(t => t.id),
        hasDomain: !!effectiveDomain,
        domainId: effectiveDomain?.id || 'none',
        domainIsShared: !!effectiveDomain && !entityConfig?.domain
      });

      const response = await fetch(`${API_URL}/api/test-names`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId: profile.id,
          count,
          profile,
          domains: effectiveDomain ? [effectiveDomain] : [],
          grammars: entityConfig?.grammars || [],
          templates: entityConfig?.templates || [],
          lexemes
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate test names');
      }

      const data = await response.json();
      setTestNames(data.names || []);
      setStrategyUsage(data.strategyUsage || null);
    } catch (err) {
      setTestError(err.message);
    } finally {
      setTestLoading(false);
    }
  };

  // Calculate total weight for normalization display
  const totalWeight = editing
    ? editedProfile?.strategies?.reduce((sum, s) => sum + s.weight, 0) || 0
    : 0;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0 }}>Naming Profile</h3>
        {profile && !editing && (
          <button className="secondary" onClick={handleStartEdit}>Edit Profile</button>
        )}
      </div>

      <p className="text-muted">
        The profile combines naming strategies with weights to determine how names are generated.
      </p>

      {/* Auto-generate section */}
      <div style={{
        background: 'rgba(59, 130, 246, 0.1)',
        border: '1px solid rgba(59, 130, 246, 0.3)',
        borderRadius: '6px',
        padding: '1rem',
        marginTop: '1rem'
      }}>
        <p style={{ margin: 0, marginBottom: '1rem' }}>
          <strong>Auto-Generate Profile:</strong> Create a profile from your domain, lexemes, templates, and grammars.
        </p>
        <button className="primary" onClick={onAutoGenerate}>
          ⚡ {profile ? 'Re-Generate Profile' : 'Auto-Generate Profile'}
        </button>
      </div>

      {/* Editing mode */}
      {editing && editedProfile && (
        <div style={{ marginTop: '1.5rem' }}>
          <h4>Edit Profile</h4>

          <div className="form-group">
            <label>Profile ID</label>
            <input
              value={editedProfile.id}
              onChange={(e) => setEditedProfile({ ...editedProfile, id: e.target.value })}
            />
          </div>

          <h4 style={{ marginTop: '1.5rem', marginBottom: '0.75rem' }}>
            Strategies
            <span style={{ fontWeight: 'normal', fontSize: '0.875rem', marginLeft: '0.5rem', color: 'var(--arctic-frost)' }}>
              (weights will be normalized to 100%)
            </span>
          </h4>

          {editedProfile.strategies?.map((strategy, idx) => (
            <div
              key={idx}
              style={{
                background: getStrategyColor(strategy.type),
                border: `1px solid ${getStrategyBorder(strategy.type)}`,
                borderRadius: '6px',
                padding: '1rem',
                marginBottom: '0.75rem'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <strong style={{ textTransform: 'capitalize' }}>{strategy.type}</strong>
                <button
                  className="danger"
                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                  onClick={() => handleDeleteStrategy(idx)}
                >
                  Remove
                </button>
              </div>

              {/* Weight slider */}
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ fontSize: '0.875rem', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Weight</span>
                  <span style={{ color: 'var(--gold-accent)' }}>
                    {totalWeight > 0 ? ((strategy.weight / totalWeight) * 100).toFixed(0) : 0}%
                  </span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={strategy.weight}
                  onChange={(e) => handleWeightChange(idx, e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              {/* Strategy-specific fields */}
              {strategy.type === 'phonotactic' && (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '0.875rem' }}>Domain ID</label>
                  <input
                    value={strategy.domainId || ''}
                    onChange={(e) => {
                      const strategies = [...editedProfile.strategies];
                      strategies[idx] = { ...strategies[idx], domainId: e.target.value };
                      setEditedProfile({ ...editedProfile, strategies });
                    }}
                    placeholder="e.g., dwarf_npc_domain"
                  />
                </div>
              )}

              {strategy.type === 'grammar' && (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '0.875rem' }}>Grammar ID</label>
                  <select
                    value={strategy.grammarId || ''}
                    onChange={(e) => {
                      const strategies = [...editedProfile.strategies];
                      strategies[idx] = { ...strategies[idx], grammarId: e.target.value };
                      setEditedProfile({ ...editedProfile, strategies });
                    }}
                    style={{ width: '100%' }}
                  >
                    <option value="">Select a grammar...</option>
                    {(entityConfig?.grammars || []).map(g => (
                      <option key={g.id} value={g.id}>{g.id}</option>
                    ))}
                  </select>
                </div>
              )}

              {strategy.type === 'templated' && (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '0.875rem' }}>
                    Templates ({strategy.templateIds?.length || 0} selected)
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.25rem' }}>
                    {(entityConfig?.templates || []).map(t => {
                      const isSelected = strategy.templateIds?.includes(t.id);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            const strategies = [...editedProfile.strategies];
                            const currentIds = strategies[idx].templateIds || [];
                            strategies[idx] = {
                              ...strategies[idx],
                              templateIds: isSelected
                                ? currentIds.filter(id => id !== t.id)
                                : [...currentIds, t.id]
                            };
                            setEditedProfile({ ...editedProfile, strategies });
                          }}
                          style={{
                            padding: '0.25rem 0.5rem',
                            fontSize: '0.75rem',
                            borderRadius: '4px',
                            border: '1px solid',
                            borderColor: isSelected ? 'var(--gold-accent)' : 'var(--border-color)',
                            background: isSelected ? 'rgba(212, 175, 55, 0.2)' : 'transparent',
                            color: isSelected ? 'var(--gold-accent)' : 'var(--text-color)',
                            cursor: 'pointer'
                          }}
                        >
                          {t.id}
                        </button>
                      );
                    })}
                    {(entityConfig?.templates || []).length === 0 && (
                      <span className="text-muted" style={{ fontSize: '0.875rem' }}>No templates available</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Add strategy buttons */}
          <div style={{ marginTop: '1rem', marginBottom: '1.5rem' }}>
            <span style={{ fontSize: '0.875rem', marginRight: '0.75rem' }}>Add strategy:</span>
            <button
              className="secondary"
              style={{ marginRight: '0.5rem', fontSize: '0.875rem' }}
              onClick={() => handleAddStrategy('phonotactic')}
            >
              + Phonotactic
            </button>
            <button
              className="secondary"
              style={{ marginRight: '0.5rem', fontSize: '0.875rem' }}
              onClick={() => handleAddStrategy('grammar')}
            >
              + Grammar
            </button>
            <button
              className="secondary"
              style={{ fontSize: '0.875rem' }}
              onClick={() => handleAddStrategy('templated')}
            >
              + Templated
            </button>
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button className="primary" onClick={handleSave}>Save Profile</button>
            <button className="secondary" onClick={handleCancel}>Cancel</button>
          </div>
        </div>
      )}

      {/* View mode */}
      {!editing && profile && (
        <div style={{ marginTop: '1.5rem' }}>
          <h4>Current Profile: <code>{profile.id}</code></h4>

          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {profile.strategies?.map((strategy, idx) => (
              <div
                key={idx}
                style={{
                  background: getStrategyColor(strategy.type),
                  border: `1px solid ${getStrategyBorder(strategy.type)}`,
                  borderRadius: '6px',
                  padding: '1rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ textTransform: 'capitalize' }}>{strategy.type}</strong>
                  <span style={{
                    background: 'rgba(0,0,0,0.3)',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '4px',
                    color: 'var(--gold-accent)',
                    fontWeight: 'bold'
                  }}>
                    {(strategy.weight * 100).toFixed(0)}%
                  </span>
                </div>

                <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: 'var(--arctic-frost)' }}>
                  {strategy.type === 'phonotactic' && strategy.domainId && (
                    <span>Domain: <code>{strategy.domainId}</code></span>
                  )}
                  {strategy.type === 'grammar' && strategy.grammarId && (
                    <span>Grammar: <code>{strategy.grammarId}</code></span>
                  )}
                  {strategy.type === 'templated' && (
                    <span>Templates: {strategy.templateIds?.length || 0} selected</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Test Names Section */}
      {!editing && profile && (
        <div style={{
          marginTop: '2rem',
          borderTop: '1px solid var(--border-color)',
          paddingTop: '1.5rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h4 style={{ margin: 0 }}>Test Name Generation</h4>
            <button
              className="primary"
              onClick={() => handleTestNames(10)}
              disabled={testLoading}
            >
              {testLoading ? 'Generating...' : '🎲 Generate 10 Test Names'}
            </button>
          </div>

          {testError && (
            <div className="error" style={{ marginBottom: '1rem' }}>
              <strong>Error:</strong> {testError}
            </div>
          )}

          {strategyUsage && (
            <div style={{
              background: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: '6px',
              padding: '0.75rem',
              marginBottom: '1rem',
              fontSize: '0.875rem'
            }}>
              <strong>Strategy Usage:</strong>{' '}
              {Object.entries(strategyUsage)
                .filter(([, count]) => count > 0)
                .map(([strategy, count]) => `${strategy}: ${count}`)
                .join(', ')}
            </div>
          )}

          {testNames.length > 0 && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: '0.5rem'
            }}>
              {testNames.map((name, i) => (
                <div
                  key={i}
                  style={{
                    background: 'rgba(30, 58, 95, 0.4)',
                    padding: '0.75rem',
                    borderRadius: '4px',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    fontFamily: 'monospace',
                    fontSize: '0.95rem',
                    color: 'var(--gold-accent)'
                  }}
                >
                  {name}
                </div>
              ))}
            </div>
          )}

          {testNames.length === 0 && !testLoading && !testError && (
            <p className="text-muted" style={{ fontSize: '0.875rem' }}>
              Click the button above to test your naming profile by generating sample names.
            </p>
          )}
        </div>
      )}

      {/* No profile yet */}
      {!editing && !profile && (
        <div className="info" style={{ marginTop: '1.5rem' }}>
          No profile configured yet. Click "Auto-Generate Profile" above to create one automatically.
        </div>
      )}
    </div>
  );
}

export default EntityWorkspace;

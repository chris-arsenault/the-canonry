import { useState } from 'react';

const API_URL = 'http://localhost:3001';

function EntityWorkspace({
  metaDomain,
  worldSchema,
  cultureId,
  entityKind,
  entityConfig,
  cultureConfig,
  allCultures,
  onConfigChange
}) {
  const [activeTab, setActiveTab] = useState('domain');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  if (!cultureId || !entityKind) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
        <p>Select a culture and entity type from the sidebar to begin</p>
      </div>
    );
  }

  const handleSave = async () => {
    setSaving(true);
    setError(null);

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
        throw new Error(errorData.error || 'Failed to save entity config');
      }

      console.log(`✅ Saved ${entityKind} config for ${cultureId}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

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
    const status = entityConfig?.completionStatus || {};

    if (key === 'domain') {
      if (status.domain) return '✅';
      if (hasSharedDomain()) return '🔗';
      return '⭕';
    } else if (key === 'lexemes') {
      return status.lexemes > 0 ? `✅ (${status.lexemes})` : '⭕';
    } else if (key === 'templates') {
      return status.templates ? '✅' : '⭕';
    } else if (key === 'profile') {
      return status.profile ? '✅' : '⭕';
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

          <button
            className="primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : '💾 Save'}
          </button>
        </div>

        {error && (
          <div className="error" style={{ marginTop: '1rem' }}>
            {error}
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
          />
        )}

        {activeTab === 'grammars' && (
          <GrammarsTab
            entityConfig={entityConfig}
            onConfigChange={onConfigChange}
          />
        )}

        {activeTab === 'profile' && (
          <ProfileTab
            cultureId={cultureId}
            entityKind={entityKind}
            entityConfig={entityConfig}
            onConfigChange={onConfigChange}
            onAutoGenerate={handleAutoGenerateProfile}
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
function TemplatesTab({ metaDomain, cultureId, entityKind, entityConfig, onConfigChange }) {
  return (
    <div>
      <h3>Name Templates</h3>
      <p className="text-muted">
        Name templates will be managed here. This integrates the Spec Editor and Generation Panel functionality.
      </p>

      {entityConfig?.templates && entityConfig.templates.length > 0 ? (
        <div>
          <h4>Loaded Templates ({entityConfig.templates.length})</h4>
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {entityConfig.templates.map((template, idx) => (
              <div
                key={idx}
                style={{
                  background: 'rgba(30, 58, 95, 0.3)',
                  padding: '0.75rem',
                  borderRadius: '6px',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  fontFamily: 'monospace',
                  fontSize: '0.875rem'
                }}
              >
                {template.template || template.id}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="info">
          No templates yet. Use the old Specs/Generate tabs to create them, then they will appear here.
        </div>
      )}
    </div>
  );
}

// Grammars Tab Component
function GrammarsTab({ entityConfig, onConfigChange }) {
  return (
    <div>
      <h3>Grammar Rules</h3>
      <p className="text-muted">
        Grammar rules will be managed here. This integrates the Grammar Editor functionality.
      </p>

      {entityConfig?.grammars && entityConfig.grammars.length > 0 ? (
        <div>
          <h4>Loaded Grammars ({entityConfig.grammars.length})</h4>
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {entityConfig.grammars.map((grammar, idx) => (
              <div
                key={idx}
                style={{
                  background: 'rgba(30, 58, 95, 0.3)',
                  padding: '0.75rem',
                  borderRadius: '6px',
                  border: '1px solid rgba(59, 130, 246, 0.3)'
                }}
              >
                <strong>{grammar.id}</strong>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="info">
          No grammars yet. Use the old Grammars tab to create them, then they will appear here.
        </div>
      )}
    </div>
  );
}

// Profile Tab Component
function ProfileTab({ cultureId, entityKind, entityConfig, onConfigChange, onAutoGenerate }) {
  return (
    <div>
      <h3>Naming Profile</h3>
      <p className="text-muted">
        The profile combines all naming strategies for this entity type.
      </p>

      <div style={{
        background: 'rgba(59, 130, 246, 0.1)',
        border: '1px solid rgba(59, 130, 246, 0.3)',
        borderRadius: '6px',
        padding: '1rem',
        marginTop: '1rem'
      }}>
        <p style={{ margin: 0, marginBottom: '1rem' }}>
          💡 <strong>Auto-Generate Profile:</strong> Automatically create a profile from your domain, lexemes, templates, and grammars.
        </p>
        <button className="primary" onClick={onAutoGenerate}>
          ⚡ Auto-Generate Profile
        </button>
      </div>

      {entityConfig?.profile ? (
        <div style={{ marginTop: '1.5rem' }}>
          <h4>Current Profile</h4>
          <div style={{
            background: 'rgba(30, 58, 95, 0.3)',
            padding: '1rem',
            borderRadius: '6px',
            border: '1px solid rgba(59, 130, 246, 0.3)'
          }}>
            <div style={{ marginBottom: '1rem' }}>
              <strong>Profile ID:</strong> {entityConfig.profile.id}
            </div>

            <div>
              <strong>Strategies:</strong>
              <ul style={{ marginLeft: '1.5rem', marginTop: '0.5rem' }}>
                {entityConfig.profile.strategies?.map((strategy, idx) => (
                  <li key={idx}>
                    <code>{strategy.type}</code> ({(strategy.weight * 100).toFixed(0)}% weight)
                    {strategy.type === 'templated' && ` - ${strategy.templateIds?.length || 0} templates`}
                    {strategy.type === 'grammar' && strategy.grammarId && ` - ${strategy.grammarId}`}
                    {strategy.type === 'phonotactic' && strategy.domainId && ` - ${strategy.domainId}`}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : (
        <div className="info" style={{ marginTop: '1.5rem' }}>
          No profile configured yet. Click "Auto-Generate Profile" above to create one automatically.
        </div>
      )}
    </div>
  );
}

export default EntityWorkspace;

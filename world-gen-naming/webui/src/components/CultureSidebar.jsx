import { useState } from 'react';

const API_URL = 'http://localhost:3001';

function CultureSidebar({
  metaDomain,
  worldSchema,
  cultures,
  selectedCulture,
  selectedEntityKind,
  onSelectCulture,
  onSelectEntityKind,
  onCulturesChange
}) {
  const [creatingCulture, setCreatingCulture] = useState(false);
  const [newCultureId, setNewCultureId] = useState('');
  const [newCultureName, setNewCultureName] = useState('');
  const [error, setError] = useState(null);

  const handleCreateCulture = async () => {
    if (!newCultureId.trim()) {
      setError('Culture ID is required');
      return;
    }

    if (!/^[a-z0-9_-]+$/.test(newCultureId)) {
      setError('Culture ID must be lowercase letters, numbers, hyphens, and underscores only');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/v2/cultures/${metaDomain}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cultureId: newCultureId,
          cultureName: newCultureName || newCultureId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create culture');
      }

      const data = await response.json();

      // Add new culture to the list
      const updatedCultures = { ...cultures, [data.culture.id]: data.culture };
      onCulturesChange(updatedCultures);

      // Select the new culture
      onSelectCulture(data.culture.id);

      // Reset form
      setNewCultureId('');
      setNewCultureName('');
      setCreatingCulture(false);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  };

  // Check if any domain in the culture applies to a specific entity kind
  const hasApplicableDomain = (culture, entityKind) => {
    if (!culture?.entityConfigs) return false;
    for (const [kind, config] of Object.entries(culture.entityConfigs)) {
      if (config?.domain) {
        const appliesTo = config.domain.appliesTo?.kind || [];
        if (appliesTo.includes(entityKind)) return true;
      }
    }
    return false;
  };

  const calculateCompletion = (culture) => {
    if (!culture || !culture.entityConfigs) return 0;

    const kinds = worldSchema?.hardState?.map(e => e.kind) || [];
    if (kinds.length === 0) return 0;

    let totalSteps = 0;
    let completedSteps = 0;

    for (const kind of kinds) {
      const config = culture.entityConfigs[kind];
      const status = config?.completionStatus || {};

      // 4 steps per entity: domain, lexemes, templates, profile
      totalSteps += 4;

      // Domain: check direct config OR shared domain
      if (status.domain || hasApplicableDomain(culture, kind)) completedSteps += 1;
      if (status.lexemes > 0) completedSteps += Math.min(status.lexemes / 4, 1);
      if (status.templates) completedSteps += 1;
      if (status.profile) completedSteps += 1;
    }

    return Math.round((completedSteps / totalSteps) * 100);
  };

  const getEntityCompletion = (culture, entityKind, entityConfig) => {
    const status = entityConfig?.completionStatus || {};
    let completed = 0;

    // Domain: check direct config OR shared domain
    if (status.domain || hasApplicableDomain(culture, entityKind)) completed++;
    if (status.lexemes > 0) completed += Math.min(status.lexemes / 4, 1);
    if (status.templates) completed++;
    if (status.profile) completed++;

    return Math.round((completed / 4) * 100);
  };

  // Check if entity has shared domain (not direct)
  const hasSharedDomain = (culture, entityKind) => {
    const config = culture?.entityConfigs?.[entityKind];
    if (config?.completionStatus?.domain) return false; // Has direct domain
    return hasApplicableDomain(culture, entityKind);
  };

  const entityKinds = worldSchema ? worldSchema.hardState.map(e => e.kind) : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ borderBottom: '1px solid var(--border-color)', padding: '1rem' }}>
        <h3 style={{ margin: 0, marginBottom: '1rem' }}>Cultures</h3>

        {!creatingCulture ? (
          <button
            className="primary"
            onClick={() => setCreatingCulture(true)}
            style={{ width: '100%' }}
          >
            + New Culture
          </button>
        ) : (
          <div style={{
            background: 'rgba(30, 58, 95, 0.3)',
            padding: '1rem',
            borderRadius: '6px',
            border: '1px solid rgba(59, 130, 246, 0.3)'
          }}>
            <div className="form-group">
              <label>Culture ID</label>
              <input
                type="text"
                value={newCultureId}
                onChange={(e) => setNewCultureId(e.target.value)}
                placeholder="elven"
              />
            </div>
            <div className="form-group">
              <label>Display Name</label>
              <input
                type="text"
                value={newCultureName}
                onChange={(e) => setNewCultureName(e.target.value)}
                placeholder="Elven"
              />
            </div>

            {error && (
              <div className="error" style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button
                className="primary"
                onClick={handleCreateCulture}
                style={{ flex: 1 }}
              >
                Create
              </button>
              <button
                onClick={() => {
                  setCreatingCulture(false);
                  setError(null);
                  setNewCultureId('');
                  setNewCultureName('');
                }}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
        {Object.keys(cultures).length === 0 ? (
          <div style={{ padding: '1rem', textAlign: 'center', color: '#666', fontSize: '0.875rem' }}>
            No cultures yet. Create one to get started.
          </div>
        ) : (
          Object.values(cultures).map((culture) => {
            const completion = calculateCompletion(culture);
            const isSelected = selectedCulture === culture.id;

            return (
              <div
                key={culture.id}
                style={{
                  marginBottom: '0.5rem',
                  border: isSelected
                    ? '2px solid var(--gold-accent)'
                    : '1px solid rgba(59, 130, 246, 0.3)',
                  borderRadius: '6px',
                  background: isSelected
                    ? 'rgba(255, 215, 0, 0.1)'
                    : 'rgba(30, 58, 95, 0.3)',
                  overflow: 'hidden'
                }}
              >
                <div
                  onClick={() => onSelectCulture(culture.id)}
                  style={{
                    padding: '0.75rem',
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = 'rgba(30, 58, 95, 0.5)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>
                    {culture.name || culture.id}
                  </div>
                  <div style={{
                    fontSize: '0.75rem',
                    color: 'var(--arctic-frost)',
                    marginBottom: '0.5rem'
                  }}>
                    Completion: {completion}%
                  </div>
                  <div style={{
                    width: '100%',
                    height: '4px',
                    background: 'rgba(0, 0, 0, 0.3)',
                    borderRadius: '2px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${completion}%`,
                      height: '100%',
                      background: completion === 100
                        ? 'var(--gold-accent)'
                        : 'linear-gradient(90deg, #3b82f6, #06b6d4)',
                      transition: 'width 0.3s'
                    }} />
                  </div>
                </div>

                {isSelected && culture.entityConfigs && (
                  <div style={{
                    borderTop: '1px solid rgba(255, 215, 0, 0.3)',
                    background: 'rgba(0, 0, 0, 0.2)',
                    padding: '0.5rem'
                  }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '0.5rem', textTransform: 'uppercase', color: 'var(--arctic-light)' }}>
                      Entity Types
                    </div>
                    {entityKinds.map((kind) => {
                      const entityConfig = culture.entityConfigs[kind];
                      const entityCompletion = getEntityCompletion(culture, kind, entityConfig);
                      const isEntitySelected = selectedEntityKind === kind;
                      const isShared = hasSharedDomain(culture, kind);
                      const hasDirect = entityConfig?.completionStatus?.domain;

                      return (
                        <div
                          key={kind}
                          onClick={() => onSelectEntityKind(kind)}
                          style={{
                            padding: '0.5rem',
                            marginBottom: '0.25rem',
                            borderRadius: '4px',
                            background: isEntitySelected
                              ? 'rgba(255, 215, 0, 0.2)'
                              : 'rgba(30, 58, 95, 0.3)',
                            border: isEntitySelected
                              ? '1px solid var(--gold-accent)'
                              : '1px solid transparent',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            if (!isEntitySelected) {
                              e.currentTarget.style.background = 'rgba(30, 58, 95, 0.5)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isEntitySelected) {
                              e.currentTarget.style.background = 'rgba(30, 58, 95, 0.3)';
                            }
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ textTransform: 'capitalize' }}>
                              {kind}
                              {isShared && <span title="Shared domain" style={{ marginLeft: '0.25rem' }}>🔗</span>}
                              {hasDirect && <span title="Has domain" style={{ marginLeft: '0.25rem' }}>✓</span>}
                            </span>
                            <span style={{
                              fontSize: '0.75rem',
                              color: entityCompletion === 100 ? 'var(--gold-accent)' : 'var(--arctic-frost)'
                            }}>
                              {entityCompletion}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default CultureSidebar;

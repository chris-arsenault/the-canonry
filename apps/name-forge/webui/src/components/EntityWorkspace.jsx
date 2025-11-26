import { useState, useEffect, useRef } from 'react';
import { API_URL } from './constants';
import { DomainTab, LexemesTab, GrammarsTab, ProfileTab } from './tabs';

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
          body: JSON.stringify({
            config: entityConfig,
            cultureDomains: cultureConfig?.domains || []  // Pass culture-level domains
          })
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
    } catch (err) {
      setError(err.message);
    }
  };

  // Check if culture has any domains (domains are now culture-level)
  const hasCultureDomains = () => {
    return (cultureConfig?.domains?.length || 0) > 0;
  };

  const getCompletionBadge = (key) => {
    // Compute status directly from data rather than stored completionStatus
    if (key === 'domain') {
      // Domains are now at culture level
      return hasCultureDomains() ? `(${cultureConfig.domains.length})` : '';
    } else if (key === 'lexemes') {
      const count = Object.keys(entityConfig?.lexemeLists || {}).length;
      return count > 0 ? `(${count})` : '';
    } else if (key === 'grammars') {
      const count = (entityConfig?.grammars || []).length;
      return count > 0 ? `(${count})` : '';
    } else if (key === 'profile') {
      return entityConfig?.profile ? '' : '';
    }

    return '';
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
        {['domain', 'lexemes', 'grammars', 'profile'].map((tab) => (
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
            metaDomain={metaDomain}
            cultureId={cultureId}
            cultureConfig={cultureConfig}
            allCultures={allCultures}
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

export default EntityWorkspace;

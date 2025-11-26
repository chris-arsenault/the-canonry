import { useState } from 'react';
import { DomainTab, LexemesTab, GrammarsTab, ProfileTab } from './tabs';

function EntityWorkspace({
  worldSchema,
  cultureId,
  cultureConfig,
  allCultures,
  activeTab = 'domain',
  onTabChange,
  onCultureChange,
  apiKey
}) {
  const [error, setError] = useState(null);

  // Use prop or fallback to local handling
  const setActiveTab = onTabChange || (() => {});

  if (!cultureId) {
    return (
      <div style={{ padding: 'var(--space-xl)', textAlign: 'center' }}>
        <p className="text-muted">Select a culture from the sidebar to begin</p>
      </div>
    );
  }

  // Handle domains change at culture level
  const handleDomainsChange = (newDomains) => {
    if (onCultureChange) {
      onCultureChange({
        ...cultureConfig,
        domains: newDomains
      });
    }
  };

  // Handle lexemes change at culture level
  const handleLexemesChange = (newLexemeLists, newLexemeSpecs) => {
    if (onCultureChange) {
      const updates = { ...cultureConfig };
      if (newLexemeLists !== undefined) updates.lexemeLists = newLexemeLists;
      if (newLexemeSpecs !== undefined) updates.lexemeSpecs = newLexemeSpecs;
      onCultureChange(updates);
    }
  };

  // Handle grammars change at culture level
  const handleGrammarsChange = (newGrammars) => {
    if (onCultureChange) {
      onCultureChange({
        ...cultureConfig,
        grammars: newGrammars
      });
    }
  };

  // Handle profiles change at culture level
  const handleProfilesChange = (newProfiles) => {
    if (onCultureChange) {
      onCultureChange({
        ...cultureConfig,
        profiles: newProfiles
      });
    }
  };

  const getCompletionBadge = (key) => {
    // Compute counts from culture-level data
    if (key === 'domain') {
      const count = cultureConfig?.domains?.length || 0;
      return count > 0 ? `(${count})` : '';
    } else if (key === 'lexemes') {
      const count = Object.keys(cultureConfig?.lexemeLists || {}).length;
      return count > 0 ? `(${count})` : '';
    } else if (key === 'grammars') {
      const count = (cultureConfig?.grammars || []).length;
      return count > 0 ? `(${count})` : '';
    } else if (key === 'profiles') {
      const count = (cultureConfig?.profiles || []).length;
      return count > 0 ? `(${count})` : '';
    }

    return '';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        borderBottom: '1px solid var(--border-color)',
        padding: 'var(--space-md) var(--space-lg)',
        background: 'rgba(30, 58, 95, 0.2)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0 }}>
              <span style={{ color: 'var(--gold-accent)' }}>
                {cultureConfig?.name || cultureId}
              </span>
              <span style={{ fontWeight: 'normal', fontSize: 'var(--text-sm)', color: 'var(--arctic-frost)', marginLeft: 'var(--space-sm)' }}>
                Culture
              </span>
            </h3>
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--arctic-frost)', opacity: 0.6 }}>
            Auto-saved
          </div>
        </div>

        {error && (
          <div className="error" style={{ marginTop: 'var(--space-sm)' }}>
            {error}
            <button className="secondary" onClick={() => setError(null)} style={{ marginLeft: 'var(--space-sm)' }}>
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{
        borderBottom: '1px solid var(--border-color)',
        padding: '0 var(--space-lg)',
        background: 'rgba(30, 58, 95, 0.1)',
        display: 'flex',
        gap: 'var(--space-xs)'
      }}>
        {['domain', 'lexemes', 'grammars', 'profiles'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: 'var(--space-sm) var(--space-md)',
              border: 'none',
              background: activeTab === tab ? 'var(--card-bg)' : 'transparent',
              color: activeTab === tab ? 'var(--gold-accent)' : 'var(--text-color)',
              borderBottom: activeTab === tab ? '2px solid var(--gold-accent)' : '2px solid transparent',
              cursor: 'pointer',
              fontWeight: activeTab === tab ? '600' : 'normal',
              fontSize: 'var(--text-sm)',
              textTransform: 'capitalize',
              transition: 'all 0.15s'
            }}
          >
            {tab} {getCompletionBadge(tab)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-lg)' }}>
        {activeTab === 'domain' && (
          <DomainTab
            key={cultureId}
            cultureId={cultureId}
            cultureConfig={cultureConfig}
            allCultures={allCultures}
            onDomainsChange={handleDomainsChange}
          />
        )}

        {activeTab === 'lexemes' && (
          <LexemesTab
            key={cultureId}
            cultureId={cultureId}
            cultureConfig={cultureConfig}
            onLexemesChange={handleLexemesChange}
            apiKey={apiKey}
          />
        )}

        {activeTab === 'grammars' && (
          <GrammarsTab
            key={cultureId}
            cultureId={cultureId}
            cultureConfig={cultureConfig}
            onGrammarsChange={handleGrammarsChange}
          />
        )}

        {activeTab === 'profiles' && (
          <ProfileTab
            key={cultureId}
            cultureId={cultureId}
            cultureConfig={cultureConfig}
            onProfilesChange={handleProfilesChange}
            worldSchema={worldSchema}
          />
        )}
      </div>
    </div>
  );
}

export default EntityWorkspace;

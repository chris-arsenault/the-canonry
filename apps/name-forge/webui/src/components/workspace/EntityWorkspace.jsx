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
  onAddTag,
  apiKey,
  generators = []
}) {
  const [error, setError] = useState(null);

  // Use prop or fallback to local handling
  const setActiveTab = onTabChange || (() => {});

  if (!cultureId) {
    return (
      <div className="workspace-empty">
        <p className="text-muted">Select a culture from the sidebar to begin</p>
      </div>
    );
  }

  // Handle domains change at culture level
  const handleDomainsChange = (newDomains) => {
    if (onCultureChange) {
      onCultureChange({
        ...cultureConfig,
        naming: {
          ...cultureConfig?.naming,
          domains: newDomains,
        },
      });
    }
  };

  // Handle lexemes change at culture level
  // Optional third param allows atomic update with grammars (for copy operations)
  const handleLexemesChange = (newLexemeLists, newLexemeSpecs, newGrammars) => {
    if (onCultureChange) {
      const updates = {
        ...cultureConfig,
        naming: {
          ...cultureConfig?.naming,
        },
      };
      if (newLexemeLists !== undefined) updates.naming.lexemeLists = newLexemeLists;
      if (newLexemeSpecs !== undefined) updates.naming.lexemeSpecs = newLexemeSpecs;
      if (newGrammars !== undefined) updates.naming.grammars = newGrammars;
      onCultureChange(updates);
    }
  };

  // Handle grammars change at culture level
  const handleGrammarsChange = (newGrammars) => {
    if (onCultureChange) {
      onCultureChange({
        ...cultureConfig,
        naming: {
          ...cultureConfig?.naming,
          grammars: newGrammars,
        },
      });
    }
  };

  // Handle profiles change at culture level
  const handleProfilesChange = (newProfiles) => {
    if (onCultureChange) {
      onCultureChange({
        ...cultureConfig,
        naming: {
          ...cultureConfig?.naming,
          profiles: newProfiles,
        },
      });
    }
  };

  const getCompletionBadge = (key) => {
    const naming = cultureConfig?.naming || {};
    // Compute counts from culture-level data
    if (key === 'domain') {
      const count = naming.domains?.length || 0;
      return count > 0 ? `(${count})` : '';
    } else if (key === 'lexemes') {
      const count = Object.keys(naming.lexemeLists || {}).length;
      return count > 0 ? `(${count})` : '';
    } else if (key === 'grammars') {
      const count = naming.grammars?.length || 0;
      return count > 0 ? `(${count})` : '';
    } else if (key === 'profiles') {
      const count = naming.profiles?.length || 0;
      return count > 0 ? `(${count})` : '';
    }

    return '';
  };

  return (
    <div className="workspace">
      {/* Header */}
      <div className="workspace-header">
        <div className="workspace-header-row">
          <div>
            <h3 className="workspace-title">
              <span className="workspace-title-name">
                {cultureConfig?.name || cultureId}
              </span>
              <span className="workspace-title-label">Culture</span>
            </h3>
          </div>
          <div className="workspace-autosave">Auto-saved</div>
        </div>

        {error && (
          <div className="error mt-sm">
            {error}
            <button className="secondary ml-sm" onClick={() => setError(null)}>
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="workspace-tabs">
        {['domain', 'lexemes', 'grammars', 'profiles'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`workspace-tab ${activeTab === tab ? 'active' : ''}`}
          >
            {tab} {getCompletionBadge(tab)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="workspace-content">
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
            allCultures={allCultures}
            onLexemesChange={handleLexemesChange}
            apiKey={apiKey}
          />
        )}

        {activeTab === 'grammars' && (
          <GrammarsTab
            key={cultureId}
            cultureId={cultureId}
            cultureConfig={cultureConfig}
            allCultures={allCultures}
            onGrammarsChange={handleGrammarsChange}
            onLexemesChange={handleLexemesChange}
          />
        )}

        {activeTab === 'profiles' && (
          <ProfileTab
            key={cultureId}
            cultureId={cultureId}
            cultureConfig={cultureConfig}
            onProfilesChange={handleProfilesChange}
            worldSchema={worldSchema}
            onAddTag={onAddTag}
            generators={generators}
          />
        )}
      </div>
    </div>
  );
}

export default EntityWorkspace;

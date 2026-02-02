import { useState } from 'react';

function CultureSidebar({
  cultures,
  selectedCulture,
  onSelectCulture,
  onCulturesChange,
  readOnly = false
}) {
  const [creatingCulture, setCreatingCulture] = useState(false);
  const [newCultureId, setNewCultureId] = useState('');
  const [newCultureName, setNewCultureName] = useState('');
  const [error, setError] = useState(null);

  const handleCreateCulture = () => {
    if (!newCultureId.trim()) {
      setError('Culture ID is required');
      return;
    }

    if (!/^[a-z0-9_]+$/.test(newCultureId)) {
      setError('Culture ID must be lowercase letters, numbers, and underscores only (no hyphens)');
      return;
    }

    if (cultures[newCultureId]) {
      setError('Culture ID already exists');
      return;
    }

    const cultureName = newCultureName || newCultureId;

    // Create new culture with culture-level resources
    const newCulture = {
      id: newCultureId,
      name: cultureName,
      naming: {
        domains: [],
        lexemeLists: {},
        lexemeSpecs: [],
        grammars: [],
        profiles: [],
      },
    };

    const updatedCultures = { ...cultures, [newCultureId]: newCulture };
    onCulturesChange(updatedCultures);

    // Select the new culture
    onSelectCulture(newCultureId);

    // Reset form
    setNewCultureId('');
    setNewCultureName('');
    setCreatingCulture(false);
    setError(null);
  };

  // Get resource counts for a culture
  const getResourceCounts = (culture) => {
    const naming = culture?.naming || {};
    return {
      domains: naming.domains?.length || 0,
      lexemes: Object.keys(naming.lexemeLists || {}).length,
      grammars: naming.grammars?.length || 0,
      profiles: naming.profiles?.length || 0
    };
  };

  // Calculate completion based on having at least one of each resource
  const calculateCompletion = (culture) => {
    const counts = getResourceCounts(culture);
    let completed = 0;
    if (counts.domains > 0) completed++;
    if (counts.lexemes > 0) completed++;
    if (counts.grammars > 0) completed++;
    if (counts.profiles > 0) completed++;
    return Math.round((completed / 4) * 100);
  };

  return (
    <div className="culture-sidebar">
      <div className="culture-sidebar-header">
        <div className="culture-sidebar-header-row">
          <h4>Cultures</h4>
          {!readOnly && !creatingCulture && (
            <button className="primary sm" onClick={() => setCreatingCulture(true)}>
              + New
            </button>
          )}
        </div>

        {creatingCulture && (
          <div className="culture-form">
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
              <div className="error">{error}</div>
            )}

            <div className="culture-form-buttons">
              <button className="primary" onClick={handleCreateCulture}>
                Create
              </button>
              <button
                className="secondary"
                onClick={() => {
                  setCreatingCulture(false);
                  setError(null);
                  setNewCultureId('');
                  setNewCultureName('');
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="culture-list">
        {Object.keys(cultures).length === 0 ? (
          <div className="culture-list-empty">
            No cultures yet. Create one to get started.
          </div>
        ) : (
          Object.values(cultures).map((culture) => {
            const completion = calculateCompletion(culture);
            const counts = getResourceCounts(culture);
            const isSelected = selectedCulture === culture.id;

            return (
              <div
                key={culture.id}
                onClick={() => onSelectCulture(culture.id)}
                className={`culture-card ${isSelected ? 'selected' : ''}`}
              >
                <div className="culture-card-content">
                  <div className="culture-card-name">
                    {culture.name || culture.id}
                  </div>

                  {/* Resource counts */}
                  <div className="culture-resource-grid">
                    <span className={`culture-resource-item ${counts.domains > 0 ? 'has-domains' : ''}`}>
                      {counts.domains} dom
                    </span>
                    <span className={`culture-resource-item ${counts.lexemes > 0 ? 'has-lexemes' : ''}`}>
                      {counts.lexemes} lex
                    </span>
                    <span className={`culture-resource-item ${counts.grammars > 0 ? 'has-grammars' : ''}`}>
                      {counts.grammars} gram
                    </span>
                    <span className={`culture-resource-item ${counts.profiles > 0 ? 'has-profiles' : ''}`}>
                      {counts.profiles} prof
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="culture-progress-bar">
                    <div
                      className={`culture-progress-fill ${completion === 100 ? 'complete' : ''}`}
                      style={{ width: `${completion}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default CultureSidebar;

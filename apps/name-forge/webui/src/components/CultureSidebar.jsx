import { useState } from 'react';

function CultureSidebar({
  cultures,
  selectedCulture,
  onSelectCulture,
  onCulturesChange
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
      domains: [],
      lexemeLists: {},
      lexemeSpecs: {},
      grammars: [],
      profiles: []
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
    return {
      domains: culture?.domains?.length || 0,
      lexemes: Object.keys(culture?.lexemeLists || {}).length,
      grammars: culture?.grammars?.length || 0,
      profiles: culture?.profiles?.length || 0
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ borderBottom: '1px solid var(--border-color)', padding: 'var(--space-md)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-sm)' }}>
          <h4 style={{ margin: 0 }}>Cultures</h4>
          {!creatingCulture && (
            <button className="primary" onClick={() => setCreatingCulture(true)} style={{ fontSize: 'var(--text-xs)' }}>
              + New
            </button>
          )}
        </div>

        {creatingCulture && (
          <div style={{
            background: 'var(--card-bg)',
            padding: 'var(--space-md)',
            borderRadius: '4px',
            border: '1px solid var(--card-border)'
          }}>
            <div className="form-group" style={{ marginBottom: 'var(--space-sm)' }}>
              <label>Culture ID</label>
              <input
                type="text"
                value={newCultureId}
                onChange={(e) => setNewCultureId(e.target.value)}
                placeholder="elven"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 'var(--space-sm)' }}>
              <label>Display Name</label>
              <input
                type="text"
                value={newCultureName}
                onChange={(e) => setNewCultureName(e.target.value)}
                placeholder="Elven"
              />
            </div>

            {error && (
              <div className="error" style={{ marginTop: 'var(--space-sm)', padding: 'var(--space-sm)' }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
              <button className="primary" onClick={handleCreateCulture} style={{ flex: 1 }}>
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
                style={{ flex: 1 }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-sm)' }}>
        {Object.keys(cultures).length === 0 ? (
          <div style={{ padding: 'var(--space-md)', textAlign: 'center', fontSize: 'var(--text-xs)', color: 'var(--arctic-frost)' }}>
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
                style={{
                  marginBottom: 'var(--space-sm)',
                  border: isSelected ? '1px solid var(--gold-accent)' : '1px solid var(--card-border)',
                  borderRadius: '4px',
                  background: isSelected ? 'rgba(251, 191, 36, 0.1)' : 'var(--card-bg)',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                <div style={{ padding: 'var(--space-sm)' }}>
                  <div style={{ fontWeight: '600', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-xs)', color: isSelected ? 'var(--gold-accent)' : 'var(--text-color)' }}>
                    {culture.name || culture.id}
                  </div>

                  {/* Resource counts */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '2px',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--arctic-frost)',
                    marginBottom: 'var(--space-xs)'
                  }}>
                    <span style={{
                      padding: '2px 4px',
                      background: counts.domains > 0 ? 'rgba(147, 51, 234, 0.2)' : 'rgba(0,0,0,0.2)',
                      borderRadius: '2px'
                    }}>
                      {counts.domains} dom
                    </span>
                    <span style={{
                      padding: '2px 4px',
                      background: counts.lexemes > 0 ? 'rgba(59, 130, 246, 0.2)' : 'rgba(0,0,0,0.2)',
                      borderRadius: '2px'
                    }}>
                      {counts.lexemes} lex
                    </span>
                    <span style={{
                      padding: '2px 4px',
                      background: counts.grammars > 0 ? 'rgba(34, 197, 94, 0.2)' : 'rgba(0,0,0,0.2)',
                      borderRadius: '2px'
                    }}>
                      {counts.grammars} gram
                    </span>
                    <span style={{
                      padding: '2px 4px',
                      background: counts.profiles > 0 ? 'rgba(251, 191, 36, 0.2)' : 'rgba(0,0,0,0.2)',
                      borderRadius: '2px'
                    }}>
                      {counts.profiles} prof
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div style={{
                    width: '100%',
                    height: '3px',
                    background: 'rgba(0, 0, 0, 0.3)',
                    borderRadius: '2px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${completion}%`,
                      height: '100%',
                      background: completion === 100 ? 'var(--gold-accent)' : 'var(--arctic-ice)',
                      transition: 'width 0.2s'
                    }} />
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

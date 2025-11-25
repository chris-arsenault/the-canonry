import { useState } from 'react';

const API_URL = 'http://localhost:3001';

function NameTester({ metaDomain, profiles, domains, grammars, generatedContent }) {
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [count, setCount] = useState(10);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const handleGenerate = async () => {
    if (!selectedProfile) {
      setError('Please select a profile');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/test-names`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metaDomain,
          profileId: selectedProfile.id,
          count,
          profile: selectedProfile,
          domains,
          grammars,
          lexemes: generatedContent
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Name generation failed');
      }

      const data = await response.json();
      setResults(data.names);
      setError(null);
    } catch (err) {
      setError(err.message);
      setResults(null);
    } finally {
      setLoading(false);
    }
  };

  const currentProfile = profiles.find(p => p.id === selectedProfile?.id) || selectedProfile;

  return (
    <div>
      <h2>Test Name Generation</h2>
      <p className="text-muted" style={{ marginBottom: '1.5rem' }}>
        Test your naming configuration by generating sample names with your profiles.
        This lets you verify everything works before exporting.
      </p>

      <div className="card">
        <h3>Select Profile</h3>
        <div className="form-group">
          <select
            value={selectedProfile?.id || ''}
            onChange={(e) => {
              const profile = profiles.find(p => p.id === e.target.value);
              setSelectedProfile(profile);
              setResults(null);
            }}
          >
            <option value="">Choose a profile...</option>
            {profiles.map(profile => (
              <option key={profile.id} value={profile.id}>
                {profile.id} ({profile.cultureId})
              </option>
            ))}
          </select>
        </div>

        {currentProfile && (
          <div style={{
            background: 'rgba(30, 58, 95, 0.4)',
            padding: '1rem',
            borderRadius: '6px',
            marginTop: '1rem',
            border: '1px solid rgba(59, 130, 246, 0.3)'
          }}>
            <div style={{ marginBottom: '0.5rem' }}>
              <strong>Culture:</strong> {currentProfile.cultureId}
            </div>
            <div style={{ marginBottom: '0.5rem' }}>
              <strong>Entity Type:</strong> {currentProfile.entityType}
            </div>
            <div>
              <strong>Strategies:</strong>
              <ul style={{ marginLeft: '1.5rem', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                {currentProfile.strategies?.map((strategy, i) => (
                  <li key={i}>
                    <code>{strategy.type}</code> ({(strategy.weight * 100).toFixed(0)}% weight)
                    {strategy.type === 'templated' && ` - ${strategy.templateIds?.length || 0} templates`}
                    {strategy.type === 'grammar' && strategy.grammarId && ` - ${strategy.grammarId}`}
                    {strategy.type === 'phonotactic' && strategy.domainId && ` - ${strategy.domainId}`}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <div className="form-group" style={{ marginTop: '1rem' }}>
          <label>Number of Names to Generate</label>
          <input
            type="number"
            value={count}
            onChange={(e) => setCount(parseInt(e.target.value))}
            min="1"
            max="50"
          />
        </div>

        <button
          className="primary"
          onClick={handleGenerate}
          disabled={!selectedProfile || loading}
          style={{ marginTop: '1rem' }}
        >
          {loading ? 'Generating...' : 'Generate Test Names'}
        </button>
      </div>

      {error && (
        <div className="error" style={{ marginTop: '1rem' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {loading && (
        <div className="loading" style={{ marginTop: '1rem' }}>
          <div className="spinner"></div>
          <span>Generating names...</span>
        </div>
      )}

      {results && results.length > 0 && (
        <div className="card" style={{ marginTop: '1rem' }}>
          <div className="success" style={{ marginBottom: '1rem' }}>
            ✅ Generated {results.length} names
          </div>

          <h3>Generated Names</h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '0.5rem',
            marginTop: '1rem'
          }}>
            {results.map((name, i) => (
              <div
                key={i}
                style={{
                  background: 'rgba(30, 58, 95, 0.4)',
                  padding: '0.75rem',
                  borderRadius: '4px',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  fontFamily: 'monospace',
                  fontSize: '1rem',
                  color: 'var(--gold-accent)'
                }}
              >
                {name}
              </div>
            ))}
          </div>

          <div style={{
            marginTop: '1.5rem',
            padding: '1rem',
            background: 'rgba(59, 130, 246, 0.1)',
            borderRadius: '6px',
            border: '1px solid rgba(59, 130, 246, 0.2)'
          }}>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--arctic-light)' }}>
              💡 <strong>Tip:</strong> If the names don't look right, check:
            </p>
            <ul style={{
              marginLeft: '1.5rem',
              fontSize: '0.875rem',
              marginTop: '0.5rem',
              marginBottom: 0,
              color: 'var(--arctic-frost)'
            }}>
              <li>Are your domains configured correctly? (Domains tab)</li>
              <li>Do your lexeme lists have entries? (Specs tab)</li>
              <li>Are your grammar rules valid? (Grammars tab)</li>
              <li>Do your profile strategies reference existing resources?</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export default NameTester;

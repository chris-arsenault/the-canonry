import { useState, useEffect } from 'react';

const API_URL = 'http://localhost:3001';

function MetaDomainManager({ currentMetaDomain, onSelectMetaDomain, onMetaDomainsChange }) {
  const [metaDomains, setMetaDomains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newDomainName, setNewDomainName] = useState('');
  const [error, setError] = useState(null);

  // Load available meta-domains on mount
  useEffect(() => {
    loadMetaDomains();
  }, []);

  const loadMetaDomains = async () => {
    try {
      const response = await fetch(`${API_URL}/api/meta-domains`);
      const data = await response.json();

      setMetaDomains(data.metaDomains);

      // If no current selection, select first available
      if (!currentMetaDomain && data.metaDomains.length > 0) {
        onSelectMetaDomain(data.metaDomains[0]);
      }

      setLoading(false);
    } catch (err) {
      console.error('Failed to load meta-domains:', err);
      setError('Failed to load meta-domains');
      setLoading(false);
    }
  };

  const handleCreateDomain = async () => {
    if (!newDomainName.trim()) return;

    try {
      const response = await fetch(`${API_URL}/api/meta-domains`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newDomainName }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error);
        return;
      }

      // Reload meta-domains
      await loadMetaDomains();
      setNewDomainName('');
      setShowCreateForm(false);
      onSelectMetaDomain(newDomainName);
    } catch (err) {
      setError('Failed to create meta-domain');
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '1rem' }}>
        <p className="text-muted">Loading meta-domains...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '1rem', borderBottom: '1px solid #e0e0e0' }}>
      <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', textTransform: 'uppercase', color: '#666' }}>
        Meta-Domain
      </h3>

      {metaDomains.length > 0 ? (
        <select
          value={currentMetaDomain}
          onChange={(e) => onSelectMetaDomain(e.target.value)}
          style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd', marginBottom: '0.5rem' }}
        >
          {metaDomains.map(domain => (
            <option key={domain} value={domain}>
              {domain}
            </option>
          ))}
        </select>
      ) : (
        <p className="text-muted" style={{ fontSize: '0.75rem', marginBottom: '0.5rem' }}>
          No meta-domains found. Create one below.
        </p>
      )}

      {error && (
        <div style={{ background: '#fee', color: '#c00', padding: '0.5rem', borderRadius: '4px', fontSize: '0.75rem', marginBottom: '0.5rem' }}>
          {error}
        </div>
      )}

      {showCreateForm ? (
        <div style={{ marginTop: '0.5rem' }}>
          <input
            type="text"
            value={newDomainName}
            onChange={(e) => setNewDomainName(e.target.value)}
            placeholder="e.g., penguin"
            style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd', marginBottom: '0.5rem', fontSize: '0.875rem' }}
          />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={handleCreateDomain}
              style={{ flex: 1, padding: '0.5rem', background: '#667eea', color: 'white', border: 'none', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer' }}
            >
              Create
            </button>
            <button
              onClick={() => { setShowCreateForm(false); setNewDomainName(''); setError(null); }}
              style={{ flex: 1, padding: '0.5rem', background: '#f0f0f0', color: '#333', border: 'none', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowCreateForm(true)}
          style={{ width: '100%', padding: '0.5rem', background: '#f0f0f0', border: '1px solid #ddd', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer' }}
        >
          + Create New Meta-Domain
        </button>
      )}

      <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.75rem', color: '#999' }}>
        Path: data/{currentMetaDomain || '...'}
      </p>
    </div>
  );
}

export default MetaDomainManager;

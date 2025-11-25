import { useState, useEffect } from 'react';

const API_URL = 'http://localhost:3001';

function SchemaLoader({ metaDomain, onSchemaLoaded }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [schema, setSchema] = useState(null);

  useEffect(() => {
    if (metaDomain) {
      loadSchema();
    }
  }, [metaDomain]);

  const loadSchema = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/v2/schema`);

      if (!response.ok) {
        throw new Error('Failed to load world schema');
      }

      const data = await response.json();
      setSchema(data.schema);
      onSchemaLoaded(data.schema);
    } catch (err) {
      setError(err.message);
      setSchema(null);
    } finally {
      setLoading(false);
    }
  };

  if (!metaDomain) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
        <p>Select or create a meta-domain to begin</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="loading" style={{ padding: '2rem' }}>
        <div className="spinner"></div>
        <span>Loading world schema...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ margin: '2rem' }}>
        <div className="error">
          <strong>Error loading schema:</strong> {error}
        </div>
        <button onClick={loadSchema} style={{ marginTop: '1rem' }}>
          Retry
        </button>
      </div>
    );
  }

  if (!schema) {
    return null;
  }

  return (
    <div className="card" style={{ margin: '2rem' }}>
      <h2>World Schema Loaded</h2>

      <div style={{
        background: 'rgba(34, 197, 94, 0.1)',
        border: '1px solid rgba(34, 197, 94, 0.3)',
        borderRadius: '6px',
        padding: '1rem',
        marginTop: '1rem'
      }}>
        <p style={{ margin: 0, color: 'var(--arctic-light)' }}>
          ✅ Schema validated successfully
        </p>
      </div>

      <div style={{ marginTop: '1.5rem' }}>
        <h3>Entity Types</h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '1rem',
          marginTop: '1rem'
        }}>
          {schema.hardState.map((entityKind) => (
            <div
              key={entityKind.kind}
              style={{
                background: 'rgba(30, 58, 95, 0.4)',
                padding: '1rem',
                borderRadius: '6px',
                border: '1px solid rgba(59, 130, 246, 0.3)'
              }}
            >
              <div style={{ fontWeight: 'bold', marginBottom: '0.75rem', textTransform: 'capitalize', color: 'var(--arctic-light)' }}>
                {entityKind.kind}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--arctic-frost)' }}>
                <div style={{ marginBottom: '0.5rem' }}>
                  <strong>Subtypes:</strong>
                  <div style={{ marginLeft: '0.5rem', marginTop: '0.25rem' }}>
                    {entityKind.subtype.map((st, i) => (
                      <span key={st} style={{
                        display: 'inline-block',
                        background: 'rgba(59, 130, 246, 0.2)',
                        padding: '0.125rem 0.5rem',
                        borderRadius: '4px',
                        marginRight: '0.25rem',
                        marginBottom: '0.25rem',
                        fontSize: '0.75rem'
                      }}>
                        {st}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <strong>Status:</strong>
                  <div style={{ marginLeft: '0.5rem', marginTop: '0.25rem' }}>
                    {entityKind.status.map((s) => (
                      <span key={s} style={{
                        display: 'inline-block',
                        background: 'rgba(34, 197, 94, 0.2)',
                        padding: '0.125rem 0.5rem',
                        borderRadius: '4px',
                        marginRight: '0.25rem',
                        marginBottom: '0.25rem',
                        fontSize: '0.75rem'
                      }}>
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{
        marginTop: '1.5rem',
        padding: '1rem',
        background: 'rgba(59, 130, 246, 0.1)',
        borderRadius: '6px',
        border: '1px solid rgba(59, 130, 246, 0.2)'
      }}>
        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--arctic-light)' }}>
          💡 <strong>Next Step:</strong> Switch to the "Culture Workshop" tab to create and edit cultures for this world schema.
        </p>
      </div>
    </div>
  );
}

export default SchemaLoader;

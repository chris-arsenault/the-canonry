import { useState } from 'react';

const API_URL = 'http://localhost:3001';

function GenerationPanel({ metaDomain, lexemeSpecs, templateSpecs, generatedContent, onGeneratedContentChange }) {
  const [generationType, setGenerationType] = useState('lexeme');
  const [selectedSpec, setSelectedSpec] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [apiKey, setApiKey] = useState('');

  const handleGenerate = async () => {
    if (!selectedSpec) return;

    setLoading(true);
    setError(null);

    try {
      const endpoint = generationType === 'lexeme' ? '/api/generate/lexeme' : '/api/generate/template';
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spec: selectedSpec,
          metaDomain: metaDomain,
          apiKey: apiKey || undefined
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Generation failed');
      }

      const data = await response.json();

      if (generationType === 'lexeme') {
        onGeneratedContentChange({
          ...generatedContent,
          [selectedSpec.id]: {
            type: 'lexeme',
            entries: data.result.entries,
            filtered: data.result.filtered,
            tokensUsed: data.result.tokensUsed
          }
        });
      } else {
        onGeneratedContentChange({
          ...generatedContent,
          [selectedSpec.id]: {
            type: 'template',
            templates: data.result.templates,
            filtered: data.result.filtered,
            tokensUsed: data.result.tokensUsed
          }
        });
      }

      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const currentResult = selectedSpec ? generatedContent[selectedSpec.id] : null;
  const currentSpecs = generationType === 'lexeme' ? lexemeSpecs : templateSpecs;

  return (
    <div>
      <h2>Generate Content</h2>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <button
          className={generationType === 'lexeme' ? 'primary' : 'secondary'}
          onClick={() => { setGenerationType('lexeme'); setSelectedSpec(null); }}
        >
          Lexeme Lists
        </button>
        <button
          className={generationType === 'template' ? 'primary' : 'secondary'}
          onClick={() => { setGenerationType('template'); setSelectedSpec(null); }}
        >
          Templates
        </button>
      </div>

      <div className="card">
        <h3>API Key</h3>
        <p className="text-muted">
          Required if not set in server environment
        </p>
        <div className="form-group">
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-ant-..."
          />
        </div>
      </div>

      <div className="card">
        <h3>Select Spec to Generate</h3>
        {currentSpecs.length === 0 ? (
          <p className="text-muted">
            No {generationType} specs available. Create one in the Specs tab first.
          </p>
        ) : (
          <div className="form-group">
            <select
              value={selectedSpec?.id || ''}
              onChange={(e) => {
                const spec = currentSpecs.find(s => s.id === e.target.value);
                setSelectedSpec(spec);
              }}
            >
              <option value="">Select a spec...</option>
              {generationType === 'lexeme' ? (
                lexemeSpecs.map(spec => (
                  <option key={spec.id} value={spec.id}>
                    {spec.id} ({spec.pos}, {spec.targetCount} words)
                  </option>
                ))
              ) : (
                templateSpecs.map(spec => (
                  <option key={spec.id} value={spec.id}>
                    {spec.id} ({spec.type}, {spec.targetCount} templates, {spec.slotHints.length} slots)
                  </option>
                ))
              )}
            </select>
          </div>
        )}

        {selectedSpec && generationType === 'lexeme' && (
          <div style={{ marginTop: '1rem' }}>
            <p><strong>Style:</strong> {selectedSpec.style}</p>
            <p><strong>Target Count:</strong> {selectedSpec.targetCount}</p>
            <p><strong>POS:</strong> {selectedSpec.pos}</p>
          </div>
        )}

        {selectedSpec && generationType === 'template' && (
          <div style={{ marginTop: '1rem' }}>
            <p><strong>Type:</strong> {selectedSpec.type}</p>
            <p><strong>Style:</strong> {selectedSpec.style}</p>
            <p><strong>Target Count:</strong> {selectedSpec.targetCount}</p>
            <p><strong>Slot Hints:</strong></p>
            <ul style={{ marginLeft: '1.5rem', fontSize: '0.875rem' }}>
              {selectedSpec.slotHints.map((hint, i) => (
                <li key={i}>
                  <code>{hint.name}</code> ({hint.kind}): {hint.description}
                </li>
              ))}
            </ul>
          </div>
        )}

        <button
          className="primary"
          onClick={handleGenerate}
          disabled={!selectedSpec || loading}
          style={{ marginTop: '1rem' }}
        >
          {loading ? 'Generating...' : 'Generate'}
        </button>
      </div>

      {error && (
        <div className="error">
          <strong>Error:</strong> {error}
        </div>
      )}

      {loading && (
        <div className="loading">
          <div className="spinner"></div>
          <span>Generating content with LLM...</span>
        </div>
      )}

      {currentResult && !loading && (!currentResult.type || currentResult.type === 'lexeme') && (
        <div className="card">
          <div className="success">
            ✅ Generated {currentResult.entries.length} entries
            {currentResult.filtered > 0 && ` (${currentResult.filtered} filtered)`}
            • {currentResult.tokensUsed} tokens used
          </div>

          <h3>Generated Entries</h3>
          <div className="code-block">
            {JSON.stringify(currentResult.entries, null, 2)}
          </div>
        </div>
      )}

      {currentResult && !loading && currentResult.type === 'template' && (
        <div className="card">
          <div className="success">
            ✅ Generated {currentResult.templates.length} templates
            {currentResult.filtered > 0 && ` (${currentResult.filtered} filtered)`}
            • {currentResult.tokensUsed} tokens used
          </div>

          <h3>Generated Templates</h3>
          {currentResult.templates.map((template, i) => (
            <div key={i} style={{
              background: 'rgba(30, 58, 95, 0.4)',
              padding: '1rem',
              borderRadius: '6px',
              marginBottom: '1rem',
              border: '1px solid rgba(59, 130, 246, 0.3)'
            }}>
              <div style={{ marginBottom: '0.5rem' }}>
                <strong>ID:</strong> <code>{template.id}</code>
              </div>
              <div style={{ marginBottom: '0.5rem' }}>
                <strong>Template:</strong> <code style={{ color: 'var(--gold-accent)' }}>{template.template}</code>
              </div>
              <div>
                <strong>Slots:</strong>
                <ul style={{ marginLeft: '1.5rem', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                  {Object.entries(template.slots).map(([slotName, slotConfig]) => (
                    <li key={slotName}>
                      <code>{slotName}</code> ({slotConfig.kind}): {slotConfig.description}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default GenerationPanel;

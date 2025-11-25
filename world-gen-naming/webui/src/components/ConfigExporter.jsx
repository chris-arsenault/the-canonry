function ConfigExporter({ metaDomain, domains, grammars, profiles, lexemeSpecs, templateSpecs, generatedContent }) {
  const buildConfig = () => {
    // Build domains array
    const domainsConfig = domains;

    // Build grammars array
    const grammarsConfig = grammars;

    // Build lexeme lists from generated content
    const lexemeLists = Object.entries(generatedContent).map(([id, result]) => ({
      id,
      entries: result.entries
    }));

    // Build profiles array
    const profilesConfig = profiles;

    return {
      metaDomain,
      timestamp: new Date().toISOString(),
      domains: domainsConfig,
      grammars: grammarsConfig,
      lexemeLists,
      profiles: profilesConfig,
      specs: {
        lexeme: lexemeSpecs,
        template: templateSpecs
      }
    };
  };

  const config = buildConfig();

  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${metaDomain}-config-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(config, null, 2));
    alert('Configuration copied to clipboard!');
  };

  return (
    <div>
      <h2>Export Configuration</h2>

      <div className="card">
        <h3>Configuration Summary</h3>
        <div className="stat-item">
          <span className="stat-label">Meta-Domain:</span>
          <span className="stat-value">{metaDomain}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Domains:</span>
          <span className="stat-value">{domains.length}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Grammars:</span>
          <span className="stat-value">{grammars.length}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Lexeme Lists:</span>
          <span className="stat-value">{Object.keys(generatedContent).length}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Profiles:</span>
          <span className="stat-value">{profiles.length}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Lexeme Specs:</span>
          <span className="stat-value">{lexemeSpecs.length}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Template Specs:</span>
          <span className="stat-value">{templateSpecs.length}</span>
        </div>
      </div>

      <div className="card">
        <h3>Actions</h3>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="primary" onClick={handleDownload}>
            📥 Download JSON
          </button>
          <button className="secondary" onClick={handleCopy}>
            📋 Copy to Clipboard
          </button>
        </div>
      </div>

      <div className="card">
        <h3>Configuration Preview</h3>
        <div className="code-block" style={{ maxHeight: '500px', overflow: 'auto' }}>
          {JSON.stringify(config, null, 2)}
        </div>
      </div>

      <div className="card">
        <h3>Usage</h3>
        <p className="text-muted">
          This configuration includes:
        </p>
        <ul style={{ marginLeft: '1.5rem', color: '#666' }}>
          <li><strong>Domains:</strong> Phonology, morphology, and style rules for phonotactic generation</li>
          <li><strong>Grammars:</strong> Context-free grammar rules for structured name patterns</li>
          <li><strong>Lexeme Lists:</strong> Generated word lists for template slots</li>
          <li><strong>Profiles:</strong> Naming strategies combining all components</li>
          <li><strong>Specs:</strong> Generation specifications (for reference/regeneration)</li>
        </ul>
        <p className="text-muted" style={{ marginTop: '1rem' }}>
          To use this configuration:
        </p>
        <ol style={{ marginLeft: '1.5rem', color: '#666' }}>
          <li>Save the JSON file</li>
          <li>Load configuration into your ExecutionContext</li>
          <li>Reference profiles by ID when generating names</li>
          <li>Use with generateFromProfile() or generateName() at runtime</li>
        </ol>
      </div>
    </div>
  );
}

export default ConfigExporter;

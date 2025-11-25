import { useState, useEffect } from 'react';
import './App.css';
import MetaDomainManager from './components/MetaDomainManager';
import NameTester from './components/NameTester';
import ConfigExporter from './components/ConfigExporter';
import SchemaLoader from './components/SchemaLoader';
import CultureSidebar from './components/CultureSidebar';
import EntityWorkspace from './components/EntityWorkspace';

const API_URL = 'http://localhost:3001';

function App() {
  const [currentMetaDomain, setCurrentMetaDomain] = useState(null);
  const [domains, setDomains] = useState([]);
  const [grammars, setGrammars] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [lexemeSpecs, setLexemeSpecs] = useState([]);
  const [templateSpecs, setTemplateSpecs] = useState([]);
  const [generatedContent, setGeneratedContent] = useState({});
  const [activeTab, setActiveTab] = useState('schema');
  const [loading, setLoading] = useState(false);

  // V2 architecture state
  const [worldSchema, setWorldSchema] = useState(null);
  const [cultures, setCultures] = useState({});
  const [selectedCulture, setSelectedCulture] = useState(null);
  const [selectedEntityKind, setSelectedEntityKind] = useState(null);

  // Load meta-domain data when selection changes
  useEffect(() => {
    if (!currentMetaDomain) return;

    loadMetaDomainData(currentMetaDomain);
    loadMetaDomainV2(currentMetaDomain);
  }, [currentMetaDomain]);

  const loadMetaDomainData = async (metaDomain) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/meta-domains/${metaDomain}`);
      if (!response.ok) {
        console.warn(`Meta-domain ${metaDomain} not found, starting fresh`);
        setDomains([]);
        setGrammars([]);
        setProfiles([]);
        setLexemeSpecs([]);
        setTemplateSpecs([]);
        setGeneratedContent({});
        setLoading(false);
        return;
      }

      const data = await response.json();

      // Load domains (now directly an array)
      setDomains(data.domains || []);

      // Load grammars (now directly an array)
      setGrammars(data.grammars || []);

      // Load profiles (now directly an array)
      setProfiles(data.profiles || []);

      // Load lexeme lists as generated content
      const loadedLexemes = {};
      if (data.lexemes) {
        data.lexemes.forEach(list => {
          loadedLexemes[list.id] = {
            type: 'lexeme',
            entries: list.entries,
            filtered: 0,
            tokensUsed: 0
          };
        });
      }
      setGeneratedContent(loadedLexemes);

      // Load specs if they exist
      if (data.specs) {
        setLexemeSpecs(data.specs.lexemeSpecs || []);
        setTemplateSpecs(data.specs.templateSpecs || []);
      }

      console.log(`Loaded meta-domain '${metaDomain}':`, {
        domains: data.domains?.length || 0,
        grammars: data.grammars?.length || 0,
        profiles: data.profiles?.length || 0,
        lexemes: Object.keys(loadedLexemes).length
      });

      setLoading(false);
    } catch (error) {
      console.error('Failed to load meta-domain data:', error);
      setLoading(false);
    }
  };

  // Load v2 meta-domain data
  const loadMetaDomainV2 = async (metaDomain) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/v2/meta-domains/${metaDomain}`);
      if (!response.ok) {
        console.warn(`V2 Meta-domain ${metaDomain} not found`);
        setCultures({});
        setLoading(false);
        return;
      }

      const result = await response.json();
      const data = result.data;

      if (data) {
        setWorldSchema(data.worldSchema);
        setCultures(data.cultures || {});

        console.log(`Loaded v2 meta-domain '${metaDomain}':`, {
          cultures: Object.keys(data.cultures || {}).length,
          entityTypes: data.worldSchema?.hardState?.length || 0
        });
      }

      setLoading(false);
    } catch (error) {
      console.error('Failed to load v2 meta-domain data:', error);
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>World-Gen Naming Configuration Builder</h1>
        <p className="subtitle">
          Build domain configurations and generate lexemes/templates for name generation
        </p>
      </header>

      <div className="app-container">
        <aside className="sidebar">
          <MetaDomainManager
            currentMetaDomain={currentMetaDomain}
            onSelectMetaDomain={setCurrentMetaDomain}
          />

          <nav className="tab-nav">
            <button
              className={activeTab === 'schema' ? 'active' : ''}
              onClick={() => setActiveTab('schema')}
            >
              Schema
            </button>
            <button
              className={activeTab === 'workshop' ? 'active' : ''}
              onClick={() => setActiveTab('workshop')}
            >
              Workshop
            </button>
            <button
              className={activeTab === 'test' ? 'active' : ''}
              onClick={() => setActiveTab('test')}
            >
              Test
            </button>
            <button
              className={activeTab === 'export' ? 'active' : ''}
              onClick={() => setActiveTab('export')}
            >
              Export
            </button>
          </nav>

          <div className="domain-stats">
            <h3>Current Configuration</h3>
            <div className="stat-item">
              <span className="stat-label">Cultures:</span>
              <span className="stat-value">{Object.keys(cultures).length}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Entity Types:</span>
              <span className="stat-value">{worldSchema?.hardState?.length || 0}</span>
            </div>
            {selectedCulture && (
              <div className="stat-item" style={{ marginTop: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem' }}>
                <span className="stat-label">Selected:</span>
                <span className="stat-value" style={{ color: 'var(--gold-accent)' }}>{selectedCulture}</span>
              </div>
            )}
          </div>
        </aside>

        <main className="main-content">
          {loading ? (
            <div className="loading">
              <div className="spinner"></div>
              <span>Loading {currentMetaDomain} data...</span>
            </div>
          ) : !currentMetaDomain ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
              <p>Select or create a meta-domain to begin</p>
            </div>
          ) : (
            <>
              {activeTab === 'schema' && (
                <SchemaLoader
                  metaDomain={currentMetaDomain}
                  onSchemaLoaded={setWorldSchema}
                />
              )}

              {activeTab === 'workshop' && (
                <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
                  <div style={{
                    width: '300px',
                    borderRight: '1px solid var(--border-color)',
                    background: 'rgba(30, 58, 95, 0.1)',
                    overflowY: 'auto'
                  }}>
                    <CultureSidebar
                      metaDomain={currentMetaDomain}
                      worldSchema={worldSchema}
                      cultures={cultures}
                      selectedCulture={selectedCulture}
                      selectedEntityKind={selectedEntityKind}
                      onSelectCulture={setSelectedCulture}
                      onSelectEntityKind={setSelectedEntityKind}
                      onCulturesChange={setCultures}
                    />
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto' }}>
                    <EntityWorkspace
                      metaDomain={currentMetaDomain}
                      worldSchema={worldSchema}
                      cultureId={selectedCulture}
                      entityKind={selectedEntityKind}
                      entityConfig={
                        selectedCulture && selectedEntityKind
                          ? cultures[selectedCulture]?.entityConfigs?.[selectedEntityKind]
                          : null
                      }
                      cultureConfig={selectedCulture ? cultures[selectedCulture] : null}
                      allCultures={cultures}
                      onConfigChange={(updatedConfig) => {
                        if (selectedCulture && selectedEntityKind) {
                          setCultures(prev => ({
                            ...prev,
                            [selectedCulture]: {
                              ...prev[selectedCulture],
                              entityConfigs: {
                                ...prev[selectedCulture].entityConfigs,
                                [selectedEntityKind]: updatedConfig
                              }
                            }
                          }));
                        }
                      }}
                    />
                  </div>
                </div>
              )}

              {activeTab === 'test' && (
                <NameTester
                  metaDomain={currentMetaDomain}
                  profiles={profiles}
                  domains={domains}
                  grammars={grammars}
                  generatedContent={generatedContent}
                />
              )}

              {activeTab === 'export' && (
                <ConfigExporter
                  metaDomain={currentMetaDomain}
                  domains={domains}
                  grammars={grammars}
                  profiles={profiles}
                  lexemeSpecs={lexemeSpecs}
                  templateSpecs={templateSpecs}
                  generatedContent={generatedContent}
                />
              )}
            </>
          )}
        </main>

        <aside className="guide-sidebar">
          <div className="guide-content">
            <h2>Culture Workshop Workflow</h2>
            <p className="text-muted">
              Build naming configurations organized by culture and entity type.
            </p>

            <div className="guide-step">
              <h3>1. Schema Setup</h3>
              <p>Review the world schema which defines:</p>
              <ul>
                <li>Available cultures (e.g., dwarf, elf, goauld)</li>
                <li>Entity types (npc, location, faction, etc.)</li>
                <li>Subtypes and status values for each</li>
              </ul>
            </div>

            <div className="guide-step">
              <h3>2. Culture Workshop</h3>
              <p>Select a culture and entity type to configure:</p>
              <ul>
                <li><strong>Domain:</strong> Sound patterns, syllables, morphology</li>
                <li><strong>Lexemes:</strong> Word lists (nouns, adjectives, titles)</li>
                <li><strong>Templates:</strong> Name patterns like {`{{TITLE}} {{NAME}}`}</li>
                <li><strong>Grammars:</strong> Complex name generation rules</li>
                <li><strong>Profile:</strong> Combine strategies with weights</li>
              </ul>
            </div>

            <div className="guide-step">
              <h3>3. Test & Export</h3>
              <p>Use the Name Tester to preview generated names, then export your configuration for use in world-gen.</p>
            </div>

            <div className="guide-quickstart">
              <strong>Quick Start:</strong> Select "seed" or "test" meta-domain, pick a culture like "dwarf", then create a domain for "npc" names.
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default App;

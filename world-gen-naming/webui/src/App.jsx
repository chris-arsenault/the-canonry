import { useState, useEffect, useCallback } from 'react';
import './App.css';
import MetaDomainManager from './components/MetaDomainManager';
import SchemaLoader from './components/SchemaLoader';
import CultureSidebar from './components/CultureSidebar';
import EntityWorkspace from './components/EntityWorkspace';

const API_URL = 'http://localhost:3001';

// Read initial state from URL
function getInitialStateFromURL() {
  const params = new URLSearchParams(window.location.search);
  return {
    metaDomain: params.get('md') || null,
    culture: params.get('culture') || null,
    entity: params.get('entity') || null,
    tab: params.get('tab') || 'schema',
    workspaceTab: params.get('wtab') || 'domain'
  };
}

function App() {
  const initialState = getInitialStateFromURL();

  const [currentMetaDomain, setCurrentMetaDomain] = useState(initialState.metaDomain);
  const [activeTab, setActiveTab] = useState(initialState.tab);
  const [loading, setLoading] = useState(false);

  // V2 architecture state
  const [worldSchema, setWorldSchema] = useState(null);
  const [cultures, setCultures] = useState({});
  const [selectedCulture, setSelectedCulture] = useState(initialState.culture);
  const [selectedEntityKind, setSelectedEntityKind] = useState(initialState.entity);
  const [workspaceTab, setWorkspaceTab] = useState(initialState.workspaceTab);

  // Update URL when state changes
  const updateURL = useCallback(() => {
    const params = new URLSearchParams();
    if (currentMetaDomain) params.set('md', currentMetaDomain);
    if (selectedCulture) params.set('culture', selectedCulture);
    if (selectedEntityKind) params.set('entity', selectedEntityKind);
    if (activeTab && activeTab !== 'schema') params.set('tab', activeTab);
    if (workspaceTab && workspaceTab !== 'domain') params.set('wtab', workspaceTab);

    const newURL = params.toString() ? `?${params.toString()}` : window.location.pathname;
    window.history.replaceState({}, '', newURL);
  }, [currentMetaDomain, selectedCulture, selectedEntityKind, activeTab, workspaceTab]);

  useEffect(() => {
    updateURL();
  }, [updateURL]);

  // Load meta-domain data when selection changes
  useEffect(() => {
    if (!currentMetaDomain) return;

    loadMetaDomainV2(currentMetaDomain);
  }, [currentMetaDomain]);

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

        // Debug: log what we loaded
        console.log(`Loaded v2 meta-domain '${metaDomain}':`, {
          cultures: Object.keys(data.cultures || {}).length,
          entityTypes: data.worldSchema?.hardState?.length || 0
        });

        // Debug: show detailed data for each culture/entity
        Object.entries(data.cultures || {}).forEach(([cultureId, culture]) => {
          Object.entries(culture.entityConfigs || {}).forEach(([entityKind, config]) => {
            console.log(`  ${cultureId}/${entityKind}:`, {
              hasProfile: !!config.profile,
              profileStrategies: config.profile?.strategies?.map(s => s.type),
              lexemeCount: Object.keys(config.lexemeLists || {}).length,
              lexemeIds: Object.keys(config.lexemeLists || {}),
              grammarCount: (config.grammars || []).length,
              templateCount: (config.templates || []).length
            });
          });
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
                      activeTab={workspaceTab}
                      onTabChange={setWorkspaceTab}
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
              <h3>3. Test Names</h3>
              <p>In the Profile tab, use "Generate Test Names" to preview generated names and verify your configuration works correctly.</p>
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

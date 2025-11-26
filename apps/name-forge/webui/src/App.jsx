import { useState, useEffect, useCallback } from 'react';
import './App.css';
import ProjectManager from './components/ProjectManager';
import SchemaLoader from './components/SchemaLoader';
import CultureSidebar from './components/CultureSidebar';
import EntityWorkspace from './components/EntityWorkspace';
import OptimizerWorkshop from './components/OptimizerWorkshop';
import GenerateTab from './components/GenerateTab';
import HomePage from './components/HomePage';
import { useProjectStorage } from './storage';

// Read initial state from URL
function getInitialStateFromURL() {
  const params = new URLSearchParams(window.location.search);
  return {
    culture: params.get('culture') || null,
    tab: params.get('tab') || 'home',
    workspaceTab: params.get('wtab') || 'domain'
  };
}

function App() {
  const initialState = getInitialStateFromURL();

  const [activeTab, setActiveTab] = useState(initialState.tab);
  const [selectedCulture, setSelectedCulture] = useState(initialState.culture);
  const [workspaceTab, setWorkspaceTab] = useState(initialState.workspaceTab);

  // Session-only API key (not persisted)
  const [apiKey, setApiKey] = useState('');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);

  // GenerateTab form state (persisted across tab switches)
  const [generateFormState, setGenerateFormState] = useState({
    selectedCulture: '',
    selectedProfile: '',
    selectedKind: '',
    selectedSubKind: '',
    tags: '',
    prominence: '',
    count: 20,
    contextPairs: [{ key: '', value: '' }]
  });

  // Use IndexedDB storage
  const {
    projects,
    currentProject,
    loading,
    error,
    storageAvailable,
    createProject,
    loadProjectById,
    deleteProjectById,
    exportCurrentProject,
    importProjectFromFile,
    updateProject,
    clearError
  } = useProjectStorage();

  // Derived state from current project
  const worldSchema = currentProject?.worldSchema || null;
  const cultures = currentProject?.cultures || {};

  // Update URL when state changes
  const updateURL = useCallback(() => {
    const params = new URLSearchParams();
    if (selectedCulture) params.set('culture', selectedCulture);
    if (activeTab && activeTab !== 'home') params.set('tab', activeTab);
    if (workspaceTab && workspaceTab !== 'domain') params.set('wtab', workspaceTab);

    const newURL = params.toString() ? `?${params.toString()}` : window.location.pathname;
    window.history.replaceState({}, '', newURL);
  }, [selectedCulture, activeTab, workspaceTab]);

  useEffect(() => {
    updateURL();
  }, [updateURL]);

  // Handle worldSchema updates
  const handleSchemaLoaded = async (newSchema) => {
    if (!currentProject) return;
    await updateProject({ worldSchema: newSchema });
  };

  // Handle cultures updates
  const handleCulturesChange = async (newCultures) => {
    if (!currentProject) return;
    await updateProject({ cultures: newCultures });
  };

  // Handle single culture updates (e.g., domains)
  const handleCultureChange = async (updatedCulture) => {
    if (!currentProject || !selectedCulture) return;

    const newCultures = {
      ...cultures,
      [selectedCulture]: updatedCulture
    };

    await updateProject({ cultures: newCultures });
  };


  return (
    <div className="app">
      <header className="app-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1
              onClick={() => setActiveTab('home')}
              style={{ cursor: 'pointer' }}
              title="Go to home"
            >
              Name Forge
            </h1>
            <p className="subtitle">
              Craft distinctive names for your worlds
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <button
              onClick={() => setShowApiKeyInput(!showApiKeyInput)}
              className={apiKey ? 'primary' : 'secondary'}
              style={{ fontSize: 'var(--text-xs)' }}
            >
              {apiKey ? '✓ API Key Set' : 'Set API Key'}
            </button>
            {showApiKeyInput && (
              <div className="api-key-dropdown">
                <div style={{ marginBottom: 'var(--space-xs)', fontSize: 'var(--text-sm)', fontWeight: '600' }}>
                  Anthropic API Key
                </div>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--arctic-frost)', marginBottom: 'var(--space-sm)' }}>
                  Required for LLM lexeme generation. Not stored.
                </p>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-ant-..."
                  style={{ width: '100%', marginBottom: 'var(--space-sm)' }}
                />
                <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                  <button className="primary" style={{ flex: 1 }} onClick={() => setShowApiKeyInput(false)}>
                    Done
                  </button>
                  {apiKey && (
                    <button className="secondary" onClick={() => { setApiKey(''); }}>
                      Clear
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="app-container">
        <aside className="sidebar">
          <ProjectManager
            projects={projects}
            currentProject={currentProject}
            loading={loading}
            error={error}
            storageAvailable={storageAvailable}
            onCreateProject={createProject}
            onLoadProject={loadProjectById}
            onDeleteProject={deleteProjectById}
            onExportProject={exportCurrentProject}
            onImportProject={importProjectFromFile}
            onClearError={clearError}
          />

          <nav className="tab-nav">
            <button
              className={activeTab === 'home' ? 'active' : ''}
              onClick={() => setActiveTab('home')}
            >
              Home
            </button>
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
              className={activeTab === 'optimizer' ? 'active' : ''}
              onClick={() => setActiveTab('optimizer')}
            >
              Optimizer
            </button>
            <button
              className={activeTab === 'generate' ? 'active' : ''}
              onClick={() => setActiveTab('generate')}
            >
              Generate
            </button>
          </nav>

          <div className="domain-stats">
            <h3>Configuration</h3>
            <div className="stat-item">
              <span className="stat-label">Cultures</span>
              <span className="stat-value">{Object.keys(cultures).length}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Entity Types</span>
              <span className="stat-value">{worldSchema?.hardState?.length || 0}</span>
            </div>
            {selectedCulture && (
              <div className="stat-item" style={{ marginTop: 'var(--space-sm)', borderTop: '1px solid var(--border-color)', paddingTop: 'var(--space-sm)' }}>
                <span className="stat-label">Selected</span>
                <span className="stat-value">{selectedCulture}</span>
              </div>
            )}
          </div>
        </aside>

        <main className="main-content">
          {loading ? (
            <div className="loading">
              <div className="spinner"></div>
              <span>Loading...</span>
            </div>
          ) : !currentProject ? (
            <div style={{ padding: 'var(--space-xl)', textAlign: 'center' }}>
              <h2>Welcome to Name Forge</h2>
              <p className="text-muted" style={{ marginTop: 'var(--space-sm)' }}>
                Create a new project or import an existing one to begin.
              </p>
              <p style={{ marginTop: 'var(--space-md)', fontSize: 'var(--text-xs)', color: 'var(--arctic-frost)' }}>
                Projects are stored locally. Use Export to save backups.
              </p>
            </div>
          ) : (
            <>
              {activeTab === 'home' && (
                <HomePage onNavigate={setActiveTab} />
              )}

              {activeTab === 'schema' && (
                <SchemaLoader
                  worldSchema={worldSchema}
                  cultures={cultures}
                  onSchemaLoaded={handleSchemaLoaded}
                  onCulturesChange={handleCulturesChange}
                />
              )}

              {activeTab === 'workshop' && (
                <div className="workshop-container">
                  <div className="workshop-sidebar">
                    <CultureSidebar
                      cultures={cultures}
                      selectedCulture={selectedCulture}
                      onSelectCulture={setSelectedCulture}
                      onCulturesChange={handleCulturesChange}
                    />
                  </div>
                  <div className="workshop-content">
                    <EntityWorkspace
                      worldSchema={worldSchema}
                      cultureId={selectedCulture}
                      cultureConfig={selectedCulture ? cultures[selectedCulture] : null}
                      allCultures={cultures}
                      activeTab={workspaceTab}
                      onTabChange={setWorkspaceTab}
                      onCultureChange={handleCultureChange}
                      apiKey={apiKey}
                    />
                  </div>
                </div>
              )}

              {activeTab === 'generate' && (
                <GenerateTab
                  worldSchema={worldSchema}
                  cultures={cultures}
                  formState={generateFormState}
                  onFormStateChange={setGenerateFormState}
                />
              )}

              {activeTab === 'optimizer' && (
                <OptimizerWorkshop
                  cultures={cultures}
                  onCulturesChange={handleCulturesChange}
                />
              )}
            </>
          )}
        </main>

        <aside className="guide-sidebar">
          <div className="guide-content">
            <h2>Name Forge Workflow</h2>
            <p className="text-muted">
              Build naming configurations organized by culture and entity type.
            </p>

            <div className="guide-step">
              <h3>1. Project Setup</h3>
              <p>Create a new project or import an existing one:</p>
              <ul>
                <li>Projects are stored in your browser</li>
                <li>Export to save backups as JSON files</li>
                <li>Import to restore or share projects</li>
              </ul>
            </div>

            <div className="guide-step">
              <h3>2. Schema Tab</h3>
              <p>Define your world structure:</p>
              <ul>
                <li>Add cultures (e.g., dwarf, elf, goauld)</li>
                <li>Entity types are predefined (npc, location, etc.)</li>
                <li>Customize subtypes and statuses</li>
              </ul>
            </div>

            <div className="guide-step">
              <h3>3. Workshop Tab</h3>
              <p>Select a culture and entity type to configure:</p>
              <ul>
                <li><strong>Domain:</strong> Sound patterns, syllables</li>
                <li><strong>Lexemes:</strong> Word lists for grammars</li>
                <li><strong>Grammars:</strong> Name structure rules</li>
                <li><strong>Profile:</strong> Combine strategies</li>
              </ul>
            </div>

            <div className="guide-step">
              <h3>4. Optimizer Tab</h3>
              <p>Auto-tune domain parameters:</p>
              <ul>
                <li>Hill Climbing, Simulated Annealing</li>
                <li>Genetic Algorithm, Bayesian (TPE)</li>
              </ul>
            </div>

            <div className="guide-step">
              <h3>5. Generate Tab</h3>
              <p>Generate names with full control:</p>
              <ul>
                <li>Select culture, entity kind, and subtype</li>
                <li>Filter by tags and prominence level</li>
                <li>Generate 1-100 names at once</li>
                <li>View strategy usage and copy results</li>
              </ul>
            </div>

            <div className="guide-quickstart">
              <strong>Quick Start:</strong> Create a project, add a culture in Schema tab, then go to Workshop to configure naming.
            </div>

            <div className="guide-step" style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
              <h3>TypeScript Integration</h3>
              <p style={{ fontSize: '0.85rem' }}>
                Export your project JSON and use the generation library in your TypeScript projects.
                See the{' '}
                <a
                  href="https://github.com/chris-arsenault/penguin-tales/apps/name-forge"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--gold-accent)', textDecoration: 'underline' }}
                >
                  GitHub repository
                </a>
                {' '}for usage examples.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default App;

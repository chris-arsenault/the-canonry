import { useState } from 'react';
import { API_URL, POS_TAGS } from '../constants';
import { getEffectiveDomain, getSharedLexemeLists } from '../utils';

function LexemesTab({ metaDomain, cultureId, entityKind, entityConfig, onConfigChange, worldSchema, cultureConfig, allCultures }) {
  const [mode, setMode] = useState('view'); // 'view', 'create-spec', 'create-manual', 'generate'
  const [selectedList, setSelectedList] = useState(null);
  const [selectedListSource, setSelectedListSource] = useState(null); // { cultureId, entityKind } or null for local
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [apiKey, setApiKey] = useState('');

  // Get all cultures and entity kinds for sharing options
  const allCultureIds = Object.keys(allCultures || {});
  const allEntityKinds = worldSchema?.hardState?.map(e => e.kind) || [];

  // Form state for spec creation
  const [specForm, setSpecForm] = useState({
    id: `${cultureId}_${entityKind}_nouns`,
    pos: 'noun',
    style: '',
    targetCount: 30,
    qualityFilter: { minLength: 3, maxLength: 15 },
    appliesTo: {
      cultures: [cultureId],
      entityKinds: [entityKind]
    }
  });

  // Form state for manual list creation
  const [manualForm, setManualForm] = useState({
    id: `${cultureId}_${entityKind}_manual`,
    description: '',
    entries: '',
    appliesTo: {
      cultures: [cultureId],
      entityKinds: [entityKind]
    }
  });

  // Get entity subtypes from schema for style hints
  const entitySchema = worldSchema?.hardState?.find(e => e.kind === entityKind);
  const subtypes = entitySchema?.subtype || [];

  // Get existing lexeme lists from entity config
  const lexemeLists = entityConfig?.lexemeLists || {};
  const lexemeSpecs = entityConfig?.lexemeSpecs || [];

  const cultureDomains = cultureConfig?.domains || [];
  const effectiveDomain = getEffectiveDomain(cultureConfig);

  const sharedListsMap = getSharedLexemeLists(allCultures, cultureId, entityKind);
  const sharedLists = Object.values(sharedListsMap);

  const handleSaveSpec = () => {
    const newSpec = {
      ...specForm,
      cultureId,
      entityKind
    };

    const updatedSpecs = [...lexemeSpecs.filter(s => s.id !== newSpec.id), newSpec];
    const updatedConfig = {
      ...entityConfig,
      lexemeSpecs: updatedSpecs
    };
    onConfigChange(updatedConfig);
    setMode('view');
    setSpecForm({
      id: `${cultureId}_${entityKind}_nouns`,
      pos: 'noun',
      style: '',
      targetCount: 30,
      qualityFilter: { minLength: 3, maxLength: 15 }
    });
  };

  const handleDeleteSpec = (specId) => {
    const updatedSpecs = lexemeSpecs.filter(s => s.id !== specId);
    const updatedConfig = {
      ...entityConfig,
      lexemeSpecs: updatedSpecs
    };
    onConfigChange(updatedConfig);
  };

  const handleSaveManualList = async () => {
    if (!manualForm.id.trim()) {
      setError('Please enter a list ID');
      return;
    }

    const entries = manualForm.entries
      .split(/[\n,]/)
      .map(e => e.trim())
      .filter(e => e);

    if (entries.length === 0) {
      setError('Please enter at least one entry');
      return;
    }

    const newList = {
      id: manualForm.id,
      description: manualForm.description || 'Manual list',
      entries: entries,
      source: 'manual',
      appliesTo: manualForm.appliesTo
    };

    const updatedLists = {
      ...lexemeLists,
      [manualForm.id]: newList
    };

    const updatedConfig = {
      ...entityConfig,
      lexemeLists: updatedLists,
      completionStatus: {
        ...entityConfig?.completionStatus,
        lexemes: Object.keys(updatedLists).length
      }
    };

    onConfigChange(updatedConfig);
    setMode('view');
    setManualForm({
      id: `${cultureId}_${entityKind}_manual`,
      description: '',
      entries: '',
      appliesTo: {
        cultures: [cultureId],
        entityKinds: [entityKind]
      }
    });
    setError(null);
  };

  const handleGenerate = async (spec) => {
    setLoading(true);
    setError(null);

    try {
      const requestBody = {
        spec: {
          ...spec,
          cultureId,
          domain: effectiveDomain
        },
        metaDomain: metaDomain
      };

      // Only include apiKey if user provided one (otherwise server uses env var)
      if (apiKey && apiKey.trim()) {
        requestBody.apiKey = apiKey.trim();
      }

      const response = await fetch(`${API_URL}/api/generate/lexeme`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Generation failed');
      }

      const data = await response.json();

      const newList = {
        id: spec.id,
        description: `Generated ${spec.pos} list: ${spec.style}`,
        entries: data.result.entries,
        source: 'llm',
        filtered: data.result.filtered,
        tokensUsed: data.result.tokensUsed,
        appliesTo: spec.appliesTo || { cultures: [cultureId], entityKinds: [entityKind] }
      };

      const updatedLists = {
        ...lexemeLists,
        [spec.id]: newList
      };

      const updatedConfig = {
        ...entityConfig,
        lexemeLists: updatedLists,
        completionStatus: {
          ...entityConfig?.completionStatus,
          lexemes: Object.keys(updatedLists).length
        }
      };

      onConfigChange(updatedConfig);
      setSelectedList(spec.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteList = (listId) => {
    const updatedLists = { ...lexemeLists };
    delete updatedLists[listId];

    const updatedConfig = {
      ...entityConfig,
      lexemeLists: updatedLists,
      completionStatus: {
        ...entityConfig?.completionStatus,
        lexemes: Object.keys(updatedLists).length
      }
    };

    onConfigChange(updatedConfig);
    if (selectedList === listId) setSelectedList(null);
  };

  // View mode - show existing lists and specs
  if (mode === 'view') {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0 }}>Lexeme Lists</h3>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="primary" onClick={() => setMode('create-spec')}>
              + New Spec
            </button>
            <button className="secondary" onClick={() => setMode('create-manual')}>
              + Manual List
            </button>
          </div>
        </div>

        <p className="text-muted" style={{ marginBottom: '1rem' }}>
          Create lexeme specs to generate word lists via LLM, or add manual lists for function words.
        </p>

        {error && <div className="error" style={{ marginBottom: '1rem' }}>{error}</div>}

        {/* Lexeme Specs Section */}
        {lexemeSpecs.length > 0 && (
          <div style={{ marginBottom: '1.5rem' }}>
            <h4 style={{ marginBottom: '0.5rem' }}>Generation Specs ({lexemeSpecs.length})</h4>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {lexemeSpecs.map(spec => {
                const hasGenerated = lexemeLists[spec.id];
                return (
                  <div
                    key={spec.id}
                    style={{
                      background: 'rgba(30, 58, 95, 0.3)',
                      padding: '0.75rem 1rem',
                      borderRadius: '6px',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <strong>{spec.id}</strong>
                      {hasGenerated && (
                        <span style={{
                          marginLeft: '0.5rem',
                          padding: '0.125rem 0.5rem',
                          background: 'rgba(34, 197, 94, 0.2)',
                          border: '1px solid rgba(34, 197, 94, 0.4)',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          color: 'rgb(134, 239, 172)'
                        }}>
                          Generated ({lexemeLists[spec.id]?.entries?.length || 0})
                        </span>
                      )}
                      <div style={{ fontSize: '0.875rem', color: 'var(--arctic-frost)', marginTop: '0.25rem' }}>
                        {spec.pos} • {spec.targetCount} words
                        {spec.style && ` • ${spec.style.substring(0, 50)}${spec.style.length > 50 ? '...' : ''}`}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {hasGenerated && (
                        <button
                          className="secondary"
                          style={{ fontSize: '0.875rem' }}
                          onClick={() => setSelectedList(spec.id)}
                        >
                          View
                        </button>
                      )}
                      <button
                        className="primary"
                        style={{ fontSize: '0.875rem' }}
                        onClick={() => handleGenerate(spec)}
                        disabled={loading}
                      >
                        {loading ? '...' : hasGenerated ? 'Regenerate' : 'Generate'}
                      </button>
                      <button
                        className="danger"
                        style={{ fontSize: '0.875rem' }}
                        onClick={() => handleDeleteSpec(spec.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Generated & Manual Lists Section */}
        <div style={{ display: 'flex', gap: '1.5rem' }}>
          <div style={{ flex: selectedList ? '0 0 50%' : '1' }}>
            <h4 style={{ marginBottom: '0.5rem' }}>
              Local Lists ({Object.keys(lexemeLists).length})
            </h4>

            {Object.keys(lexemeLists).length === 0 ? (
              <div style={{
                background: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: '6px',
                padding: '1.5rem',
                textAlign: 'center'
              }}>
                <p style={{ margin: 0 }}>No local lexeme lists yet.</p>
                <p className="text-muted" style={{ marginTop: '0.5rem' }}>
                  Create a spec and generate via LLM, or add a manual list.
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                {Object.entries(lexemeLists).map(([listId, list]) => {
                  const isSelected = selectedList === listId && !selectedListSource;
                  const sharingInfo = list.appliesTo || {};
                  const sharesWithOthers = (sharingInfo.cultures?.length > 1 || sharingInfo.cultures?.includes('*')) ||
                    (sharingInfo.entityKinds?.length > 1 || sharingInfo.entityKinds?.includes('*'));

                  return (
                    <div
                      key={listId}
                      style={{
                        background: isSelected ? 'rgba(212, 175, 55, 0.1)' : 'rgba(30, 58, 95, 0.3)',
                        padding: '0.75rem 1rem',
                        borderRadius: '6px',
                        border: isSelected ? '1px solid var(--gold-accent)' : '1px solid rgba(59, 130, 246, 0.3)',
                        cursor: 'pointer'
                      }}
                      onClick={() => { setSelectedList(listId); setSelectedListSource(null); }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <strong>{listId}</strong>
                          <span style={{
                            marginLeft: '0.5rem',
                            padding: '0.125rem 0.5rem',
                            background: list.source === 'manual' ? 'rgba(251, 191, 36, 0.2)' : 'rgba(34, 197, 94, 0.2)',
                            border: `1px solid ${list.source === 'manual' ? 'rgba(251, 191, 36, 0.4)' : 'rgba(34, 197, 94, 0.4)'}`,
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            color: list.source === 'manual' ? 'rgb(253, 224, 71)' : 'rgb(134, 239, 172)'
                          }}>
                            {list.source === 'manual' ? 'Manual' : 'LLM'}
                          </span>
                          {sharesWithOthers && (
                            <span style={{
                              marginLeft: '0.25rem',
                              padding: '0.125rem 0.5rem',
                              background: 'rgba(147, 51, 234, 0.2)',
                              border: '1px solid rgba(147, 51, 234, 0.4)',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              color: 'rgb(192, 132, 252)'
                            }}>
                              Shared
                            </span>
                          )}
                          <div style={{ fontSize: '0.875rem', color: 'var(--arctic-frost)', marginTop: '0.25rem' }}>
                            {list.entries?.length || 0} entries
                            {list.tokensUsed > 0 && ` • ${list.tokensUsed} tokens`}
                          </div>
                        </div>
                        <button
                          className="danger"
                          style={{ fontSize: '0.75rem' }}
                          onClick={(e) => { e.stopPropagation(); handleDeleteList(listId); }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Shared Lists Section */}
            {sharedLists.length > 0 && (
              <div style={{ marginTop: '1.5rem' }}>
                <h4 style={{ marginBottom: '0.5rem' }}>
                  Shared Lists ({sharedLists.length})
                </h4>
                <p className="text-muted" style={{ fontSize: '0.75rem', marginBottom: '0.5rem' }}>
                  Lists from other cultures/entity types that apply here
                </p>
                <div style={{ display: 'grid', gap: '0.5rem' }}>
                  {sharedLists.map((list) => {
                    const isSelected = selectedList === list.id &&
                      selectedListSource?.cultureId === list.sourceCulture &&
                      selectedListSource?.entityKind === list.sourceEntity;

                    return (
                      <div
                        key={`${list.sourceCulture}-${list.sourceEntity}-${list.id}`}
                        style={{
                          background: isSelected ? 'rgba(147, 51, 234, 0.1)' : 'rgba(30, 58, 95, 0.2)',
                          padding: '0.75rem 1rem',
                          borderRadius: '6px',
                          border: isSelected ? '1px solid rgba(147, 51, 234, 0.6)' : '1px solid rgba(147, 51, 234, 0.3)',
                          cursor: 'pointer'
                        }}
                        onClick={() => {
                          setSelectedList(list.id);
                          setSelectedListSource({ cultureId: list.sourceCulture, entityKind: list.sourceEntity });
                        }}
                      >
                        <div>
                          <strong>{list.id}</strong>
                          <span style={{
                            marginLeft: '0.5rem',
                            padding: '0.125rem 0.5rem',
                            background: 'rgba(147, 51, 234, 0.2)',
                            border: '1px solid rgba(147, 51, 234, 0.4)',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            color: 'rgb(192, 132, 252)'
                          }}>
                            from {list.sourceCulture}/{list.sourceEntity}
                          </span>
                          <div style={{ fontSize: '0.875rem', color: 'var(--arctic-frost)', marginTop: '0.25rem' }}>
                            {list.entries?.length || 0} entries
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Selected List Viewer */}
          {selectedList && (
            <div style={{
              flex: '0 0 45%',
              background: selectedListSource ? 'rgba(147, 51, 234, 0.1)' : 'rgba(30, 58, 95, 0.2)',
              borderRadius: '6px',
              padding: '1rem',
              border: selectedListSource ? '1px solid rgba(147, 51, 234, 0.3)' : '1px solid rgba(59, 130, 246, 0.3)',
              maxHeight: '500px',
              overflowY: 'auto'
            }}>
              {(() => {
                const list = selectedListSource
                  ? sharedLists.find(l => l.id === selectedList && l.sourceCulture === selectedListSource.cultureId && l.sourceEntity === selectedListSource.entityKind)
                  : lexemeLists[selectedList];

                if (!list) return null;

                return (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <h4 style={{ margin: 0 }}>{selectedList}</h4>
                      <button className="secondary" style={{ fontSize: '0.75rem' }} onClick={() => { setSelectedList(null); setSelectedListSource(null); }}>
                        Close
                      </button>
                    </div>

                    {selectedListSource && (
                      <div style={{
                        background: 'rgba(147, 51, 234, 0.2)',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '4px',
                        marginBottom: '1rem',
                        fontSize: '0.75rem',
                        color: 'rgb(192, 132, 252)'
                      }}>
                        Shared from: {selectedListSource.cultureId} / {selectedListSource.entityKind}
                      </div>
                    )}

                    {list.description && (
                      <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>
                        {list.description}
                      </p>
                    )}

                    {/* Sharing info */}
                    {list.appliesTo && (
                      <div style={{ marginBottom: '1rem', fontSize: '0.75rem', color: 'var(--arctic-frost)' }}>
                        <div>Cultures: {list.appliesTo.cultures?.includes('*') ? 'All' : list.appliesTo.cultures?.join(', ') || 'This only'}</div>
                        <div>Entities: {list.appliesTo.entityKinds?.includes('*') ? 'All' : list.appliesTo.entityKinds?.join(', ') || 'This only'}</div>
                      </div>
                    )}

                    <div style={{
                      background: 'rgba(0, 0, 0, 0.2)',
                      padding: '0.75rem',
                      borderRadius: '4px',
                      fontFamily: 'monospace',
                      fontSize: '0.875rem',
                      whiteSpace: 'pre-wrap',
                      maxHeight: '300px',
                      overflowY: 'auto'
                    }}>
                      {JSON.stringify(list.entries, null, 2)}
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>

        {/* API Key Section (collapsed by default) */}
        {lexemeSpecs.length > 0 && (
          <div style={{ marginTop: '1.5rem' }}>
            <details>
              <summary style={{ cursor: 'pointer', color: 'var(--arctic-frost)' }}>
                API Key Settings
              </summary>
              <div style={{ marginTop: '0.5rem' }}>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-ant-... (required if not set in server environment)"
                  style={{ width: '100%' }}
                />
              </div>
            </details>
          </div>
        )}
      </div>
    );
  }

  // Create Spec Mode
  if (mode === 'create-spec') {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0 }}>New Lexeme Spec</h3>
        </div>

        <p className="text-muted" style={{ marginBottom: '1rem' }}>
          Define what kind of words to generate. The LLM will create words matching your domain's phonology.
        </p>

        {error && <div className="error" style={{ marginBottom: '1rem' }}>{error}</div>}

        <div className="form-group">
          <label>Spec ID</label>
          <input
            value={specForm.id}
            onChange={(e) => setSpecForm({ ...specForm, id: e.target.value })}
            placeholder={`${cultureId}_${entityKind}_nouns`}
          />
          <small className="text-muted">Unique identifier for this spec</small>
        </div>

        <div className="form-grid-2">
          <div className="form-group">
            <label>Part of Speech</label>
            <select
              value={specForm.pos}
              onChange={(e) => setSpecForm({ ...specForm, pos: e.target.value })}
            >
              {POS_TAGS.map(tag => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Target Count</label>
            <input
              type="number"
              value={specForm.targetCount}
              onChange={(e) => setSpecForm({ ...specForm, targetCount: parseInt(e.target.value) || 30 })}
            />
          </div>
        </div>

        <div className="form-group">
          <label>Style Description</label>
          <textarea
            value={specForm.style}
            onChange={(e) => setSpecForm({ ...specForm, style: e.target.value })}
            placeholder={`e.g., ${entityKind === 'npc' ? 'heroic, noble-sounding personal names' : entityKind === 'location' ? 'mystical, ancient place names' : 'powerful, evocative names'}`}
            rows={3}
          />
          <small className="text-muted">
            Describe the feel/theme for these words.
            {subtypes.length > 0 && (
              <span> Subtypes for {entityKind}: <em>{subtypes.join(', ')}</em></span>
            )}
          </small>
        </div>

        {effectiveDomain && (
          <div style={{
            background: 'rgba(34, 197, 94, 0.1)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            borderRadius: '6px',
            padding: '0.75rem',
            marginBottom: '1rem',
            fontSize: '0.875rem'
          }}>
            Using domain: <strong>{effectiveDomain.id}</strong>
            <span className="text-muted" style={{ marginLeft: '0.5rem' }}>
              (consonants: {effectiveDomain.phonology?.consonants?.length || 0},
              vowels: {effectiveDomain.phonology?.vowels?.length || 0})
            </span>
          </div>
        )}

        {!effectiveDomain && (
          <div style={{
            background: 'rgba(251, 191, 36, 0.1)',
            border: '1px solid rgba(251, 191, 36, 0.3)',
            borderRadius: '6px',
            padding: '0.75rem',
            marginBottom: '1rem',
            fontSize: '0.875rem',
            color: 'rgb(253, 224, 71)'
          }}>
            No domain configured. Create a domain first for better phonology-guided generation.
          </div>
        )}

        <div className="form-grid-2">
          <div className="form-group">
            <label>Min Length</label>
            <input
              type="number"
              value={specForm.qualityFilter.minLength}
              onChange={(e) => setSpecForm({
                ...specForm,
                qualityFilter: { ...specForm.qualityFilter, minLength: parseInt(e.target.value) || 3 }
              })}
            />
          </div>
          <div className="form-group">
            <label>Max Length</label>
            <input
              type="number"
              value={specForm.qualityFilter.maxLength}
              onChange={(e) => setSpecForm({
                ...specForm,
                qualityFilter: { ...specForm.qualityFilter, maxLength: parseInt(e.target.value) || 15 }
              })}
            />
          </div>
        </div>

        {/* Sharing Options */}
        <SharingOptions
          appliesTo={specForm.appliesTo}
          onChange={(appliesTo) => setSpecForm({ ...specForm, appliesTo })}
          allCultureIds={allCultureIds}
          allEntityKinds={allEntityKinds}
          currentCultureId={cultureId}
          currentEntityKind={entityKind}
        />

        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
          <button className="primary" onClick={handleSaveSpec}>Save Spec</button>
          <button className="secondary" onClick={() => setMode('view')}>Cancel</button>
        </div>
      </div>
    );
  }

  // Create Manual List Mode
  if (mode === 'create-manual') {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0 }}>Create Manual List</h3>
        </div>

        <p className="text-muted" style={{ marginBottom: '1rem' }}>
          Manually create a lexeme list without LLM generation. Perfect for function words like prepositions, articles, connectors, titles, etc.
        </p>

        {error && <div className="error" style={{ marginBottom: '1rem' }}>{error}</div>}

        <div className="form-group">
          <label>List ID</label>
          <input
            value={manualForm.id}
            onChange={(e) => setManualForm({ ...manualForm, id: e.target.value })}
            placeholder={`${cultureId}_${entityKind}_titles`}
          />
          <small className="text-muted">Use this ID with slot:list_id syntax in templates</small>
        </div>

        <div className="form-group">
          <label>Description (optional)</label>
          <input
            value={manualForm.description}
            onChange={(e) => setManualForm({ ...manualForm, description: e.target.value })}
            placeholder="e.g., Common titles and honorifics"
          />
        </div>

        <div className="form-group">
          <label>Entries</label>
          <textarea
            value={manualForm.entries}
            onChange={(e) => setManualForm({ ...manualForm, entries: e.target.value })}
            placeholder={`Enter one per line or comma-separated:\nLord\nLady\nSir\nMaster\nElder`}
            rows={10}
            style={{ fontFamily: 'monospace' }}
          />
          <small className="text-muted">
            Enter one entry per line, or use commas to separate. Empty lines will be ignored.
          </small>
        </div>

        {/* Sharing Options */}
        <SharingOptions
          appliesTo={manualForm.appliesTo}
          onChange={(appliesTo) => setManualForm({ ...manualForm, appliesTo })}
          allCultureIds={allCultureIds}
          allEntityKinds={allEntityKinds}
          currentCultureId={cultureId}
          currentEntityKind={entityKind}
        />

        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
          <button className="primary" onClick={handleSaveManualList}>Save List</button>
          <button className="secondary" onClick={() => setMode('view')}>Cancel</button>
        </div>
      </div>
    );
  }

  return null;
}

// Helper component for sharing options (used in both spec and manual forms)
function SharingOptions({ appliesTo, onChange, allCultureIds, allEntityKinds, currentCultureId, currentEntityKind }) {
  return (
    <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(147, 51, 234, 0.1)', borderRadius: '6px', border: '1px solid rgba(147, 51, 234, 0.3)' }}>
      <h4 style={{ margin: '0 0 0.75rem 0', color: 'rgb(192, 132, 252)' }}>Sharing Options</h4>

      <div className="form-group" style={{ marginBottom: '1rem' }}>
        <label style={{ fontSize: '0.875rem' }}>Share with Cultures</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.25rem' }}>
          <button
            type="button"
            onClick={() => onChange({ ...appliesTo, cultures: ['*'] })}
            style={{
              padding: '0.25rem 0.75rem',
              borderRadius: '4px',
              border: '1px solid',
              borderColor: appliesTo?.cultures?.includes('*') ? 'rgb(192, 132, 252)' : 'var(--border-color)',
              background: appliesTo?.cultures?.includes('*') ? 'rgba(147, 51, 234, 0.2)' : 'transparent',
              color: appliesTo?.cultures?.includes('*') ? 'rgb(192, 132, 252)' : 'var(--text-color)',
              cursor: 'pointer',
              fontSize: '0.875rem'
            }}
          >
            All Cultures
          </button>
          {allCultureIds.map(cultId => (
            <button
              key={cultId}
              type="button"
              onClick={() => {
                const current = appliesTo?.cultures || [];
                const filtered = current.filter(c => c !== '*');
                const newCultures = filtered.includes(cultId)
                  ? filtered.filter(c => c !== cultId)
                  : [...filtered, cultId];
                onChange({ ...appliesTo, cultures: newCultures.length ? newCultures : [currentCultureId] });
              }}
              style={{
                padding: '0.25rem 0.75rem',
                borderRadius: '4px',
                border: '1px solid',
                borderColor: appliesTo?.cultures?.includes(cultId) && !appliesTo?.cultures?.includes('*') ? 'var(--gold-accent)' : 'var(--border-color)',
                background: appliesTo?.cultures?.includes(cultId) && !appliesTo?.cultures?.includes('*') ? 'rgba(212, 175, 55, 0.2)' : 'transparent',
                color: appliesTo?.cultures?.includes(cultId) && !appliesTo?.cultures?.includes('*') ? 'var(--gold-accent)' : 'var(--text-color)',
                cursor: 'pointer',
                fontSize: '0.875rem',
                textTransform: 'capitalize'
              }}
            >
              {cultId}
            </button>
          ))}
        </div>
      </div>

      <div className="form-group" style={{ marginBottom: 0 }}>
        <label style={{ fontSize: '0.875rem' }}>Share with Entity Types</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.25rem' }}>
          <button
            type="button"
            onClick={() => onChange({ ...appliesTo, entityKinds: ['*'] })}
            style={{
              padding: '0.25rem 0.75rem',
              borderRadius: '4px',
              border: '1px solid',
              borderColor: appliesTo?.entityKinds?.includes('*') ? 'rgb(192, 132, 252)' : 'var(--border-color)',
              background: appliesTo?.entityKinds?.includes('*') ? 'rgba(147, 51, 234, 0.2)' : 'transparent',
              color: appliesTo?.entityKinds?.includes('*') ? 'rgb(192, 132, 252)' : 'var(--text-color)',
              cursor: 'pointer',
              fontSize: '0.875rem'
            }}
          >
            All Types
          </button>
          {allEntityKinds.map(kind => (
            <button
              key={kind}
              type="button"
              onClick={() => {
                const current = appliesTo?.entityKinds || [];
                const filtered = current.filter(k => k !== '*');
                const newKinds = filtered.includes(kind)
                  ? filtered.filter(k => k !== kind)
                  : [...filtered, kind];
                onChange({ ...appliesTo, entityKinds: newKinds.length ? newKinds : [currentEntityKind] });
              }}
              style={{
                padding: '0.25rem 0.75rem',
                borderRadius: '4px',
                border: '1px solid',
                borderColor: appliesTo?.entityKinds?.includes(kind) && !appliesTo?.entityKinds?.includes('*') ? 'var(--gold-accent)' : 'var(--border-color)',
                background: appliesTo?.entityKinds?.includes(kind) && !appliesTo?.entityKinds?.includes('*') ? 'rgba(212, 175, 55, 0.2)' : 'transparent',
                color: appliesTo?.entityKinds?.includes(kind) && !appliesTo?.entityKinds?.includes('*') ? 'var(--gold-accent)' : 'var(--text-color)',
                cursor: 'pointer',
                fontSize: '0.875rem',
                textTransform: 'capitalize'
              }}
            >
              {kind}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default LexemesTab;

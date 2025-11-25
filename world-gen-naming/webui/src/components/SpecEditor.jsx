import { useState } from 'react';

const API_URL = 'http://localhost:3001';
const POS_TAGS = ['noun', 'verb_3sg', 'adj', 'noun_abstract', 'prep', 'ordinal'];

function SpecEditor({ metaDomain, domains, lexemeSpecs, templateSpecs, onLexemeSpecsChange, onTemplateSpecsChange, generatedContent, onGeneratedContentChange }) {
  const [activeSpecType, setActiveSpecType] = useState('lexeme');
  const [editingSpec, setEditingSpec] = useState(null);
  const [viewingGenerated, setViewingGenerated] = useState(null);
  const [creatingManual, setCreatingManual] = useState(null);
  const [manualForm, setManualForm] = useState({ id: '', description: '', entries: '' });
  const [lexemeForm, setLexemeForm] = useState({
    id: '', cultureId: '', pos: 'noun', style: '', targetCount: 30, sourceMode: 'llm',
    qualityFilter: { minLength: 3, maxLength: 15 }
  });
  const [templateForm, setTemplateForm] = useState({
    id: '', cultureId: '', type: 'person', style: '', targetCount: 5, sourceMode: 'llm', slotHints: []
  });

  // Extract unique culture IDs from domains
  const cultureIds = [...new Set(domains.map(d => d.cultureId).filter(Boolean))].sort();

  const saveToDisk = async (updatedLexemeSpecs, updatedTemplateSpecs) => {
    try {
      const response = await fetch(`${API_URL}/api/meta-domains/${metaDomain}/specs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lexemeSpecs: updatedLexemeSpecs,
          templateSpecs: updatedTemplateSpecs
        })
      });

      if (!response.ok) {
        console.error('Failed to save specs to disk');
      } else {
        console.log('✅ Specs saved to disk');
      }
    } catch (error) {
      console.error('Error saving specs:', error);
    }
  };

  const handleAddNewLexeme = () => {
    setEditingSpec('lexeme-new');
    setLexemeForm({ id: `${metaDomain}_`, cultureId: metaDomain, pos: 'noun', style: '', targetCount: 30, sourceMode: 'llm', qualityFilter: { minLength: 3, maxLength: 15 } });
  };

  const handleSaveLexeme = () => {
    const newSpecs = editingSpec === 'lexeme-new'
      ? [...lexemeSpecs, lexemeForm]
      : lexemeSpecs.map(s => s.id === lexemeForm.id ? lexemeForm : s);
    onLexemeSpecsChange(newSpecs);
    saveToDisk(newSpecs, templateSpecs);
    setEditingSpec(null);
  };

  const handleDeleteLexeme = (id) => {
    const newSpecs = lexemeSpecs.filter(s => s.id !== id);
    onLexemeSpecsChange(newSpecs);
    saveToDisk(newSpecs, templateSpecs);
  };

  const handleAddNewTemplate = () => {
    setEditingSpec('template-new');
    setTemplateForm({
      id: `${metaDomain}_template`,
      cultureId: metaDomain,
      type: 'person',
      style: '',
      targetCount: 5,
      sourceMode: 'llm',
      slotHints: []
    });
  };

  const handleSaveTemplate = () => {
    const newSpecs = editingSpec === 'template-new'
      ? [...templateSpecs, templateForm]
      : templateSpecs.map(s => s.id === templateForm.id ? templateForm : s);
    onTemplateSpecsChange(newSpecs);
    saveToDisk(lexemeSpecs, newSpecs);
    setEditingSpec(null);
  };

  const handleDeleteTemplate = (id) => {
    const newSpecs = templateSpecs.filter(s => s.id !== id);
    onTemplateSpecsChange(newSpecs);
    saveToDisk(lexemeSpecs, newSpecs);
  };

  const handleAddSlotHint = () => {
    const newHint = { name: '', kind: 'lexemeList', description: '' };
    setTemplateForm({
      ...templateForm,
      slotHints: [...templateForm.slotHints, newHint]
    });
  };

  const handleUpdateSlotHint = (index, field, value) => {
    const updated = [...templateForm.slotHints];
    updated[index] = { ...updated[index], [field]: value };
    setTemplateForm({ ...templateForm, slotHints: updated });
  };

  const handleRemoveSlotHint = (index) => {
    setTemplateForm({
      ...templateForm,
      slotHints: templateForm.slotHints.filter((_, i) => i !== index)
    });
  };

  const handleCreateManual = () => {
    setCreatingManual('new');
    setManualForm({ id: `${metaDomain}_manual`, description: '', entries: '' });
  };

  const handleEditManual = (id) => {
    const list = generatedContent[id];
    setCreatingManual(id);
    setManualForm({
      id: id,
      description: list.description || '',
      entries: list.entries.join('\n')
    });
  };

  const handleSaveManual = async () => {
    if (!manualForm.id.trim()) {
      alert('Please enter a list ID');
      return;
    }

    // Parse entries - split by newline or comma, filter empty
    const entries = manualForm.entries
      .split(/[\n,]/)
      .map(e => e.trim())
      .filter(e => e);

    if (entries.length === 0) {
      alert('Please enter at least one entry');
      return;
    }

    const lexemeList = {
      id: manualForm.id,
      description: manualForm.description || 'Manual list',
      entries: entries
    };

    try {
      const response = await fetch(`${API_URL}/api/manual-lexeme`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metaDomain: metaDomain,
          lexemeList: lexemeList
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save manual list');
      }

      console.log('✅ Manual list saved to disk');

      // Update generatedContent in parent
      if (onGeneratedContentChange) {
        const updatedContent = {
          ...generatedContent,
          [lexemeList.id]: {
            type: 'lexeme',
            entries: entries,
            description: lexemeList.description,
            filtered: 0,
            tokensUsed: 0
          }
        };
        onGeneratedContentChange(updatedContent);
      }

      setCreatingManual(null);

    } catch (error) {
      console.error('Error saving manual list:', error);
      alert('Failed to save manual list: ' + error.message);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2>Generation Specs</h2>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <button
          className={activeSpecType === 'lexeme' ? 'primary' : 'secondary'}
          onClick={() => setActiveSpecType('lexeme')}
        >
          Lexeme Specs ({lexemeSpecs.length})
        </button>
        <button
          className={activeSpecType === 'template' ? 'primary' : 'secondary'}
          onClick={() => setActiveSpecType('template')}
        >
          Template Specs ({templateSpecs.length})
        </button>
      </div>

      {activeSpecType === 'lexeme' && (
        <>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <button className="primary" onClick={handleAddNewLexeme}>
              + New Lexeme Spec
            </button>
            <button className="secondary" onClick={handleCreateManual}>
              ✏️ Manual List
            </button>
          </div>

          {creatingManual ? (
            <div className="card">
              <h3>{creatingManual === 'new' ? 'Create Manual Lexeme List' : 'Edit Manual Lexeme List'}</h3>
              <p className="text-muted" style={{ marginBottom: '1rem' }}>
                Manually create a small lexeme list without LLM generation. Perfect for function words like prepositions, articles, connectors, etc.
              </p>

              <div className="form-group">
                <label>List ID</label>
                <input
                  value={manualForm.id}
                  onChange={(e) => setManualForm({...manualForm, id: e.target.value})}
                  placeholder="e.g., prepositions, articles, connectors"
                />
                <small className="text-muted">
                  Use this ID with slot:list_id syntax in grammars
                </small>
              </div>

              <div className="form-group">
                <label>Description (optional)</label>
                <input
                  value={manualForm.description}
                  onChange={(e) => setManualForm({...manualForm, description: e.target.value})}
                  placeholder="e.g., Common prepositions"
                />
              </div>

              <div className="form-group">
                <label>Entries</label>
                <textarea
                  value={manualForm.entries}
                  onChange={(e) => setManualForm({...manualForm, entries: e.target.value})}
                  placeholder="Enter one per line or comma-separated:&#10;as&#10;is&#10;in&#10;of&#10;to"
                  rows={10}
                  style={{ fontFamily: 'monospace' }}
                />
                <small className="text-muted">
                  Enter one entry per line, or use commas to separate. Empty lines and extra whitespace will be ignored.
                </small>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button className="primary" onClick={handleSaveManual}>Save Manual List</button>
                <button className="secondary" onClick={() => setCreatingManual(null)}>Cancel</button>
              </div>
            </div>
          ) : editingSpec && editingSpec.startsWith('lexeme') ? (
            <div className="card">
              <h3>{editingSpec === 'lexeme-new' ? 'New Lexeme Spec' : 'Edit Lexeme Spec'}</h3>

              <div className="form-group">
                <label>ID</label>
                <input value={lexemeForm.id} onChange={(e) => setLexemeForm({...lexemeForm, id: e.target.value})} placeholder="e.g., elven_nouns" />
              </div>

              <div className="form-group">
                <label>Culture ID</label>
                {cultureIds.length > 0 ? (
                  <select
                    value={lexemeForm.cultureId}
                    onChange={(e) => setLexemeForm({...lexemeForm, cultureId: e.target.value})}
                  >
                    <option value="">Select or type below...</option>
                    {cultureIds.map(id => (
                      <option key={id} value={id}>{id}</option>
                    ))}
                  </select>
                ) : null}
                <input
                  value={lexemeForm.cultureId}
                  onChange={(e) => setLexemeForm({...lexemeForm, cultureId: e.target.value})}
                  placeholder="Or enter custom culture ID"
                  style={{ marginTop: cultureIds.length > 0 ? '0.5rem' : '0' }}
                />
                <small className="text-muted">
                  {cultureIds.length > 0
                    ? 'Select from existing domains or enter a custom ID below'
                    : 'Create domains first to populate culture IDs'}
                </small>
              </div>

              <div className="form-group">
                <label>Part of Speech</label>
                <select value={lexemeForm.pos} onChange={(e) => setLexemeForm({...lexemeForm, pos: e.target.value})}>
                  {POS_TAGS.map(tag => <option key={tag} value={tag}>{tag}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label>Style Description</label>
                <textarea
                  value={lexemeForm.style}
                  onChange={(e) => setLexemeForm({...lexemeForm, style: e.target.value})}
                  placeholder="e.g., ethereal, nature-focused, flowing, elvish"
                />
              </div>

              <div className="form-group">
                <label>Target Count</label>
                <input type="number" value={lexemeForm.targetCount} onChange={(e) => setLexemeForm({...lexemeForm, targetCount: parseInt(e.target.value)})} />
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button className="primary" onClick={handleSaveLexeme}>Save</button>
                <button className="secondary" onClick={() => setEditingSpec(null)}>Cancel</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
              {/* Left column: Lists */}
              <div style={{ flex: viewingGenerated ? '0 0 45%' : '1' }}>
                <div className="item-list">
                  {lexemeSpecs.length === 0 ? (
                    <p className="text-muted">No lexeme specs yet.</p>
                  ) : (
                    lexemeSpecs.map(spec => {
                      const generated = generatedContent && generatedContent[spec.id];
                      const isGenerated = generated && (!generated.type || generated.type === 'lexeme');

                      return (
                        <div key={spec.id} className="list-item">
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <div>
                              <strong>{spec.id}</strong>
                              {isGenerated && (
                                <span style={{
                                  marginLeft: '0.5rem',
                                  padding: '0.125rem 0.5rem',
                                  background: 'rgba(34, 197, 94, 0.2)',
                                  border: '1px solid rgba(34, 197, 94, 0.4)',
                                  borderRadius: '4px',
                                  fontSize: '0.75rem',
                                  color: 'rgb(134, 239, 172)'
                                }}>
                                  ✓ Generated ({generated.entries?.length || 0})
                                </span>
                              )}
                              <p className="text-muted" style={{ margin: '0.25rem 0 0 0' }}>
                                {spec.pos} • {spec.targetCount} words • {spec.cultureId}
                              </p>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              {isGenerated && (
                                <button
                                  className="secondary"
                                  onClick={() => setViewingGenerated(spec.id)}
                                >
                                  View
                                </button>
                              )}
                              <button className="secondary" onClick={() => { setEditingSpec(`lexeme-${spec.id}`); setLexemeForm(spec); }}>Edit</button>
                              <button className="danger" onClick={() => handleDeleteLexeme(spec.id)}>Delete</button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* All Generated Lexeme Lists */}
                <div style={{ marginTop: '2rem' }}>
                  <h3 style={{ marginBottom: '1rem' }}>All Generated Lexeme Lists</h3>
                  <div className="item-list">
                    {!generatedContent || Object.keys(generatedContent).filter(id => !generatedContent[id].type || generatedContent[id].type === 'lexeme').length === 0 ? (
                      <p className="text-muted">No generated lexeme lists yet. Go to "Generate" tab to create them.</p>
                    ) : (
                      Object.keys(generatedContent)
                        .filter(id => !generatedContent[id].type || generatedContent[id].type === 'lexeme')
                        .sort()
                        .map(id => {
                          const list = generatedContent[id];
                          const hasSpec = lexemeSpecs.some(spec => spec.id === id);

                          return (
                            <div key={id} className="list-item">
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <div>
                                  <strong>{id}</strong>
                                  {!hasSpec && (
                                    <span style={{
                                      marginLeft: '0.5rem',
                                      padding: '0.125rem 0.5rem',
                                      background: 'rgba(251, 191, 36, 0.2)',
                                      border: '1px solid rgba(251, 191, 36, 0.4)',
                                      borderRadius: '4px',
                                      fontSize: '0.75rem',
                                      color: 'rgb(253, 224, 71)'
                                    }}>
                                      No spec
                                    </span>
                                  )}
                                  <p className="text-muted" style={{ margin: '0.25rem 0 0 0' }}>
                                    {list.entries?.length || 0} entries
                                    {list.filtered > 0 && ` (${list.filtered} filtered)`}
                                    {list.tokensUsed > 0 && ` • ${list.tokensUsed} tokens`}
                                  </p>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                  <button
                                    className="secondary"
                                    onClick={() => setViewingGenerated(id)}
                                  >
                                    View
                                  </button>
                                  {!hasSpec && (
                                    <button
                                      className="secondary"
                                      onClick={() => handleEditManual(id)}
                                      title="Edit manual list"
                                    >
                                      Edit
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
                    )}
                  </div>
                </div>
              </div>

              {/* Right column: Viewer */}
              {viewingGenerated && generatedContent && generatedContent[viewingGenerated] && (
                <div className="card" style={{ flex: '0 0 50%', position: 'sticky', top: '1rem', maxHeight: 'calc(100vh - 2rem)', overflowY: 'auto' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3>Generated: {viewingGenerated}</h3>
                    <button className="secondary" onClick={() => setViewingGenerated(null)}>Close</button>
                  </div>

                  <div className="success" style={{ marginBottom: '1rem' }}>
                    ✓ {generatedContent[viewingGenerated].entries?.length || 0} entries
                    {generatedContent[viewingGenerated].filtered > 0 && ` (${generatedContent[viewingGenerated].filtered} filtered)`}
                    {generatedContent[viewingGenerated].tokensUsed > 0 && ` • ${generatedContent[viewingGenerated].tokensUsed} tokens`}
                  </div>

                  <div className="code-block" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    {JSON.stringify(generatedContent[viewingGenerated].entries, null, 2)}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {activeSpecType === 'template' && (
        <>
          <button className="primary" onClick={handleAddNewTemplate} style={{ marginBottom: '1rem' }}>
            + New Template Spec
          </button>

          {editingSpec && editingSpec.startsWith('template') ? (
            <div className="card">
              <h3>{editingSpec === 'template-new' ? 'New Template Spec' : 'Edit Template Spec'}</h3>

              <div className="form-group">
                <label>ID</label>
                <input
                  value={templateForm.id}
                  onChange={(e) => setTemplateForm({...templateForm, id: e.target.value})}
                  placeholder="e.g., elven_person_templates"
                />
              </div>

              <div className="form-group">
                <label>Culture ID</label>
                {cultureIds.length > 0 ? (
                  <select
                    value={templateForm.cultureId}
                    onChange={(e) => setTemplateForm({...templateForm, cultureId: e.target.value})}
                  >
                    <option value="">Select or type below...</option>
                    {cultureIds.map(id => (
                      <option key={id} value={id}>{id}</option>
                    ))}
                  </select>
                ) : null}
                <input
                  value={templateForm.cultureId}
                  onChange={(e) => setTemplateForm({...templateForm, cultureId: e.target.value})}
                  placeholder="Or enter custom culture ID"
                  style={{ marginTop: cultureIds.length > 0 ? '0.5rem' : '0' }}
                />
              </div>

              <div className="form-group">
                <label>Entity Type</label>
                <input
                  value={templateForm.type}
                  onChange={(e) => setTemplateForm({...templateForm, type: e.target.value})}
                  placeholder="e.g., person, location, battle, spell"
                />
                <small className="text-muted">What kind of entity are these templates for?</small>
              </div>

              <div className="form-group">
                <label>Style Description</label>
                <textarea
                  value={templateForm.style}
                  onChange={(e) => setTemplateForm({...templateForm, style: e.target.value})}
                  placeholder="e.g., elegant flowing names with nature themes, titles with honorifics"
                  rows={3}
                />
                <small className="text-muted">Describe the naming style for the LLM to match</small>
              </div>

              <div className="form-group">
                <label>Target Count</label>
                <input
                  type="number"
                  value={templateForm.targetCount}
                  onChange={(e) => setTemplateForm({...templateForm, targetCount: parseInt(e.target.value)})}
                />
                <small className="text-muted">How many templates to generate</small>
              </div>

              <div className="form-group">
                <label>Slot Hints</label>
                <small className="text-muted" style={{ display: 'block', marginBottom: '0.5rem' }}>
                  Define available slots that templates can use (e.g., ADJECTIVE, NOUN, TITLE)
                </small>

                {templateForm.slotHints.map((hint, index) => {
                  const availableLexemes = Object.keys(generatedContent || {})
                    .filter(id => !generatedContent[id].type || generatedContent[id].type === 'lexeme')
                    .sort();

                  return (
                    <div key={index} style={{
                      background: 'rgba(30, 58, 95, 0.4)',
                      padding: '1rem',
                      borderRadius: '6px',
                      marginBottom: '0.5rem',
                      border: '1px solid rgba(59, 130, 246, 0.3)'
                    }}>
                      <div className="form-grid-2">
                        <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                          <label style={{ fontSize: '0.875rem' }}>Slot Name</label>
                          {hint.kind === 'lexemeList' && availableLexemes.length > 0 ? (
                            <select
                              value={hint.name}
                              onChange={(e) => handleUpdateSlotHint(index, 'name', e.target.value)}
                            >
                              <option value="">Select a lexeme list...</option>
                              {availableLexemes.map(id => (
                                <option key={id} value={id}>{id}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              value={hint.name}
                              onChange={(e) => handleUpdateSlotHint(index, 'name', e.target.value)}
                              placeholder={
                                hint.kind === 'lexemeList' ? 'No lexeme lists available - generate some first' :
                                hint.kind === 'grammar' ? 'e.g., elven_phrase' :
                                hint.kind === 'phonotactic' ? 'e.g., elven_domain' :
                                'e.g., ADJECTIVE, NOUN, TITLE'
                              }
                            />
                          )}
                        </div>

                        <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                          <label style={{ fontSize: '0.875rem' }}>Kind</label>
                          <select
                            value={hint.kind}
                            onChange={(e) => handleUpdateSlotHint(index, 'kind', e.target.value)}
                          >
                            <option value="lexemeList">Lexeme List</option>
                            <option value="phonotactic">Phonotactic</option>
                            <option value="grammar">Grammar</option>
                            <option value="entityName">Entity Name</option>
                          </select>
                        </div>
                      </div>

                    <div className="form-group" style={{ marginBottom: '0' }}>
                      <label style={{ fontSize: '0.875rem' }}>Description</label>
                      <input
                        value={hint.description}
                        onChange={(e) => handleUpdateSlotHint(index, 'description', e.target.value)}
                        placeholder="e.g., A descriptive adjective from the elven lexeme list"
                      />
                    </div>

                    <button
                      className="danger"
                      onClick={() => handleRemoveSlotHint(index)}
                      style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}
                    >
                      Remove Slot
                    </button>
                  </div>
                );
                })}

                <button
                  className="secondary"
                  onClick={handleAddSlotHint}
                  style={{ marginTop: '0.5rem' }}
                >
                  + Add Slot Hint
                </button>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button className="primary" onClick={handleSaveTemplate}>Save</button>
                <button className="secondary" onClick={() => setEditingSpec(null)}>Cancel</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
              {/* Left column: Lists */}
              <div style={{ flex: viewingGenerated ? '0 0 45%' : '1' }}>
                <div className="item-list">
                  {templateSpecs.length === 0 ? (
                    <p className="text-muted">No template specs yet. Create specs to generate Handlebars templates via LLM.</p>
                  ) : (
                    templateSpecs.map(spec => {
                      const generated = generatedContent && generatedContent[spec.id];
                      const isGenerated = generated && generated.type === 'template';

                      return (
                        <div key={spec.id} className="list-item">
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <div>
                              <strong>{spec.id}</strong>
                              {isGenerated && (
                                <span style={{
                                  marginLeft: '0.5rem',
                                  padding: '0.125rem 0.5rem',
                                  background: 'rgba(34, 197, 94, 0.2)',
                                  border: '1px solid rgba(34, 197, 94, 0.4)',
                                  borderRadius: '4px',
                                  fontSize: '0.75rem',
                                  color: 'rgb(134, 239, 172)'
                                }}>
                                  ✓ Generated ({generated.templates?.length || 0})
                                </span>
                              )}
                              <p className="text-muted" style={{ margin: '0.25rem 0 0 0' }}>
                                {spec.type} • {spec.targetCount} templates • {spec.slotHints.length} slots
                              </p>
                              <p className="text-muted" style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem' }}>
                                {spec.style}
                              </p>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              {isGenerated && (
                                <button
                                  className="secondary"
                                  onClick={() => setViewingGenerated(spec.id)}
                                >
                                  View
                                </button>
                              )}
                              <button className="secondary" onClick={() => { setEditingSpec(`template-${spec.id}`); setTemplateForm(spec); }}>Edit</button>
                              <button className="danger" onClick={() => handleDeleteTemplate(spec.id)}>Delete</button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* All Generated Templates */}
                <div style={{ marginTop: '2rem' }}>
                  <h3 style={{ marginBottom: '1rem' }}>All Generated Templates</h3>
                  <div className="item-list">
                    {!generatedContent || Object.keys(generatedContent).filter(id => generatedContent[id].type === 'template').length === 0 ? (
                      <p className="text-muted">No generated templates yet. Go to "Generate" tab to create them.</p>
                    ) : (
                      Object.keys(generatedContent)
                        .filter(id => generatedContent[id].type === 'template')
                        .sort()
                        .map(id => {
                          const item = generatedContent[id];
                          const hasSpec = templateSpecs.some(spec => spec.id === id);

                          return (
                            <div key={id} className="list-item">
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <div>
                                  <strong>{id}</strong>
                                  {!hasSpec && (
                                    <span style={{
                                      marginLeft: '0.5rem',
                                      padding: '0.125rem 0.5rem',
                                      background: 'rgba(251, 191, 36, 0.2)',
                                      border: '1px solid rgba(251, 191, 36, 0.4)',
                                      borderRadius: '4px',
                                      fontSize: '0.75rem',
                                      color: 'rgb(253, 224, 71)'
                                    }}>
                                      No spec
                                    </span>
                                  )}
                                  <p className="text-muted" style={{ margin: '0.25rem 0 0 0' }}>
                                    {item.templates?.length || 0} templates
                                    {item.filtered > 0 && ` (${item.filtered} filtered)`}
                                    {item.tokensUsed > 0 && ` • ${item.tokensUsed} tokens`}
                                  </p>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                  <button
                                    className="secondary"
                                    onClick={() => setViewingGenerated(id)}
                                  >
                                    View
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })
                    )}
                  </div>
                </div>
              </div>

              {/* Right column: Viewer */}
              {viewingGenerated && generatedContent && generatedContent[viewingGenerated] && generatedContent[viewingGenerated].type === 'template' && (
                <div className="card" style={{ flex: '0 0 50%', position: 'sticky', top: '1rem', maxHeight: 'calc(100vh - 2rem)', overflowY: 'auto' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3>Generated: {viewingGenerated}</h3>
                    <button className="secondary" onClick={() => setViewingGenerated(null)}>Close</button>
                  </div>

                  <div className="success" style={{ marginBottom: '1rem' }}>
                    ✓ {generatedContent[viewingGenerated].templates?.length || 0} templates
                    {generatedContent[viewingGenerated].filtered > 0 && ` (${generatedContent[viewingGenerated].filtered} filtered)`}
                    {generatedContent[viewingGenerated].tokensUsed > 0 && ` • ${generatedContent[viewingGenerated].tokensUsed} tokens`}
                  </div>

                  {generatedContent[viewingGenerated].templates?.map((template, i) => (
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
        )}
        </>
      )}
    </div>
  );
}

export default SpecEditor;

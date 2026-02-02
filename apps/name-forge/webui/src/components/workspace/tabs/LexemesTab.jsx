import { useState, useMemo } from 'react';
import { NumberInput } from '@penguin-tales/shared-components';
import { LEXEME_CATEGORIES, WORD_STYLE_PRESETS } from '../../constants';
import { generateLexemesWithAnthropic } from '../../../lib/anthropicClient';
import { CopyLexemeModal } from './CopyLexemeModal';

function LexemesTab({ cultureId, cultureConfig, onLexemesChange, apiKey, allCultures }) {
  const [mode, setMode] = useState('view'); // 'view', 'create-spec', 'edit-spec', 'create-manual', 'edit-list'
  const [selectedList, setSelectedList] = useState(null);
  const [editingListId, setEditingListId] = useState(null);
  const [editingSpecId, setEditingSpecId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showCopyModal, setShowCopyModal] = useState(false);

  // Form state for spec creation
  const [specForm, setSpecForm] = useState({
    id: `${cultureId}_nouns`,
    pos: 'noun',
    style: '',
    wordStylePreset: 'none',
    wordStyle: null,
    targetCount: 30,
    maxWords: 1,
    qualityFilter: { minLength: 3, maxLength: 15 }
  });

  // Form state for manual/edit list
  const [listForm, setListForm] = useState({
    id: '',
    description: '',
    entries: '',
    source: 'manual'
  });

  // Get culture-level lexeme data
  const naming = cultureConfig?.naming || {};
  const lexemeLists = naming.lexemeLists || {};
  const lexemeSpecs = naming.lexemeSpecs || [];

  const handleSaveSpec = () => {
    const newSpec = {
      ...specForm,
      cultureId
    };
    // Don't save preset key to spec, just the wordStyle object
    delete newSpec.wordStylePreset;

    const updatedSpecs = [...lexemeSpecs.filter(s => s.id !== newSpec.id), newSpec];
    onLexemesChange(undefined, updatedSpecs);
    setMode('view');
    setEditingSpecId(null);
    setSpecForm({
      id: `${cultureId}_nouns`,
      pos: 'noun',
      style: '',
      wordStylePreset: 'none',
      wordStyle: null,
      targetCount: 30,
      maxWords: 1,
      qualityFilter: { minLength: 3, maxLength: 15 }
    });
  };

  const handleEditSpec = (spec) => {
    // Try to match wordStyle to a preset
    let matchedPreset = 'none';
    if (spec.wordStyle) {
      for (const [key, preset] of Object.entries(WORD_STYLE_PRESETS)) {
        if (preset.wordStyle && JSON.stringify(preset.wordStyle) === JSON.stringify(spec.wordStyle)) {
          matchedPreset = key;
          break;
        }
      }
      if (matchedPreset === 'none') {
        matchedPreset = 'custom'; // Has wordStyle but doesn't match any preset
      }
    }

    setSpecForm({
      id: spec.id,
      pos: spec.pos || 'noun',
      style: spec.style || '',
      wordStylePreset: matchedPreset,
      wordStyle: spec.wordStyle || null,
      targetCount: spec.targetCount || 30,
      maxWords: spec.maxWords || 1,
      qualityFilter: spec.qualityFilter || { minLength: 3, maxLength: 15 }
    });
    setEditingSpecId(spec.id);
    setMode('edit-spec');
  };

  const handleDeleteSpec = (specId) => {
    const updatedSpecs = lexemeSpecs.filter(s => s.id !== specId);
    onLexemesChange(undefined, updatedSpecs);
  };

  const handleSaveList = () => {
    if (!listForm.id.trim()) {
      setError('Please enter a list ID');
      return;
    }

    const entries = listForm.entries
      .split(/[\n,]/)
      .map(e => e.trim())
      .filter(e => e);

    if (entries.length === 0) {
      setError('Please enter at least one entry');
      return;
    }

    const newList = {
      id: listForm.id,
      description: listForm.description || (listForm.source === 'manual' ? 'Manual list' : 'Generated list'),
      entries: entries,
      source: listForm.source
    };

    const updatedLists = {
      ...lexemeLists,
      [listForm.id]: newList
    };

    onLexemesChange(updatedLists, undefined);
    setMode('view');
    setEditingListId(null);
    setListForm({ id: '', description: '', entries: '', source: 'manual' });
    setError(null);
  };

  const handleEditList = (listId) => {
    const list = lexemeLists[listId];
    if (list) {
      setListForm({
        id: list.id,
        description: list.description || '',
        entries: list.entries?.join('\n') || '',
        source: list.source || 'manual'
      });
      setEditingListId(listId);
      setMode('edit-list');
    }
  };

  const handleCreateManual = () => {
    setListForm({
      id: `${cultureId}_manual`,
      description: '',
      entries: '',
      source: 'manual'
    });
    setEditingListId(null);
    setMode('create-manual');
  };

  const handleGenerate = async (spec) => {
    if (!apiKey) {
      setError('API key required. Click "Set API Key" in the header to enter your Anthropic API key.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const entries = await generateLexemesWithAnthropic(spec, apiKey);

      const newList = {
        id: spec.id,
        description: `Generated ${spec.pos} list: ${spec.style || 'classic fantasy'}`,
        entries: entries,
        source: 'llm'
      };

      const updatedLists = {
        ...lexemeLists,
        [spec.id]: newList
      };

      onLexemesChange(updatedLists, undefined);
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
    onLexemesChange(updatedLists, undefined);
    if (selectedList === listId) setSelectedList(null);
  };

  // View mode - show existing lists and specs
  if (mode === 'view') {
    return (
      <div>
        <div className="tab-header">
          <h3>Lexeme Lists</h3>
          <div className="flex gap-sm">
            {allCultures && Object.keys(allCultures).length > 1 && (
              <button className="secondary" onClick={() => setShowCopyModal(true)}>
                Copy from...
              </button>
            )}
            <button className="primary" onClick={() => setMode('create-spec')}>
              + New Spec
            </button>
            <button className="secondary" onClick={handleCreateManual}>
              + Manual List
            </button>
          </div>
        </div>

        <p className="text-muted tab-intro">
          Lexeme lists are semantic building blocks shared across all entity types in this culture.
          {!apiKey && (
            <span className="api-key-warning">
              Set your API key in the header to enable LLM generation.
            </span>
          )}
        </p>

        {error && <div className="error mb-md">{error}</div>}

        {/* Lexeme Specs Section */}
        {lexemeSpecs.length > 0 && (
          <div className="mb-lg">
            <h4 className="mb-sm">Generation Specs ({lexemeSpecs.length})</h4>
            <div className="grid gap-sm">
              {lexemeSpecs.map(spec => {
                const hasGenerated = lexemeLists[spec.id];
                const category = LEXEME_CATEGORIES[spec.pos];
                return (
                  <div key={spec.id} className="spec-card">
                    <div>
                      <strong>{spec.id}</strong>
                      {hasGenerated && (
                        <span className="badge generated">
                          Generated ({lexemeLists[spec.id]?.entries?.length || 0})
                        </span>
                      )}
                      {spec.wordStyle && (
                        <span className="badge word-style">
                          {spec.wordStyle.etymology || 'mixed'}
                          {spec.wordStyle.syllables?.max === 1 && ' • mono'}
                        </span>
                      )}
                      <div className="spec-card-meta">
                        {category?.label || spec.pos} • {spec.targetCount} entries
                        {spec.maxWords > 1 && ` • up to ${spec.maxWords} words each`}
                        {spec.style && ` • ${spec.style.substring(0, 40)}${spec.style.length > 40 ? '...' : ''}`}
                      </div>
                    </div>
                    <div className="flex gap-sm">
                      {hasGenerated && (
                        <button className="secondary sm" onClick={() => setSelectedList(spec.id)}>
                          View
                        </button>
                      )}
                      <button className="secondary sm" onClick={() => handleEditSpec(spec)}>
                        Edit
                      </button>
                      <button
                        className="primary sm"
                        onClick={() => handleGenerate(spec)}
                        disabled={loading}
                      >
                        {loading ? '...' : hasGenerated ? 'Regenerate' : 'Generate'}
                      </button>
                      <button className="danger sm" onClick={() => handleDeleteSpec(spec.id)}>
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
        <div className="split-layout">
          <div className={`split-layout-main ${selectedList ? 'has-sidebar' : ''}`}>
            <h4 className="mb-sm">Lexeme Lists ({Object.keys(lexemeLists).length})</h4>

            {Object.keys(lexemeLists).length === 0 ? (
              <div className="empty-state-card">
                <p>No lexeme lists yet.</p>
                <p className="text-muted mt-sm">
                  Create a spec and generate via LLM, or add a manual list.
                </p>
              </div>
            ) : (
              <div className="grid gap-sm">
                {Object.entries(lexemeLists).map(([listId, list]) => {
                  const isSelected = selectedList === listId;

                  return (
                    <div
                      key={listId}
                      className={`list-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => setSelectedList(listId)}
                    >
                      <div className="list-item-header">
                        <div>
                          <strong>{listId}</strong>
                          <span className={`badge ${list.source === 'manual' ? 'manual' : 'llm'}`}>
                            {list.source === 'manual' ? 'Manual' : 'LLM'}
                          </span>
                          <div className="list-item-meta">{list.entries?.length || 0} entries</div>
                        </div>
                        <div className="flex gap-sm">
                          <button
                            className="secondary sm"
                            onClick={(e) => { e.stopPropagation(); handleEditList(listId); }}
                          >
                            Edit
                          </button>
                          <button
                            className="danger sm"
                            onClick={(e) => { e.stopPropagation(); handleDeleteList(listId); }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Selected List Viewer */}
          {selectedList && lexemeLists[selectedList] && (
            <div className="list-viewer">
              <div className="list-viewer-header">
                <h4>{selectedList}</h4>
                <div className="flex gap-sm">
                  <button className="secondary sm" onClick={() => handleEditList(selectedList)}>Edit</button>
                  <button className="secondary sm" onClick={() => setSelectedList(null)}>Close</button>
                </div>
              </div>

              {lexemeLists[selectedList].description && (
                <p className="text-muted mb-md">{lexemeLists[selectedList].description}</p>
              )}

              <div className="list-viewer-content">
                {lexemeLists[selectedList].entries?.join('\n')}
              </div>
            </div>
          )}
        </div>

        {showCopyModal && (
          <CopyLexemeModal
            cultureId={cultureId}
            allCultures={allCultures}
            existingListIds={Object.keys(lexemeLists)}
            onCopy={(copiedLists) => {
              const updatedLists = { ...lexemeLists, ...copiedLists };
              onLexemesChange(updatedLists, undefined);
              setShowCopyModal(false);
            }}
            onClose={() => setShowCopyModal(false)}
          />
        )}
      </div>
    );
  }

  // Create/Edit Spec Mode
  if (mode === 'create-spec' || mode === 'edit-spec') {
    const isEditing = mode === 'edit-spec';
    return (
      <div>
        <div className="tab-header">
          <h3>{isEditing ? 'Edit Lexeme Spec' : 'New Lexeme Spec'}</h3>
          <div className="flex gap-sm">
            <button className="primary" onClick={handleSaveSpec}>Save</button>
            <button className="secondary" onClick={() => { setMode('view'); setEditingSpecId(null); }}>Cancel</button>
          </div>
        </div>

        <p className="text-muted tab-intro">
          Define what kind of semantic building blocks to generate. These will be combined via grammar rules into names.
        </p>

        {error && <div className="error mb-md">{error}</div>}

        <div className="form-group">
          <label>Spec ID</label>
          <input
            value={specForm.id}
            onChange={(e) => setSpecForm({ ...specForm, id: e.target.value })}
            placeholder={`${cultureId}_nouns`}
            disabled={isEditing}
          />
          <small className="text-muted">Unique identifier for this spec. Use with <code>slot:{specForm.id || 'id'}</code> in grammars.</small>
        </div>

        <div className="form-grid-2">
          <div className="form-group">
            <label>Category</label>
            <select
              value={specForm.pos}
              onChange={(e) => setSpecForm({ ...specForm, pos: e.target.value })}
            >
              <optgroup label="Grammatical">
                {['noun', 'verb', 'adjective', 'abstract', 'core'].map(key => (
                  <option key={key} value={key}>{LEXEME_CATEGORIES[key].label}</option>
                ))}
              </optgroup>
              <optgroup label="Name Components">
                {['title', 'epithet', 'prefix', 'suffix', 'connector'].map(key => (
                  <option key={key} value={key}>{LEXEME_CATEGORIES[key].label}</option>
                ))}
              </optgroup>
              <optgroup label="Semantic">
                {['place', 'creature', 'element', 'material', 'celestial', 'color', 'kinship', 'occupation', 'virtue', 'vice', 'number'].map(key => (
                  <option key={key} value={key}>{LEXEME_CATEGORIES[key].label}</option>
                ))}
              </optgroup>
              <optgroup label="Organizations">
                {['collective', 'organization'].map(key => (
                  <option key={key} value={key}>{LEXEME_CATEGORIES[key].label}</option>
                ))}
              </optgroup>
            </select>
            <small className="text-muted">{LEXEME_CATEGORIES[specForm.pos]?.desc}</small>
          </div>

          <div className="form-group">
            <label>Word Style Preset</label>
            <select
              value={specForm.wordStylePreset}
              onChange={(e) => {
                const presetKey = e.target.value;
                const preset = WORD_STYLE_PRESETS[presetKey];
                setSpecForm({
                  ...specForm,
                  wordStylePreset: presetKey,
                  wordStyle: preset?.wordStyle || null
                });
              }}
            >
              {Object.entries(WORD_STYLE_PRESETS).map(([key, preset]) => (
                <option key={key} value={key}>{preset.label}</option>
              ))}
              {specForm.wordStylePreset === 'custom' && (
                <option value="custom">Custom (edited)</option>
              )}
            </select>
            <small className="text-muted">
              {WORD_STYLE_PRESETS[specForm.wordStylePreset]?.description || 'Structural constraints for word generation'}
            </small>
          </div>

          <div className="form-group">
            <label>Target Count</label>
            <NumberInput
              value={specForm.targetCount}
              onChange={(v) => setSpecForm({ ...specForm, targetCount: v ?? 30 })}
              integer
            />
          </div>

          <div className="form-group">
            <label>Max Words per Entry</label>
            <NumberInput
              value={specForm.maxWords}
              onChange={(v) => setSpecForm({ ...specForm, maxWords: v ?? 1 })}
              integer
              min={1}
            />
            <small className="text-muted">
              Allow short phrases (e.g., "hunting grounds"). Entries stay capped at this word count.
            </small>
          </div>
        </div>

        <div className="form-group">
          <label>Style Description</label>
          <textarea
            value={specForm.style}
            onChange={(e) => setSpecForm({ ...specForm, style: e.target.value })}
            placeholder="e.g., Norse-inspired, dark and brooding, elegant elvish, gritty medieval"
            rows={3}
          />
          <small className="text-muted">
            Describe the feel/theme. This guides the LLM to generate culturally appropriate words.
          </small>
        </div>

        <div className="form-grid-2">
          <div className="form-group">
            <label>Min Length</label>
            <NumberInput
              value={specForm.qualityFilter.minLength}
              onChange={(v) => setSpecForm({
                ...specForm,
                qualityFilter: { ...specForm.qualityFilter, minLength: v ?? 3 }
              })}
              integer
            />
          </div>
          <div className="form-group">
            <label>Max Length</label>
            <NumberInput
              value={specForm.qualityFilter.maxLength}
              onChange={(v) => setSpecForm({
                ...specForm,
                qualityFilter: { ...specForm.qualityFilter, maxLength: v ?? 15 }
              })}
              integer
            />
          </div>
        </div>

      </div>
    );
  }

  // Create Manual / Edit List Mode
  if (mode === 'create-manual' || mode === 'edit-list') {
    const isEditing = mode === 'edit-list';
    return (
      <div>
        <div className="tab-header">
          <h3>{isEditing ? 'Edit List' : 'Create Manual List'}</h3>
          <div className="flex gap-sm">
            <button className="primary" onClick={handleSaveList}>Save</button>
            <button className="secondary" onClick={() => { setMode('view'); setEditingListId(null); }}>Cancel</button>
          </div>
        </div>

        <p className="text-muted tab-intro">
          {isEditing
            ? 'Edit the entries in this lexeme list. One entry per line.'
            : 'Manually create a lexeme list. Perfect for titles, connectors, and culture-specific terms.'}
        </p>

        {error && <div className="error mb-md">{error}</div>}

        <div className="form-group">
          <label>List ID</label>
          <input
            value={listForm.id}
            onChange={(e) => setListForm({ ...listForm, id: e.target.value })}
            placeholder={`${cultureId}_titles`}
            disabled={isEditing}
          />
          <small className="text-muted">Use this ID with <code>slot:{listForm.id || 'list_id'}</code> in grammars</small>
        </div>

        <div className="form-group">
          <label>Description (optional)</label>
          <input
            value={listForm.description}
            onChange={(e) => setListForm({ ...listForm, description: e.target.value })}
            placeholder="e.g., Noble titles and honorifics"
          />
        </div>

        <div className="form-group">
          <label>Entries ({listForm.entries.split(/[\n,]/).filter(e => e.trim()).length} items)</label>
          <textarea
            value={listForm.entries}
            onChange={(e) => setListForm({ ...listForm, entries: e.target.value })}
            placeholder={`Enter one per line:\nLord\nLady\nSir\nMaster\nElder`}
            rows={12}
            className="font-mono"
          />
          <small className="text-muted">
            One entry per line, or comma-separated. Empty lines are ignored.
          </small>
        </div>
      </div>
    );
  }

  return null;
}

export default LexemesTab;

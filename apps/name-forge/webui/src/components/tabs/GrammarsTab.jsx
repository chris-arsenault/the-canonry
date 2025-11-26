import { useState, useEffect, useRef } from 'react';
import { MARKOV_MODELS, CONTEXT_KEYS, COMMON_LITERALS } from '../constants';
import { getEffectiveDomain, getAvailableLexemeLists } from '../utils';

function GrammarsTab({ entityConfig, onConfigChange, cultureId, entityKind, cultureConfig, allCultures, worldSchema }) {
  const [mode, setMode] = useState('view');
  const [editingGrammar, setEditingGrammar] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const [formData, setFormData] = useState({
    id: `${cultureId}_${entityKind}_grammar`,
    start: 'name',
    rules: {},
    appliesTo: { cultures: [cultureId], entityKinds: [entityKind] }
  });
  const [newRuleKey, setNewRuleKey] = useState('');
  const [newRuleValue, setNewRuleValue] = useState('');

  // Autosave refs
  const autosaveTimeoutRef = useRef(null);
  const lastSavedFormDataRef = useRef(null);

  const grammars = entityConfig?.grammars || [];

  // Autosave effect - debounced save when formData changes in edit mode
  useEffect(() => {
    if (mode !== 'edit' || !editingGrammar) return;

    const formDataStr = JSON.stringify(formData);
    if (formDataStr === lastSavedFormDataRef.current) return;

    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
    }

    autosaveTimeoutRef.current = setTimeout(() => {
      if (!formData.id.trim()) return;

      const newGrammars = editingGrammar === 'new'
        ? [...grammars.filter(g => g.id !== formData.id), formData]
        : grammars.map(g => g.id === formData.id ? formData : g);

      onConfigChange({
        ...entityConfig,
        grammars: newGrammars,
        completionStatus: {
          ...entityConfig?.completionStatus,
          grammars: newGrammars.length
        }
      });

      lastSavedFormDataRef.current = formDataStr;
    }, 1000);

    return () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }
    };
  }, [formData, mode, editingGrammar]);

  // Reset autosave ref when switching modes
  useEffect(() => {
    if (mode === 'view') {
      lastSavedFormDataRef.current = null;
    }
  }, [mode]);

  // Get all cultures and entity kinds for sharing options
  const allCultureIds = Object.keys(allCultures || {});
  const allEntityKinds = worldSchema?.hardState?.map(e => e.kind) || [];

  const effectiveDomain = getEffectiveDomain(cultureConfig);

  // Get available lexeme lists (local and shared)
  const availableLexemeLists = getAvailableLexemeLists(entityConfig, cultureConfig, cultureId, entityKind);

  const handleAddRule = () => {
    if (!newRuleKey.trim() || !newRuleValue.trim()) return;

    const newProductions = newRuleValue.split('|').map(p =>
      p.trim().split(/\s+/).filter(s => s)
    ).filter(p => p.length > 0);

    // If rule already exists, merge productions (add as alternatives)
    const existingProductions = formData.rules[newRuleKey] || [];
    const mergedProductions = [...existingProductions, ...newProductions];

    setFormData({
      ...formData,
      rules: {
        ...formData.rules,
        [newRuleKey]: mergedProductions
      }
    });
    setNewRuleKey('');
    setNewRuleValue('');
  };

  const handleDeleteRule = (key) => {
    const newRules = { ...formData.rules };
    delete newRules[key];
    setFormData({ ...formData, rules: newRules });
  };

  const handleSave = () => {
    if (!formData.id.trim()) return;

    const newGrammars = editingGrammar === 'new'
      ? [...grammars, formData]
      : grammars.map(g => g.id === formData.id ? formData : g);

    onConfigChange({
      ...entityConfig,
      grammars: newGrammars,
      completionStatus: {
        ...entityConfig?.completionStatus,
        grammars: newGrammars.length
      }
    });

    setMode('view');
    setEditingGrammar(null);
  };

  const handleDelete = (id) => {
    const newGrammars = grammars.filter(g => g.id !== id);
    onConfigChange({
      ...entityConfig,
      grammars: newGrammars,
      completionStatus: {
        ...entityConfig?.completionStatus,
        grammars: newGrammars.length
      }
    });
  };

  const handleEdit = (grammar) => {
    setEditingGrammar(grammar.id);
    setFormData(grammar);
    setMode('edit');
  };

  const handleAddNew = () => {
    setEditingGrammar('new');
    setFormData({
      id: `${cultureId}_${entityKind}_grammar`,
      start: 'name',
      rules: {},
      appliesTo: { cultures: [cultureId], entityKinds: [entityKind] }
    });
    setMode('edit');
  };

  const insertIntoRule = (text) => {
    setNewRuleValue(prev => prev ? `${prev} ${text}` : text);
  };

  // View mode
  if (mode === 'view') {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0 }}>Context-Free Grammars</h3>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="secondary" onClick={() => setShowHelp(true)}>? Help</button>
            <button className="primary" onClick={handleAddNew}>+ New Grammar</button>
          </div>
        </div>

        <p className="text-muted" style={{ marginBottom: '1rem' }}>
          Define grammar rules that reference lexeme lists using <code>slot:lexeme_id</code> syntax.
          Grammars provide structured name patterns with variable content.
        </p>

        {grammars.length === 0 ? (
          <div style={{
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '6px',
            padding: '1.5rem',
            textAlign: 'center'
          }}>
            <p style={{ margin: 0 }}>No grammars yet.</p>
            <p className="text-muted" style={{ marginTop: '0.5rem' }}>
              Create lexeme lists first, then define grammars to structure names.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {grammars.map((grammar) => {
              const isShared = grammar.appliesTo?.cultures?.includes('*') ||
                grammar.appliesTo?.entityKinds?.includes('*') ||
                (grammar.appliesTo?.cultures?.length > 1) ||
                (grammar.appliesTo?.entityKinds?.length > 1);

              return (
                <div
                  key={grammar.id}
                  style={{
                    background: isShared ? 'rgba(147, 51, 234, 0.15)' : 'rgba(30, 58, 95, 0.3)',
                    padding: '0.75rem 1rem',
                    borderRadius: '6px',
                    border: isShared ? '1px solid rgba(147, 51, 234, 0.3)' : '1px solid rgba(59, 130, 246, 0.3)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <strong>{grammar.id}</strong>
                      {isShared && (
                        <span style={{
                          marginLeft: '0.5rem',
                          padding: '0.125rem 0.5rem',
                          background: 'rgba(147, 51, 234, 0.3)',
                          color: 'rgb(192, 132, 252)',
                          borderRadius: '4px',
                          fontSize: '0.7rem'
                        }}>
                          SHARED
                        </span>
                      )}
                      <div style={{ fontSize: '0.875rem', color: 'var(--arctic-frost)', marginTop: '0.25rem' }}>
                        Start: <code>{grammar.start}</code> • {Object.keys(grammar.rules || {}).length} rules
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="secondary" style={{ fontSize: '0.875rem' }} onClick={() => handleEdit(grammar)}>
                        Edit
                      </button>
                      <button className="danger" style={{ fontSize: '0.875rem' }} onClick={() => handleDelete(grammar.id)}>
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Help Modal */}
        {showHelp && (
          <GrammarHelpModal onClose={() => setShowHelp(false)} />
        )}
      </div>
    );
  }

  // Edit mode
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0 }}>{editingGrammar === 'new' ? 'New Grammar' : 'Edit Grammar'}</h3>
      </div>

      <div className="form-group">
        <label>Grammar ID</label>
        <input
          value={formData.id}
          onChange={(e) => setFormData({ ...formData, id: e.target.value })}
          placeholder={`${cultureId}_${entityKind}_grammar`}
        />
      </div>

      <div className="form-group">
        <label>Start Symbol</label>
        <input
          value={formData.start}
          onChange={(e) => setFormData({ ...formData, start: e.target.value })}
          placeholder="e.g., name, phrase, title"
        />
        <small className="text-muted">The entry point for name generation</small>
      </div>

      <h4 style={{ marginTop: '1.5rem', marginBottom: '0.75rem' }}>Production Rules</h4>

      {/* Click-to-insert: Lexeme Lists */}
      {availableLexemeLists.length > 0 && (
        <ClickToInsertSection
          title="Lexeme Lists"
          items={availableLexemeLists.map(({ id, source }) => ({
            code: `slot:${id}`,
            title: source !== 'local' ? `From ${source}` : 'Local list'
          }))}
          onInsert={insertIntoRule}
          background="rgba(59, 130, 246, 0.15)"
          borderColor="rgba(59, 130, 246, 0.3)"
          textColor="var(--gold-accent)"
        />
      )}

      {/* Click-to-insert: Domain Phonology */}
      {effectiveDomain && (
        <DomainInsertSection
          effectiveDomain={effectiveDomain}
          onInsert={insertIntoRule}
        />
      )}

      {/* Click-to-insert: Markov Chain Models */}
      <ClickToInsertSection
        title="Markov Chain Models"
        subtitle="(click to insert - statistically-generated names)"
        items={MARKOV_MODELS.map(({ id, name, desc }) => ({
          code: `markov:${id}`,
          title: `${name}: ${desc}`
        }))}
        onInsert={insertIntoRule}
        background="rgba(168, 85, 247, 0.15)"
        borderColor="rgba(168, 85, 247, 0.4)"
        textColor="#c084fc"
        description="Generates names trained on real-world language patterns"
      />

      {/* Entity Linkage - Context References */}
      <EntityLinkageSection onInsert={insertIntoRule} />

      {/* Common literals */}
      <ClickToInsertSection
        title="Common Literals"
        items={COMMON_LITERALS.map(lit => ({ code: lit, title: lit }))}
        onInsert={insertIntoRule}
        background="rgba(30, 58, 95, 0.3)"
        borderColor="rgba(59, 130, 246, 0.2)"
        textColor="var(--arctic-frost)"
      />

      {/* Add rule form */}
      <div style={{
        background: 'rgba(30, 58, 95, 0.4)',
        padding: '1rem',
        borderRadius: '6px',
        marginBottom: '1rem',
        border: '1px solid rgba(59, 130, 246, 0.3)'
      }}>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <input
            style={{ flex: '0 0 120px' }}
            value={newRuleKey}
            onChange={(e) => setNewRuleKey(e.target.value)}
            placeholder="Non-terminal"
          />
          <span style={{ alignSelf: 'center', color: 'var(--arctic-frost)' }}>→</span>
          <input
            style={{ flex: 1 }}
            value={newRuleValue}
            onChange={(e) => setNewRuleValue(e.target.value)}
            placeholder="slot:lexeme_id | literal | other_nonterminal"
          />
          <button className="primary" onClick={handleAddRule}>Add</button>
        </div>
        <small className="text-muted">
          Use <code>|</code> for alternatives, <code>space</code> for sequence
        </small>
      </div>

      {/* Current rules */}
      {Object.keys(formData.rules).length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ marginBottom: '0.5rem' }}>Current Rules</h4>
          {Object.entries(formData.rules).map(([key, productions]) => (
            <div
              key={key}
              style={{
                padding: '0.75rem',
                background: 'rgba(30, 58, 95, 0.4)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: '4px',
                marginBottom: '0.5rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                <strong style={{ color: 'var(--gold-accent)' }}>{key}</strong>
                <span style={{ color: 'var(--arctic-frost)' }}> → </span>
                {productions.map((prod, i) => (
                  <span key={i}>
                    <span style={{ color: 'var(--arctic-light)' }}>{prod.join(' ')}</span>
                    {i < productions.length - 1 && <span style={{ color: 'var(--arctic-frost)' }}> | </span>}
                  </span>
                ))}
              </div>
              <button
                className="danger"
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                onClick={() => handleDeleteRule(key)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Sharing Options */}
      <GrammarSharingOptions
        formData={formData}
        setFormData={setFormData}
        allCultureIds={allCultureIds}
        allEntityKinds={allEntityKinds}
        cultureId={cultureId}
        entityKind={entityKind}
      />

      <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
        <button className="primary" onClick={handleSave}>Save Grammar</button>
        <button className="secondary" onClick={() => { setMode('view'); setEditingGrammar(null); }}>Cancel</button>
      </div>
    </div>
  );
}

// Helper component for click-to-insert sections
function ClickToInsertSection({ title, subtitle, items, onInsert, background, borderColor, textColor, description }) {
  return (
    <div style={{
      background,
      padding: '0.75rem',
      borderRadius: '6px',
      marginBottom: '1rem',
      border: `1px solid ${borderColor}`
    }}>
      <div style={{ fontSize: '0.75rem', color: textColor, marginBottom: '0.5rem' }}>
        <strong>{title}</strong> {subtitle && <span style={{ color: 'var(--arctic-frost)' }}>{subtitle}</span>}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        {items.map(({ code, title: itemTitle }) => (
          <code
            key={code}
            style={{
              background: 'rgba(10, 25, 41, 0.8)',
              padding: '0.25rem 0.5rem',
              borderRadius: '4px',
              color: textColor,
              cursor: 'pointer',
              fontSize: '0.75rem',
              border: `1px solid ${borderColor}`
            }}
            onClick={() => onInsert(code)}
            title={itemTitle}
          >
            {code}
          </code>
        ))}
      </div>
      {description && (
        <div style={{ fontSize: '0.65rem', color: 'var(--arctic-frost)', marginTop: '0.5rem' }}>
          {description}
        </div>
      )}
    </div>
  );
}

// Domain insert section with prefixes/suffixes/endings
function DomainInsertSection({ effectiveDomain, onInsert }) {
  return (
    <div style={{
      background: 'rgba(147, 51, 234, 0.15)',
      padding: '0.75rem',
      borderRadius: '6px',
      marginBottom: '1rem',
      border: '1px solid rgba(147, 51, 234, 0.3)'
    }}>
      <div style={{ fontSize: '0.75rem', color: 'rgb(192, 132, 252)', marginBottom: '0.5rem' }}>
        <strong>Domain: {effectiveDomain.id}</strong>
      </div>

      {/* Phonotactic generation */}
      <div style={{ marginBottom: '0.5rem' }}>
        <code
          style={{
            background: 'rgba(10, 25, 41, 0.8)',
            padding: '0.25rem 0.5rem',
            borderRadius: '4px',
            color: 'var(--gold-accent)',
            cursor: 'pointer',
            fontSize: '0.75rem',
            border: '1px solid rgba(147, 51, 234, 0.5)'
          }}
          onClick={() => onInsert(`domain:${effectiveDomain.id}`)}
          title="Generate phonotactic name from this domain"
        >
          domain:{effectiveDomain.id}
        </code>
        <span style={{ fontSize: '0.7rem', color: 'var(--arctic-frost)', marginLeft: '0.5rem' }}>
          (generates names like "Zixtrexrtra")
        </span>
      </div>

      {effectiveDomain.morphology?.prefixes?.length > 0 && (
        <div style={{ marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--arctic-frost)' }}>Prefixes: </span>
          {effectiveDomain.morphology.prefixes.slice(0, 8).map((p, i) => (
            <code
              key={i}
              style={{
                background: 'rgba(10, 25, 41, 0.8)',
                padding: '0.125rem 0.375rem',
                borderRadius: '3px',
                color: 'rgb(192, 132, 252)',
                cursor: 'pointer',
                fontSize: '0.7rem',
                marginRight: '0.25rem'
              }}
              onClick={() => onInsert(p)}
            >
              {p}
            </code>
          ))}
        </div>
      )}

      {effectiveDomain.morphology?.suffixes?.length > 0 && (
        <div style={{ marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--arctic-frost)' }}>Suffixes: </span>
          {effectiveDomain.morphology.suffixes.slice(0, 8).map((s, i) => (
            <code
              key={i}
              style={{
                background: 'rgba(10, 25, 41, 0.8)',
                padding: '0.125rem 0.375rem',
                borderRadius: '3px',
                color: 'rgb(192, 132, 252)',
                cursor: 'pointer',
                fontSize: '0.7rem',
                marginRight: '0.25rem'
              }}
              onClick={() => onInsert(s)}
            >
              {s}
            </code>
          ))}
        </div>
      )}

      {effectiveDomain.style?.preferredEndings?.length > 0 && (
        <div>
          <span style={{ fontSize: '0.7rem', color: 'var(--arctic-frost)' }}>Endings: </span>
          {effectiveDomain.style.preferredEndings.slice(0, 8).map((e, i) => (
            <code
              key={i}
              style={{
                background: 'rgba(10, 25, 41, 0.8)',
                padding: '0.125rem 0.375rem',
                borderRadius: '3px',
                color: 'rgb(192, 132, 252)',
                cursor: 'pointer',
                fontSize: '0.7rem',
                marginRight: '0.25rem'
              }}
              onClick={() => onInsert(e)}
            >
              {e}
            </code>
          ))}
        </div>
      )}
    </div>
  );
}

// Entity linkage section
function EntityLinkageSection({ onInsert }) {
  return (
    <div style={{
      background: 'rgba(34, 197, 94, 0.15)',
      padding: '0.75rem',
      borderRadius: '6px',
      marginBottom: '1rem',
      border: '1px solid rgba(34, 197, 94, 0.3)'
    }}>
      <div style={{ fontSize: '0.75rem', color: 'rgb(134, 239, 172)', marginBottom: '0.5rem' }}>
        <strong>Entity Linkage</strong> (click to insert - uses related entity names from KG relationships)
      </div>
      <div style={{ fontSize: '0.65rem', color: 'var(--arctic-frost)', marginBottom: '0.5rem' }}>
        NPC Relations:
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
        {CONTEXT_KEYS.npcRelations.map(({ key, desc }) => (
          <code
            key={key}
            style={{
              background: 'rgba(10, 25, 41, 0.8)',
              padding: '0.25rem 0.5rem',
              borderRadius: '4px',
              color: 'rgb(134, 239, 172)',
              cursor: 'pointer',
              fontSize: '0.75rem',
              border: '1px solid rgba(34, 197, 94, 0.4)'
            }}
            onClick={() => onInsert(`context:${key}`)}
            title={desc}
          >
            context:{key}
          </code>
        ))}
      </div>
      <div style={{ fontSize: '0.65rem', color: 'var(--arctic-frost)', marginBottom: '0.5rem' }}>
        Location/Faction Relations:
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        {CONTEXT_KEYS.locationFactionRelations.map(({ key, desc }) => (
          <code
            key={key}
            style={{
              background: 'rgba(10, 25, 41, 0.8)',
              padding: '0.25rem 0.5rem',
              borderRadius: '4px',
              color: 'rgb(134, 239, 172)',
              cursor: 'pointer',
              fontSize: '0.75rem',
              border: '1px solid rgba(34, 197, 94, 0.4)'
            }}
            onClick={() => onInsert(`context:${key}`)}
            title={desc}
          >
            context:{key}
          </code>
        ))}
      </div>
      <div style={{ fontSize: '0.65rem', color: 'var(--arctic-frost)', marginTop: '0.5rem' }}>
        Use with possessives: <code style={{ color: 'rgb(134, 239, 172)' }}>context:leader^'s slot:nouns</code> → "Zixtrex's Fortress"
      </div>
    </div>
  );
}

// Grammar sharing options
function GrammarSharingOptions({ formData, setFormData, allCultureIds, allEntityKinds, cultureId, entityKind }) {
  return (
    <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(147, 51, 234, 0.1)', borderRadius: '6px', border: '1px solid rgba(147, 51, 234, 0.3)' }}>
      <h4 style={{ margin: '0 0 0.75rem 0', color: 'rgb(192, 132, 252)' }}>Sharing Options</h4>

      <div className="form-group" style={{ marginBottom: '1rem' }}>
        <label style={{ fontSize: '0.875rem' }}>Share with Cultures</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.25rem' }}>
          <button
            type="button"
            onClick={() => setFormData({
              ...formData,
              appliesTo: { ...formData.appliesTo, cultures: ['*'] }
            })}
            style={{
              padding: '0.25rem 0.75rem',
              borderRadius: '4px',
              border: '1px solid',
              borderColor: formData.appliesTo?.cultures?.includes('*') ? 'rgb(192, 132, 252)' : 'var(--border-color)',
              background: formData.appliesTo?.cultures?.includes('*') ? 'rgba(147, 51, 234, 0.2)' : 'transparent',
              color: formData.appliesTo?.cultures?.includes('*') ? 'rgb(192, 132, 252)' : 'var(--text-color)',
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
                const current = formData.appliesTo?.cultures || [];
                const filtered = current.filter(c => c !== '*');
                const newCultures = filtered.includes(cultId)
                  ? filtered.filter(c => c !== cultId)
                  : [...filtered, cultId];
                setFormData({
                  ...formData,
                  appliesTo: { ...formData.appliesTo, cultures: newCultures.length ? newCultures : [cultureId] }
                });
              }}
              style={{
                padding: '0.25rem 0.75rem',
                borderRadius: '4px',
                border: '1px solid',
                borderColor: formData.appliesTo?.cultures?.includes(cultId) && !formData.appliesTo?.cultures?.includes('*') ? 'var(--gold-accent)' : 'var(--border-color)',
                background: formData.appliesTo?.cultures?.includes(cultId) && !formData.appliesTo?.cultures?.includes('*') ? 'rgba(212, 175, 55, 0.2)' : 'transparent',
                color: formData.appliesTo?.cultures?.includes(cultId) && !formData.appliesTo?.cultures?.includes('*') ? 'var(--gold-accent)' : 'var(--text-color)',
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
            onClick={() => setFormData({
              ...formData,
              appliesTo: { ...formData.appliesTo, entityKinds: ['*'] }
            })}
            style={{
              padding: '0.25rem 0.75rem',
              borderRadius: '4px',
              border: '1px solid',
              borderColor: formData.appliesTo?.entityKinds?.includes('*') ? 'rgb(192, 132, 252)' : 'var(--border-color)',
              background: formData.appliesTo?.entityKinds?.includes('*') ? 'rgba(147, 51, 234, 0.2)' : 'transparent',
              color: formData.appliesTo?.entityKinds?.includes('*') ? 'rgb(192, 132, 252)' : 'var(--text-color)',
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
                const current = formData.appliesTo?.entityKinds || [];
                const filtered = current.filter(k => k !== '*');
                const newKinds = filtered.includes(kind)
                  ? filtered.filter(k => k !== kind)
                  : [...filtered, kind];
                setFormData({
                  ...formData,
                  appliesTo: { ...formData.appliesTo, entityKinds: newKinds.length ? newKinds : [entityKind] }
                });
              }}
              style={{
                padding: '0.25rem 0.75rem',
                borderRadius: '4px',
                border: '1px solid',
                borderColor: formData.appliesTo?.entityKinds?.includes(kind) && !formData.appliesTo?.entityKinds?.includes('*') ? 'var(--gold-accent)' : 'var(--border-color)',
                background: formData.appliesTo?.entityKinds?.includes(kind) && !formData.appliesTo?.entityKinds?.includes('*') ? 'rgba(212, 175, 55, 0.2)' : 'transparent',
                color: formData.appliesTo?.entityKinds?.includes(kind) && !formData.appliesTo?.entityKinds?.includes('*') ? 'var(--gold-accent)' : 'var(--text-color)',
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

// Grammar help modal
function GrammarHelpModal({ onClose }) {
  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '2rem'
    }} onClick={onClose}>
      <div style={{
        background: 'var(--arctic-dark)',
        borderRadius: '8px',
        padding: '2rem',
        maxWidth: '700px',
        maxHeight: '80vh',
        overflowY: 'auto',
        border: '2px solid var(--arctic-ice)'
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0 }}>Context-Free Grammars</h3>
          <button className="secondary" onClick={onClose}>Close</button>
        </div>

        <div style={{ lineHeight: '1.6' }}>
          <p>CFGs define structured patterns for name generation. They combine fixed structure with variable content from lexeme lists.</p>

          <h4>Example Grammar</h4>
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '4px', fontFamily: 'monospace', fontSize: '0.875rem' }}>
            <div>Start: <strong>name</strong></div>
            <div style={{ marginTop: '0.5rem' }}>
              <div>name → adj - noun</div>
              <div>adj → slot:adjectives</div>
              <div>noun → slot:nouns</div>
            </div>
          </div>
          <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
            Generates names like: "Swift-Scale", "Dark-Fang", "Silent-Shadow"
          </p>

          <h4>Syntax</h4>
          <ul style={{ fontSize: '0.875rem' }}>
            <li><code>slot:lexeme_id</code> - Pull from a lexeme list</li>
            <li><code>domain:domain_id</code> - Generate phonotactic name from a domain</li>
            <li><code>context:key</code> - Use a related entity's name (owner, founder, ruler, etc.)</li>
            <li><code>^suffix</code> - Terminator with literal suffix (e.g., <code>domain:id^'s</code> → "Zixtrex's")</li>
            <li><code>|</code> - Alternatives (random choice)</li>
            <li><code>space</code> - Sequence (concatenate with space)</li>
            <li>Literal text - Use as-is (e.g., "of", "the", "-")</li>
          </ul>

          <h4>Entity Linkage (Named Entity Propagation)</h4>
          <div style={{ background: 'rgba(34, 197, 94, 0.2)', padding: '1rem', borderRadius: '4px', fontFamily: 'monospace', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
            <div style={{ color: 'var(--arctic-frost)' }}>// Location named after leader:</div>
            <div>name → context:leader^'s slot:location_types</div>
            <div style={{ marginTop: '0.5rem', color: 'var(--arctic-frost)' }}>// Faction HQ named after origin:</div>
            <div>name → slot:titles of context:origin</div>
          </div>
          <p style={{ fontSize: '0.875rem' }}>
            Generates: "Zixtrex's Fortress", "Guild of Aurora Stack"
          </p>
          <p style={{ fontSize: '0.8rem', color: 'var(--arctic-frost)' }}>
            Context keys map to KG relationships: <code>leader</code>, <code>founder</code>, <code>discoverer</code>, <code>mentor</code>, <code>location</code>, <code>faction</code>, <code>birthplace</code>, <code>stronghold</code>
          </p>

          <h4>Mixing Lexemes with Phonotactic</h4>
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '4px', fontFamily: 'monospace', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
            <div>name → slot:titles domain:elven_domain</div>
            <div style={{ marginTop: '0.5rem', color: 'var(--arctic-frost)' }}>// With suffix:</div>
            <div>possessive → domain:tech_domain^'s slot:nouns</div>
          </div>
          <p style={{ fontSize: '0.875rem' }}>
            Generates: "Duke Zixtrexrtra", "Valamorn's fortress"
          </p>

          <h4>Tips</h4>
          <ul style={{ fontSize: '0.875rem' }}>
            <li>Start simple: adj-noun patterns work well</li>
            <li>Use descriptive rule names (adj, noun, title)</li>
            <li>Mix <code>slot:</code> and <code>domain:</code> for "Duke Zixtrexrtra" style names</li>
            <li>Use <code>context:</code> for entity-linked names like "Zixtrex's Oasis"</li>
            <li>Use <code>^</code> to attach suffixes: <code>context:owner^'s</code> → "Zixtrex's"</li>
            <li>Create focused lexeme lists for each role</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default GrammarsTab;

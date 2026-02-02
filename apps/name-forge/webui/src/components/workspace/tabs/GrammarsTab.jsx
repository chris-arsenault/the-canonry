import { useState, useEffect, useRef } from 'react';
import { MARKOV_MODELS, CONTEXT_KEYS, COMMON_LITERALS, GRAMMAR_MODIFIERS } from '../../constants';
import { previewGrammarNames } from '../../../lib/browser-generator';
import { CopyGrammarModal } from './CopyGrammarModal';

function GrammarsTab({ cultureId, cultureConfig, onGrammarsChange, onLexemesChange, allCultures }) {
  const [mode, setMode] = useState('view');
  const [editingGrammar, setEditingGrammar] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [formData, setFormData] = useState({
    id: `${cultureId}_grammar`,
    start: 'name',
    capitalization: '',
    rules: {}
  });
  const [newRuleKey, setNewRuleKey] = useState('');
  const [newRuleValue, setNewRuleValue] = useState('');
  const [editingRuleKey, setEditingRuleKey] = useState(null); // Track which rule is being edited

  // Autosave refs
  const autosaveTimeoutRef = useRef(null);
  const lastSavedFormDataRef = useRef(null);
  const lastSavedIdRef = useRef(null);

  const naming = cultureConfig?.naming || {};
  const grammars = naming.grammars || [];
  const lexemeLists = naming.lexemeLists || {};
  const domains = naming.domains || [];

  // Autosave effect
  useEffect(() => {
    if (mode !== 'edit' || !editingGrammar) return;

    const formDataStr = JSON.stringify(formData);
    if (formDataStr === lastSavedFormDataRef.current) return;

    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
    }

    autosaveTimeoutRef.current = setTimeout(() => {
      if (!formData.id.trim()) return;

      // Track IDs to remove: both the previously saved ID and the current ID
      // This handles the case where the user changes the ID during editing
      const idsToRemove = new Set([formData.id]);
      if (lastSavedIdRef.current) {
        idsToRemove.add(lastSavedIdRef.current);
      }
      if (editingGrammar !== 'new') {
        idsToRemove.add(editingGrammar);
      }

      const newGrammars = [...grammars.filter(g => !idsToRemove.has(g.id)), formData];

      onGrammarsChange(newGrammars);
      lastSavedFormDataRef.current = formDataStr;
      lastSavedIdRef.current = formData.id;
    }, 1000);

    return () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }
    };
  }, [formData, mode, editingGrammar]);

  useEffect(() => {
    if (mode === 'view') {
      lastSavedFormDataRef.current = null;
      lastSavedIdRef.current = null;
    }
  }, [mode]);

  const handleAddRule = () => {
    if (!newRuleKey.trim() || !newRuleValue.trim()) return;

    const newProductions = newRuleValue.split('|').map(p =>
      p.trim().split(/\s+/).filter(s => s)
    ).filter(p => p.length > 0);

    if (editingRuleKey) {
      // Update mode: replace the rule entirely
      const newRules = { ...formData.rules };
      // If key changed, delete the old one
      if (editingRuleKey !== newRuleKey) {
        delete newRules[editingRuleKey];
      }
      newRules[newRuleKey] = newProductions;
      setFormData({ ...formData, rules: newRules });
      setEditingRuleKey(null);
    } else {
      // Add mode: merge with existing productions
      const existingProductions = formData.rules[newRuleKey] || [];
      const mergedProductions = [...existingProductions, ...newProductions];
      setFormData({
        ...formData,
        rules: {
          ...formData.rules,
          [newRuleKey]: mergedProductions
        }
      });
    }
    setNewRuleKey('');
    setNewRuleValue('');
  };

  const handleEditRule = (key) => {
    const productions = formData.rules[key] || [];
    // Convert productions back to string format: "prod1 | prod2 | prod3"
    const valueStr = productions.map(p => p.join(' ')).join(' | ');
    setNewRuleKey(key);
    setNewRuleValue(valueStr);
    setEditingRuleKey(key);
  };

  const handleCancelEdit = () => {
    setNewRuleKey('');
    setNewRuleValue('');
    setEditingRuleKey(null);
  };

  const handleDeleteRule = (key) => {
    const newRules = { ...formData.rules };
    delete newRules[key];
    setFormData({ ...formData, rules: newRules });
  };

  const handleSave = () => {
    if (!formData.id.trim()) return;

    // Same logic as autosave: track all IDs that should be replaced
    const idsToRemove = new Set([formData.id]);
    if (lastSavedIdRef.current) {
      idsToRemove.add(lastSavedIdRef.current);
    }
    if (editingGrammar !== 'new') {
      idsToRemove.add(editingGrammar);
    }

    const newGrammars = [...grammars.filter(g => !idsToRemove.has(g.id)), formData];

    onGrammarsChange(newGrammars);
    setMode('view');
    setEditingGrammar(null);
  };

  const handleDelete = (id) => {
    const newGrammars = grammars.filter(g => g.id !== id);
    onGrammarsChange(newGrammars);
  };

  const handleEdit = (grammar) => {
    setEditingGrammar(grammar.id);
    setFormData(grammar);
    setMode('edit');
  };

  const handleAddNew = () => {
    setEditingGrammar('new');
    setFormData({
      id: `${cultureId}_grammar`,
      start: 'name',
      capitalization: '',
      rules: {}
    });
    setMode('edit');
  };

  const insertIntoRule = (text) => {
    setNewRuleValue(prev => prev ? `${prev} ${text}` : text);
  };

  // Get available lexeme lists
  const availableLexemeLists = Object.keys(lexemeLists).map(id => ({ id, source: 'local' }));

  // View mode
  if (mode === 'view') {
    return (
      <div>
        <div className="tab-header">
          <h3 className="mt-0">Context-Free Grammars</h3>
          <div className="flex gap-sm">
            <button className="secondary" onClick={() => setShowHelp(true)}>? Help</button>
            {allCultures && Object.keys(allCultures).length > 1 && (
              <button className="secondary" onClick={() => setShowCopyModal(true)}>
                Copy from...
              </button>
            )}
            <button className="primary" onClick={handleAddNew}>+ New Grammar</button>
          </div>
        </div>

        <p className="text-muted mb-md">
          Grammars define structured name patterns shared across all entity types in this culture.
          Use <code>slot:lexeme_id</code> to reference lexeme lists.
        </p>

        {grammars.length === 0 ? (
          <div className="empty-state-card">
            <p className="mt-0 mb-0">No grammars yet.</p>
            <p className="text-muted mt-sm mb-0">
              Create lexeme lists first, then define grammars to structure names.
            </p>
          </div>
        ) : (
          <div className="grid gap-sm">
            {grammars.map((grammar) => (
              <div key={grammar.id} className="grammar-card">
                <div className="flex justify-between align-start">
                  <div>
                    <strong>{grammar.id}</strong>
                    <div className="text-small text-muted mt-xs">
                      Start: <code>{grammar.start}</code> • {Object.keys(grammar.rules || {}).length} rules
                      {grammar.capitalization && <> • Case: <code>{grammar.capitalization}</code></>}
                    </div>
                  </div>
                  <div className="flex gap-sm">
                    <button className="secondary text-small" onClick={() => handleEdit(grammar)}>
                      Edit
                    </button>
                    <button className="danger text-small" onClick={() => handleDelete(grammar.id)}>
                      Delete
                    </button>
                  </div>
                </div>
                <GrammarPreview
                  grammar={grammar}
                  domains={domains}
                  lexemeLists={lexemeLists}
                />
              </div>
            ))}
          </div>
        )}

        {showHelp && <GrammarHelpModal onClose={() => setShowHelp(false)} />}
        {showCopyModal && (
          <CopyGrammarModal
            cultureId={cultureId}
            cultureConfig={cultureConfig}
            allCultures={allCultures}
            existingGrammarIds={grammars.map(g => g.id)}
            onCopy={(copiedGrammar, copiedLexemeLists) => {
              const newGrammars = [...grammars, copiedGrammar];
              // If copying lexeme lists, do atomic update with grammar
              if (copiedLexemeLists && Object.keys(copiedLexemeLists).length > 0 && onLexemesChange) {
                const updatedLists = { ...lexemeLists, ...copiedLexemeLists };
                onLexemesChange(updatedLists, undefined, newGrammars);
              } else {
                onGrammarsChange(newGrammars);
              }
              setShowCopyModal(false);
            }}
            onClose={() => setShowCopyModal(false)}
          />
        )}
      </div>
    );
  }

  // Edit mode
  return (
    <div>
      <div className="tab-header">
        <h3 className="mt-0">{editingGrammar === 'new' ? 'New Grammar' : 'Edit Grammar'}</h3>
        <div className="flex gap-sm">
          <button className="primary" onClick={handleSave}>Save</button>
          <button className="secondary" onClick={() => { setMode('view'); setEditingGrammar(null); }}>Cancel</button>
        </div>
      </div>

      <div className="form-group">
        <label>Grammar ID</label>
        <input
          value={formData.id}
          onChange={(e) => setFormData({ ...formData, id: e.target.value })}
          placeholder={`${cultureId}_grammar`}
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

      <div className="form-group">
        <label>Capitalization</label>
        <select
          value={formData.capitalization || ''}
          onChange={(e) => setFormData({ ...formData, capitalization: e.target.value || undefined })}
        >
          <option value="">None</option>
          <option value="titleWords">Each Word Capitalized</option>
          <option value="title">First Letter Only</option>
          <option value="allcaps">ALL CAPS</option>
          <option value="lowercase">lowercase</option>
          <option value="mixed">MiXeD (alternating)</option>
        </select>
        <small className="text-muted">
          e.g., "king of north" → {formData.capitalization === 'titleWords' ? '"King Of North"' :
            formData.capitalization === 'title' ? '"King of north"' :
            formData.capitalization === 'allcaps' ? '"KING OF NORTH"' :
            formData.capitalization === 'lowercase' ? '"king of north"' :
            formData.capitalization === 'mixed' ? '"KiNg Of NoRtH"' : 'unchanged'}
        </small>
      </div>

      <h4 className="mt-lg mb-md">Production Rules</h4>

      {/* Current rules - shown first so users see what exists */}
      {Object.keys(formData.rules).length > 0 && (
        <div className="mb-md">
          {Object.entries(formData.rules).map(([key, productions]) => (
            <div key={key} className={`rule-card ${editingRuleKey === key ? 'editing' : ''}`}>
              <div className="font-mono text-small flex-1">
                <strong className="text-gold">{key}</strong>
                <span className="text-muted"> → </span>
                {productions.map((prod, i) => (
                  <span key={i}>
                    <span className="text-light">{prod.join(' ')}</span>
                    {i < productions.length - 1 && <span className="text-muted"> | </span>}
                  </span>
                ))}
              </div>
              <div className="rule-actions">
                <button
                  className="secondary btn-xs"
                  onClick={() => handleEditRule(key)}
                  title="Edit rule"
                >
                  Edit
                </button>
                <button
                  className="danger btn-xs"
                  onClick={() => handleDeleteRule(key)}
                  title="Delete rule"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Rule editor form */}
      <div className="rule-form">
        {editingRuleKey && (
          <div className="text-small text-cyan mb-sm">
            Editing rule: <strong>{editingRuleKey}</strong>
          </div>
        )}
        <div className="flex gap-sm mb-sm">
          <input
            className="rule-key-input"
            value={newRuleKey}
            onChange={(e) => setNewRuleKey(e.target.value)}
            placeholder="Non-terminal"
          />
          <span className="rule-arrow">→</span>
          <input
            className="flex-1"
            value={newRuleValue}
            onChange={(e) => setNewRuleValue(e.target.value)}
            placeholder="slot:lexeme_id | literal | other_nonterminal"
          />
          <button className="primary" onClick={handleAddRule}>
            {editingRuleKey ? 'Update' : 'Add'}
          </button>
          {editingRuleKey && (
            <button className="secondary" onClick={handleCancelEdit}>
              Cancel
            </button>
          )}
        </div>
        <small className="text-muted">
          Use <code>|</code> for alternatives, <code>space</code> for sequence
        </small>
      </div>

      {/* Collapsible Click-to-Insert Panel */}
      <CollapsiblePanel title="Click to Insert" defaultExpanded={false}>
        {/* Click-to-insert: Lexeme Lists */}
        {availableLexemeLists.length > 0 && (
          <ClickToInsertSection
            title="Lexeme Lists"
            items={availableLexemeLists.map(({ id }) => ({
              code: `slot:${id}`,
              title: 'Lexeme list'
            }))}
            onInsert={insertIntoRule}
            variant="gold"
          />
        )}

        {/* Click-to-insert: Domain Phonology */}
        {domains.map(domain => (
          <DomainInsertSection
            key={domain.id}
            domain={domain}
            onInsert={insertIntoRule}
          />
        ))}

        {/* Click-to-insert: Markov Chain Models */}
        <ClickToInsertSection
          title="Markov Chain Models"
          subtitle="(statistically-generated names)"
          items={MARKOV_MODELS.map(({ id, name, desc }) => ({
            code: `markov:${id}`,
            title: `${name}: ${desc}`
          }))}
          onInsert={insertIntoRule}
          variant="purple"
        />

        {/* Entity Linkage */}
        <EntityLinkageSection onInsert={insertIntoRule} />

        {/* Common literals */}
        <ClickToInsertSection
          title="Common Literals"
          items={COMMON_LITERALS.map(lit => ({ code: lit, title: lit }))}
          onInsert={insertIntoRule}
          variant="muted"
        />

        {/* Modifiers */}
        <ModifiersSection onInsert={insertIntoRule} />
      </CollapsiblePanel>

    </div>
  );
}

// Helper components
function CollapsiblePanel({ title, defaultExpanded = true, children }) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="collapsible-panel">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className={`collapsible-header ${expanded ? 'expanded' : ''}`}
      >
        <span>{title}</span>
        <span className={`collapsible-arrow ${expanded ? 'expanded' : ''}`}>▼</span>
      </button>
      {expanded && (
        <div className="collapsible-content">
          {children}
        </div>
      )}
    </div>
  );
}

function ClickToInsertSection({ title, subtitle, items, onInsert, variant = 'blue' }) {
  return (
    <div className={`insert-panel ${variant}`}>
      <div className="insert-panel-title">
        <strong>{title}</strong> {subtitle && <span className="text-muted">{subtitle}</span>}
      </div>
      <div className="flex flex-wrap gap-sm">
        {items.map(({ code, title: itemTitle }) => (
          <code
            key={code}
            className={`insert-chip ${variant}`}
            onClick={() => onInsert(code)}
            title={itemTitle}
          >
            {code}
          </code>
        ))}
      </div>
    </div>
  );
}

function DomainInsertSection({ domain, onInsert }) {
  return (
    <div className="insert-panel domain">
      <div className="insert-panel-title text-purple">
        <strong>Domain: {domain.id}</strong>
      </div>

      <div className="mb-sm">
        <code
          className="insert-chip gold domain-chip"
          onClick={() => onInsert(`domain:${domain.id}`)}
          title="Generate phonotactic name from this domain"
        >
          domain:{domain.id}
        </code>
        <span className="text-xs text-muted ml-sm">
          (generates phonotactic names)
        </span>
      </div>

      {domain.morphology?.prefixes?.length > 0 && (
        <div className="mb-sm">
          <span className="text-xs text-muted">Prefixes: </span>
          {domain.morphology.prefixes.slice(0, 8).map((p, i) => (
            <code
              key={i}
              className="morph-chip"
              onClick={() => onInsert(p)}
            >
              {p}
            </code>
          ))}
        </div>
      )}

      {domain.morphology?.suffixes?.length > 0 && (
        <div>
          <span className="text-xs text-muted">Suffixes: </span>
          {domain.morphology.suffixes.slice(0, 8).map((s, i) => (
            <code
              key={i}
              className="morph-chip"
              onClick={() => onInsert(s)}
            >
              {s}
            </code>
          ))}
        </div>
      )}
    </div>
  );
}

function EntityLinkageSection({ onInsert }) {
  return (
    <div className="insert-panel green">
      <div className="insert-panel-title text-green">
        <strong>Entity Linkage</strong> (uses related entity names from KG)
      </div>
      <div className="flex flex-wrap gap-sm mb-sm">
        {CONTEXT_KEYS.npcRelations.map(({ key, desc }) => (
          <code
            key={key}
            className="insert-chip green"
            onClick={() => onInsert(`context:${key}`)}
            title={desc}
          >
            context:{key}
          </code>
        ))}
      </div>
      <div className="flex flex-wrap gap-sm">
        {CONTEXT_KEYS.locationFactionRelations.map(({ key, desc }) => (
          <code
            key={key}
            className="insert-chip green"
            onClick={() => onInsert(`context:${key}`)}
            title={desc}
          >
            context:{key}
          </code>
        ))}
      </div>
    </div>
  );
}

function ModifiersSection({ onInsert }) {
  return (
    <div className="insert-panel cyan">
      <div className="insert-panel-title">
        <strong>Modifiers</strong> <span className="text-muted">(append to tokens)</span>
      </div>
      <div className="mb-sm">
        <span className="text-xs text-muted">Morphology (irregulars handled): </span>
        <div className="flex flex-wrap gap-sm mt-xs">
          {GRAMMAR_MODIFIERS.derivation.map(({ code, desc }) => (
            <code
              key={code}
              className="insert-chip cyan"
              onClick={() => onInsert(code)}
              title={desc}
            >
              {code}
            </code>
          ))}
        </div>
      </div>
      <div className="mb-sm">
        <span className="text-xs text-muted">Capitalization: </span>
        <div className="flex flex-wrap gap-sm mt-xs">
          {GRAMMAR_MODIFIERS.capitalization.map(({ code, desc }) => (
            <code
              key={code}
              className="insert-chip cyan"
              onClick={() => onInsert(code)}
              title={desc}
            >
              {code}
            </code>
          ))}
        </div>
      </div>
      <div>
        <span className="text-xs text-muted">Operators: </span>
        <div className="flex flex-wrap gap-sm mt-xs">
          {GRAMMAR_MODIFIERS.operators.map(({ code, desc }) => (
            <code
              key={code}
              className="insert-chip cyan"
              onClick={() => onInsert(code)}
              title={desc}
            >
              {code}
            </code>
          ))}
        </div>
      </div>
    </div>
  );
}

function GrammarHelpModal({ onClose }) {
  const mouseDownOnOverlay = useRef(false);

  const handleOverlayMouseDown = (e) => {
    mouseDownOnOverlay.current = e.target === e.currentTarget;
  };

  const handleOverlayClick = (e) => {
    if (mouseDownOnOverlay.current && e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onMouseDown={handleOverlayMouseDown} onClick={handleOverlayClick}>
      <div className="modal-content help-modal">
        <div className="tab-header mb-md">
          <h3 className="mt-0">Context-Free Grammars</h3>
          <button className="secondary" onClick={onClose}>Close</button>
        </div>

        <div className="help-content">
          <p>CFGs define structured patterns for name generation.</p>

          <h4>Example</h4>
          <div className="code-block">
            <div>name → adj - noun</div>
            <div>adj → slot:adjectives</div>
            <div>noun → slot:nouns</div>
          </div>
          <p className="text-small">→ "Swift-Scale", "Dark-Fang"</p>

          <h4>Syntax</h4>
          <ul className="text-small">
            <li><code>slot:id</code> - Lexeme list</li>
            <li><code>domain:id</code> - Phonotactic name</li>
            <li><code>markov:id</code> - Markov chain name</li>
            <li><code>context:key</code> - Related entity name</li>
            <li><code>^</code> - Join without space:
              <ul>
                <li><code>domain:x^'s</code> → &lt;domain&gt;'s</li>
                <li><code>^'slot:x</code> → '&lt;slot&gt;</li>
                <li><code>domain:x^'^slot:y</code> → &lt;domain&gt;'&lt;slot&gt;</li>
              </ul>
            </li>
            <li><code>~</code> - Per-token capitalization:
              <ul>
                <li><code>~cap</code> / <code>~c</code> - Capitalized</li>
                <li><code>~lower</code> / <code>~l</code> - lowercase</li>
                <li><code>~upper</code> / <code>~u</code> - UPPERCASE</li>
                <li><code>~title</code> / <code>~t</code> - Title Case</li>
              </ul>
              <div className="mt-xs">Example: <code>domain:x~cap domain:y~lower^'^slot:z~cap</code></div>
              <div>→ "Capital lower'Capital"</div>
            </li>
            <li><code>~</code> - Morphological derivations (transform words):
              <ul>
                <li><code>~er</code> - Agentive: hunt → hunter, forge → forger</li>
                <li><code>~est</code> - Superlative: deep → deepest, grim → grimmest</li>
                <li><code>~comp</code> - Comparative: dark → darker, swift → swifter</li>
                <li><code>~ing</code> - Gerund: burn → burning, forge → forging</li>
                <li><code>~ed</code> - Past: curse → cursed, slay → slain</li>
                <li><code>~poss</code> - Possessive: storm → storm's, darkness → darkness'</li>
              </ul>
              <div className="mt-xs">Example: <code>slot:verbs~er</code> → "Hunter"</div>
              <div>Combine: <code>slot:adj~est~cap</code> → "Deepest"</div>
              <div className="text-muted mt-xs">Handles irregulars: break→broken, good→best, lie→liar</div>
            </li>
            <li><code>|</code> - Alternatives</li>
          </ul>

          <h4>Capitalization</h4>
          <p className="text-small">
            Controls how the final generated name is formatted:
          </p>
          <ul className="text-small">
            <li><strong>Each Word Capitalized</strong> - "king of north" → "King Of North"</li>
            <li><strong>First Letter Only</strong> - "king of north" → "King of north"</li>
            <li><strong>ALL CAPS / lowercase</strong> - Force case</li>
            <li><strong>MiXeD</strong> - "king of north" → "KiNg Of NoRtH"</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

/**
 * Live preview of grammar output - shows sample names
 */
function GrammarPreview({ grammar, domains, lexemeLists }) {
  const [names, setNames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Generate preview names when grammar changes
  useEffect(() => {
    if (!grammar || !grammar.rules || Object.keys(grammar.rules).length === 0) {
      setNames([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    previewGrammarNames({
      grammar,
      domains,
      lexemeLists,
      count: 6
    })
      .then((result) => {
        if (!cancelled) {
          setNames(result);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setNames([]);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [grammar, domains, lexemeLists]);

  if (!grammar.rules || Object.keys(grammar.rules).length === 0) {
    return (
      <div className="grammar-preview empty">
        <span className="text-muted text-small">No rules defined</span>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="grammar-preview">
        <span className="text-muted text-small">Generating...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="grammar-preview error">
        <span className="text-small text-danger">{error}</span>
      </div>
    );
  }

  if (names.length === 0) {
    return (
      <div className="grammar-preview empty">
        <span className="text-muted text-small">Could not generate preview</span>
      </div>
    );
  }

  return (
    <div className="grammar-preview">
      <div className="grammar-preview-names">
        {names.map((name, i) => (
          <span key={i} className="grammar-preview-name">{name}</span>
        ))}
      </div>
    </div>
  );
}

export default GrammarsTab;

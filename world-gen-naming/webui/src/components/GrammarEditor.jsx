import { useState } from 'react';

const API_URL = 'http://localhost:3001';

function GrammarEditor({ metaDomain, grammars, onGrammarsChange, lexemeSpecs, generatedContent }) {
  const [editingGrammar, setEditingGrammar] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const [formData, setFormData] = useState({
    id: '',
    start: '',
    rules: {}
  });
  const [newRuleKey, setNewRuleKey] = useState('');
  const [newRuleValue, setNewRuleValue] = useState('');

  // Get available lexeme IDs that have been generated
  const availableLexemeIds = Object.keys(generatedContent || {});

  const handleAddNew = () => {
    setEditingGrammar('new');
    setFormData({
      id: `${metaDomain}_grammar`,
      start: '',
      rules: {}
    });
  };

  const saveToDisk = async (updatedGrammars) => {
    try {
      const response = await fetch(`${API_URL}/api/meta-domains/${metaDomain}/grammars`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grammars: updatedGrammars })
      });

      if (!response.ok) {
        console.error('Failed to save grammars to disk');
      } else {
        console.log('✅ Grammars saved to disk');
      }
    } catch (error) {
      console.error('Error saving grammars:', error);
    }
  };

  const handleSave = () => {
    const newGrammars = editingGrammar === 'new'
      ? [...grammars, formData]
      : grammars.map(g => g.id === formData.id ? formData : g);
    onGrammarsChange(newGrammars);
    saveToDisk(newGrammars);
    setEditingGrammar(null);
  };

  const handleDelete = (id) => {
    const newGrammars = grammars.filter(g => g.id !== id);
    onGrammarsChange(newGrammars);
    saveToDisk(newGrammars);
  };

  const handleAddRule = () => {
    if (!newRuleKey.trim()) return;

    const productions = newRuleValue.split('|').map(p =>
      p.trim().split(/\s+/).filter(s => s)
    );

    setFormData({
      ...formData,
      rules: {
        ...formData.rules,
        [newRuleKey]: productions
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

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2>Context-Free Grammars</h2>
          <p className="text-muted" style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Define grammar rules that reference generated lexeme lists using slot:lexeme_id syntax
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="secondary" onClick={() => setShowHelp(true)}>📖 More Info</button>
          <button className="primary" onClick={handleAddNew}>+ New Grammar</button>
        </div>
      </div>

      {availableLexemeIds.length === 0 && !editingGrammar && (
        <div style={{
          background: 'rgba(251, 191, 36, 0.15)',
          padding: '1rem',
          borderRadius: '6px',
          marginBottom: '1.5rem',
          border: '1px solid var(--gold-accent)',
          color: 'var(--arctic-light)'
        }}>
          <strong style={{ color: 'var(--gold-accent)' }}>💡 Tip:</strong> Generate lexeme lists first (Step 3) before creating grammars.
          Grammars reference lexeme lists using the <code style={{
            background: 'rgba(59, 130, 246, 0.2)',
            padding: '0.125rem 0.25rem',
            borderRadius: '3px',
            color: 'var(--gold-accent)'
          }}>slot:lexeme_id</code> syntax.
        </div>
      )}

      {editingGrammar ? (
        <div className="card" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          <h3>{editingGrammar === 'new' ? 'New Grammar' : 'Edit Grammar'}</h3>

          <div className="form-group">
            <label>Grammar ID</label>
            <input
              value={formData.id}
              onChange={(e) => setFormData({...formData, id: e.target.value})}
              placeholder="e.g., argonian_phrase"
            />
          </div>

          <div className="form-group">
            <label>Start Symbol</label>
            <input
              value={formData.start}
              onChange={(e) => setFormData({...formData, start: e.target.value})}
              placeholder="e.g., phrase"
            />
            <small className="text-muted">The non-terminal to start generation from</small>
          </div>

          <h4>Production Rules</h4>

          {availableLexemeIds.length > 0 && (
            <div style={{
              background: 'rgba(59, 130, 246, 0.15)',
              padding: '0.75rem',
              borderRadius: '4px',
              marginBottom: '1rem',
              border: '1px solid var(--arctic-ice)'
            }}>
              <div style={{ color: 'var(--arctic-light)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                <strong style={{ color: 'var(--gold-accent)' }}>Available Lexeme Lists:</strong>
              </div>
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.5rem',
                fontSize: '0.75rem'
              }}>
                {availableLexemeIds.map(id => (
                  <code
                    key={id}
                    style={{
                      background: 'rgba(10, 25, 41, 0.8)',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '3px',
                      color: 'var(--gold-accent)',
                      cursor: 'pointer',
                      border: '1px solid rgba(59, 130, 246, 0.3)'
                    }}
                    onClick={() => {
                      setNewRuleValue(prev => prev ? `${prev} slot:${id}` : `slot:${id}`);
                    }}
                    title="Click to insert into production"
                  >
                    slot:{id}
                  </code>
                ))}
              </div>
              <small style={{ display: 'block', marginTop: '0.5rem', color: 'var(--arctic-frost)' }}>
                Click a lexeme ID to insert it into your production rule
              </small>
            </div>
          )}

          <div style={{ background: 'rgba(30, 58, 95, 0.3)', padding: '1rem', borderRadius: '4px', marginBottom: '1rem', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <input
                style={{ flex: '0 0 150px' }}
                value={newRuleKey}
                onChange={(e) => setNewRuleKey(e.target.value)}
                placeholder="Non-terminal (e.g., adj)"
              />
              <input
                style={{ flex: 1 }}
                value={newRuleValue}
                onChange={(e) => setNewRuleValue(e.target.value)}
                placeholder="slot:lexeme_id | literal text | other_nonterminal"
              />
              <button className="primary" onClick={handleAddRule}>Add Rule</button>
            </div>
            <small className="text-muted">
              Example: <strong>adj → slot:argonian_adjectives | swift</strong> (use | for alternatives, space for sequence)
            </small>
          </div>

          {Object.keys(formData.rules).length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              {Object.entries(formData.rules).map(([key, productions]) => (
                <div key={key} style={{
                  padding: '0.75rem',
                  background: 'rgba(30, 58, 95, 0.4)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  borderRadius: '4px',
                  marginBottom: '0.5rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div style={{ color: 'var(--arctic-light)' }}>
                    <strong style={{ color: 'var(--arctic-frost)' }}>{key}</strong> →{' '}
                    {productions.map((prod, i) => (
                      <span key={i}>
                        {prod.join(' ')}
                        {i < productions.length - 1 && ' | '}
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

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button className="primary" onClick={handleSave}>Save</button>
            <button className="secondary" onClick={() => setEditingGrammar(null)}>Cancel</button>
          </div>
        </div>
      ) : (
        <div className="item-list">
          {grammars.length === 0 ? (
            <p className="text-muted">No grammars yet. Click "+ New Grammar" to create one.</p>
          ) : (
            grammars.map(grammar => (
              <div key={grammar.id} className="list-item">
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <strong>{grammar.id}</strong>
                    <p className="text-muted" style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem' }}>
                      Start: {grammar.start} | Rules: {Object.keys(grammar.rules || {}).length}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="secondary" onClick={() => { setEditingGrammar(grammar.id); setFormData(grammar); }}>
                      Edit
                    </button>
                    <button className="danger" onClick={() => handleDelete(grammar.id)}>Delete</button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Help Modal */}
      {showHelp && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '2rem'
        }} onClick={() => setShowHelp(false)}>
          <div style={{
            background: 'linear-gradient(135deg, var(--arctic-dark) 0%, var(--arctic-mid) 100%)',
            borderRadius: '8px',
            padding: '2rem',
            maxWidth: '900px',
            maxHeight: '85vh',
            overflowY: 'auto',
            border: '2px solid var(--arctic-ice)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, color: 'var(--arctic-light)' }}>Context-Free Grammars & Lexemes</h2>
              <button className="secondary" onClick={() => setShowHelp(false)} style={{ padding: '0.5rem 1rem' }}>✕</button>
            </div>

            <div style={{ color: 'var(--arctic-light)', lineHeight: '1.6' }}>

              {/* What are CFGs */}
              <section style={{ marginBottom: '2rem' }}>
                <h3 style={{ color: 'var(--arctic-frost)', marginTop: 0 }}>What are Context-Free Grammars?</h3>
                <p>
                  Context-Free Grammars (CFGs) are formal rules that define how to generate structured text.
                  They're perfect for creating names with <strong>consistent patterns</strong> like titles, epithets,
                  or compound names (e.g., "Swift-Scale", "Guardian of the North").
                </p>
                <p>
                  Unlike pure phonological generation (which creates random-sounding names), CFGs give you
                  <strong>predictable structure</strong> with <strong>variable content</strong>.
                </p>
              </section>

              {/* Core Concepts */}
              <section style={{ marginBottom: '2rem' }}>
                <h3 style={{ color: 'var(--arctic-frost)' }}>Core Concepts</h3>

                <div style={{
                  background: 'rgba(30, 58, 95, 0.5)',
                  padding: '1rem',
                  borderRadius: '6px',
                  marginBottom: '1rem',
                  border: '1px solid rgba(59, 130, 246, 0.3)'
                }}>
                  <h4 style={{ color: 'var(--arctic-frost)', marginTop: 0 }}>Start Symbol</h4>
                  <p style={{ marginBottom: 0 }}>
                    The <strong>starting point</strong> for name generation. Usually named something like
                    "phrase", "name", or "title". Every generation begins here.
                  </p>
                </div>

                <div style={{
                  background: 'rgba(30, 58, 95, 0.5)',
                  padding: '1rem',
                  borderRadius: '6px',
                  marginBottom: '1rem',
                  border: '1px solid rgba(59, 130, 246, 0.3)'
                }}>
                  <h4 style={{ color: 'var(--arctic-frost)', marginTop: 0 }}>Non-Terminal</h4>
                  <p style={{ marginBottom: 0 }}>
                    A <strong>placeholder</strong> that gets replaced during generation. Written in UPPERCASE
                    by convention (e.g., ADJECTIVE, NOUN, TITLE). These are like variables that expand into
                    actual content.
                  </p>
                </div>

                <div style={{
                  background: 'rgba(30, 58, 95, 0.5)',
                  padding: '1rem',
                  borderRadius: '6px',
                  marginBottom: '1rem',
                  border: '1px solid rgba(59, 130, 246, 0.3)'
                }}>
                  <h4 style={{ color: 'var(--arctic-frost)', marginTop: 0 }}>Production (Rule)</h4>
                  <p style={{ marginBottom: 0 }}>
                    A <strong>rule</strong> that says "replace this non-terminal with this pattern".
                    The left side is what you're replacing, the right side is what you replace it with.
                    Use <code style={{
                      background: 'rgba(59, 130, 246, 0.2)',
                      padding: '0.125rem 0.25rem',
                      borderRadius: '3px',
                      color: 'var(--gold-accent)'
                    }}>|</code> to separate alternatives.
                  </p>
                </div>

                <div style={{
                  background: 'rgba(30, 58, 95, 0.5)',
                  padding: '1rem',
                  borderRadius: '6px',
                  border: '1px solid rgba(59, 130, 246, 0.3)'
                }}>
                  <h4 style={{ color: 'var(--arctic-frost)', marginTop: 0 }}>Terminal</h4>
                  <p style={{ marginBottom: 0 }}>
                    A <strong>final value</strong> that appears in the output. These come from lexeme lists
                    or can be literal strings like "-", "of", "the".
                  </p>
                </div>
              </section>

              {/* How CFGs Connect to Lexemes */}
              <section style={{ marginBottom: '2rem' }}>
                <h3 style={{ color: 'var(--arctic-frost)' }}>How CFGs Connect to Lexemes</h3>
                <p>
                  This is the <strong>key integration</strong>: Your grammar defines the <em>structure</em>,
                  and your lexeme lists provide the <em>content</em>.
                </p>

                <div style={{
                  background: 'rgba(59, 130, 246, 0.15)',
                  padding: '1.25rem',
                  borderRadius: '6px',
                  marginTop: '1rem',
                  border: '1px solid var(--arctic-ice)'
                }}>
                  <h4 style={{ color: 'var(--gold-accent)', marginTop: 0 }}>The Workflow</h4>
                  <ol style={{ paddingLeft: '1.5rem', marginBottom: 0 }}>
                    <li style={{ marginBottom: '0.5rem' }}>
                      <strong>Create Grammar Structure</strong>: Define the pattern (e.g., "ADJECTIVE-NOUN")
                    </li>
                    <li style={{ marginBottom: '0.5rem' }}>
                      <strong>Generate Lexeme Lists</strong>: Use the LLM to create word lists (e.g., list of swift adjectives, list of nature nouns)
                    </li>
                    <li style={{ marginBottom: '0.5rem' }}>
                      <strong>Reference Lexemes in Productions</strong>: Tell each non-terminal which lexeme list to pull from
                    </li>
                    <li>
                      <strong>Generate Names</strong>: The system combines grammar structure with lexeme content
                    </li>
                  </ol>
                </div>
              </section>

              {/* Detailed Example */}
              <section style={{ marginBottom: '2rem' }}>
                <h3 style={{ color: 'var(--arctic-frost)' }}>Complete Example: Argonian Names</h3>

                <div style={{
                  background: 'rgba(30, 58, 95, 0.6)',
                  padding: '1.5rem',
                  borderRadius: '6px',
                  border: '1px solid rgba(59, 130, 246, 0.3)'
                }}>
                  <h4 style={{ color: 'var(--arctic-frost)', marginTop: 0, fontSize: '1rem' }}>
                    Step 1: Define Grammar
                  </h4>
                  <div style={{
                    background: 'rgba(10, 25, 41, 0.8)',
                    padding: '1rem',
                    borderRadius: '4px',
                    fontFamily: 'monospace',
                    fontSize: '0.875rem',
                    marginBottom: '1rem'
                  }}>
                    <div style={{ color: 'var(--gold-accent)' }}>Start Symbol: <span style={{ color: 'var(--arctic-frost)' }}>phrase</span></div>
                    <div style={{ marginTop: '0.5rem' }}>
                      <div style={{ color: 'var(--arctic-frost)' }}>phrase → <span style={{ color: 'var(--arctic-light)' }}>adj - noun</span></div>
                      <div style={{ color: 'var(--arctic-frost)' }}>adj → <span style={{ color: 'var(--arctic-light)' }}>slot:argonian_adjectives</span></div>
                      <div style={{ color: 'var(--arctic-frost)' }}>noun → <span style={{ color: 'var(--arctic-light)' }}>slot:argonian_nouns</span></div>
                    </div>
                  </div>

                  <h4 style={{ color: 'var(--arctic-frost)', marginTop: '1rem', fontSize: '1rem' }}>
                    Step 2: Create Lexeme Lists
                  </h4>
                  <p style={{ fontSize: '0.875rem', marginBottom: '0.75rem' }}>
                    In the Specs tab, define what to generate:
                  </p>
                  <ul style={{ fontSize: '0.875rem', paddingLeft: '1.5rem', marginBottom: '1rem' }}>
                    <li><strong>argonian_adjectives</strong>: "30 swift, agile, nature-related adjectives"</li>
                    <li><strong>argonian_nouns</strong>: "20 reptilian, swamp-themed nouns"</li>
                  </ul>

                  <h4 style={{ color: 'var(--arctic-frost)', marginTop: '1rem', fontSize: '1rem' }}>
                    Step 3: Generate Content
                  </h4>
                  <p style={{ fontSize: '0.875rem', marginBottom: '0.75rem' }}>
                    LLM creates actual words:
                  </p>
                  <div style={{
                    background: 'rgba(10, 25, 41, 0.8)',
                    padding: '1rem',
                    borderRadius: '4px',
                    fontSize: '0.875rem'
                  }}>
                    <div><strong style={{ color: 'var(--gold-accent)' }}>argonian_adjectives:</strong> <span style={{ color: 'var(--arctic-light)' }}>Swift, Hidden, Quick, Silent, Bright, Dark...</span></div>
                    <div style={{ marginTop: '0.5rem' }}><strong style={{ color: 'var(--gold-accent)' }}>argonian_nouns:</strong> <span style={{ color: 'var(--arctic-light)' }}>Scale, Marsh, Water, Fang, Stone, Shadow...</span></div>
                  </div>

                  <h4 style={{ color: 'var(--arctic-frost)', marginTop: '1rem', fontSize: '1rem' }}>
                    Step 4: Name Generation
                  </h4>
                  <p style={{ fontSize: '0.875rem', marginBottom: '0.75rem' }}>
                    System combines structure + content:
                  </p>
                  <div style={{
                    background: 'rgba(59, 130, 246, 0.2)',
                    padding: '1rem',
                    borderRadius: '4px',
                    border: '1px solid var(--arctic-ice)'
                  }}>
                    <div style={{ color: 'var(--gold-accent)', fontSize: '1.125rem' }}>
                      ✓ Swift-Scale<br/>
                      ✓ Hidden-Marsh<br/>
                      ✓ Quick-Fang<br/>
                      ✓ Silent-Water
                    </div>
                  </div>
                </div>
              </section>

              {/* Advanced Patterns */}
              <section style={{ marginBottom: '2rem' }}>
                <h3 style={{ color: 'var(--arctic-frost)' }}>Advanced Patterns</h3>

                <div style={{
                  background: 'rgba(30, 58, 95, 0.5)',
                  padding: '1rem',
                  borderRadius: '6px',
                  marginBottom: '1rem',
                  border: '1px solid rgba(59, 130, 246, 0.3)'
                }}>
                  <h4 style={{ color: 'var(--arctic-frost)', marginTop: 0 }}>Alternatives (|)</h4>
                  <div style={{
                    background: 'rgba(10, 25, 41, 0.8)',
                    padding: '0.75rem',
                    borderRadius: '4px',
                    fontFamily: 'monospace',
                    fontSize: '0.875rem',
                    marginTop: '0.5rem'
                  }}>
                    <div style={{ color: 'var(--arctic-frost)' }}>name → <span style={{ color: 'var(--arctic-light)' }}>simple | compound</span></div>
                    <div style={{ color: 'var(--arctic-frost)' }}>simple → <span style={{ color: 'var(--arctic-light)' }}>slot:first_names</span></div>
                    <div style={{ color: 'var(--arctic-frost)' }}>compound → <span style={{ color: 'var(--arctic-light)' }}>adj - noun</span></div>
                  </div>
                  <p style={{ fontSize: '0.875rem', marginTop: '0.75rem', marginBottom: 0 }}>
                    Randomly picks between "simple" or "compound" structure.
                  </p>
                </div>

                <div style={{
                  background: 'rgba(30, 58, 95, 0.5)',
                  padding: '1rem',
                  borderRadius: '6px',
                  marginBottom: '1rem',
                  border: '1px solid rgba(59, 130, 246, 0.3)'
                }}>
                  <h4 style={{ color: 'var(--arctic-frost)', marginTop: 0 }}>Nested Structures</h4>
                  <div style={{
                    background: 'rgba(10, 25, 41, 0.8)',
                    padding: '0.75rem',
                    borderRadius: '4px',
                    fontFamily: 'monospace',
                    fontSize: '0.875rem',
                    marginTop: '0.5rem'
                  }}>
                    <div style={{ color: 'var(--arctic-frost)' }}>title → <span style={{ color: 'var(--arctic-light)' }}>name of location</span></div>
                    <div style={{ color: 'var(--arctic-frost)' }}>name → <span style={{ color: 'var(--arctic-light)' }}>adj noun</span></div>
                    <div style={{ color: 'var(--arctic-frost)' }}>location → <span style={{ color: 'var(--arctic-light)' }}>the region</span></div>
                  </div>
                  <p style={{ fontSize: '0.875rem', marginTop: '0.75rem', marginBottom: 0 }}>
                    Generates: "Ancient Guardian of the North"
                  </p>
                </div>

                <div style={{
                  background: 'rgba(30, 58, 95, 0.5)',
                  padding: '1rem',
                  borderRadius: '6px',
                  border: '1px solid rgba(59, 130, 246, 0.3)'
                }}>
                  <h4 style={{ color: 'var(--arctic-frost)', marginTop: 0 }}>Literal Strings</h4>
                  <div style={{
                    background: 'rgba(10, 25, 41, 0.8)',
                    padding: '0.75rem',
                    borderRadius: '4px',
                    fontFamily: 'monospace',
                    fontSize: '0.875rem',
                    marginTop: '0.5rem'
                  }}>
                    <div style={{ color: 'var(--arctic-frost)' }}>title → <span style={{ color: 'var(--arctic-light)' }}>role of the realm</span></div>
                    <div style={{ color: 'var(--arctic-frost)' }}>role → <span style={{ color: 'var(--arctic-light)' }}>slot:roles</span></div>
                    <div style={{ color: 'var(--arctic-frost)' }}>realm → <span style={{ color: 'var(--arctic-light)' }}>slot:realms</span></div>
                  </div>
                  <p style={{ fontSize: '0.875rem', marginTop: '0.75rem', marginBottom: 0 }}>
                    "of", "the" are literal strings. "role" and "realm" pull from lexeme lists.
                  </p>
                </div>
              </section>

              {/* Referencing Lexemes */}
              <section style={{ marginBottom: '2rem' }}>
                <h3 style={{ color: 'var(--arctic-frost)' }}>Referencing Lexeme Lists</h3>
                <p>
                  To connect a non-terminal to a lexeme list, use the <code style={{
                    background: 'rgba(59, 130, 246, 0.2)',
                    padding: '0.125rem 0.25rem',
                    borderRadius: '3px',
                    color: 'var(--gold-accent)'
                  }}>slot:lexeme_id</code> syntax in your production:
                </p>
                <div style={{
                  background: 'rgba(10, 25, 41, 0.8)',
                  padding: '1rem',
                  borderRadius: '4px',
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                  marginTop: '0.75rem'
                }}>
                  <div style={{ color: 'var(--arctic-frost)' }}>adj → <span style={{ color: 'var(--gold-accent)' }}>slot:elven_adjectives</span></div>
                  <div style={{ color: 'var(--arctic-frost)' }}>noun → <span style={{ color: 'var(--gold-accent)' }}>slot:elven_nouns</span></div>
                  <div style={{ color: 'var(--arctic-frost)' }}>verb → <span style={{ color: 'var(--gold-accent)' }}>slot:elven_verbs</span></div>
                </div>
                <p style={{ marginTop: '1rem', fontSize: '0.875rem' }}>
                  The <code style={{
                    background: 'rgba(59, 130, 246, 0.2)',
                    padding: '0.125rem 0.25rem',
                    borderRadius: '3px',
                    color: 'var(--gold-accent)'
                  }}>lexeme_id</code> must match the ID you used when creating the lexeme list in Step 3 (Specs).
                </p>
              </section>

              {/* Tips */}
              <section>
                <h3 style={{ color: 'var(--arctic-frost)' }}>Tips & Best Practices</h3>
                <ul style={{ paddingLeft: '1.5rem' }}>
                  <li style={{ marginBottom: '0.5rem' }}>
                    <strong>Start Simple</strong>: Begin with basic patterns like "adj-noun" before adding complexity
                  </li>
                  <li style={{ marginBottom: '0.5rem' }}>
                    <strong>Use Descriptive Non-Terminals</strong>: Names like "adj", "noun", "title" are clearer than "a", "b", "c"
                  </li>
                  <li style={{ marginBottom: '0.5rem' }}>
                    <strong>Test Incrementally</strong>: Add one rule at a time and test generation
                  </li>
                  <li style={{ marginBottom: '0.5rem' }}>
                    <strong>Balance Variety</strong>: Use alternatives (|) to create diverse outputs
                  </li>
                  <li style={{ marginBottom: '0.5rem' }}>
                    <strong>Keep Lexeme Lists Focused</strong>: Separate adjectives, nouns, verbs into distinct lists rather than mixing
                  </li>
                  <li>
                    <strong>Match Culture</strong>: Ensure your lexeme content matches the cultural style of your domain
                  </li>
                </ul>
              </section>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default GrammarEditor;

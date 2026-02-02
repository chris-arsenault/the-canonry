import { useState, useEffect, useRef } from 'react';
import { previewGrammarNames } from '../../../lib/browser-generator';

const EMPTY_LEXEME_LISTS = Object.freeze({});

/**
 * Generate a unique ID with culture prefix, avoiding conflicts
 */
function generateUniqueId(cultureId, sourceId, existingIds) {
  const suffix = sourceId.replace(/^[^_]+_/, '');
  let newId = `${cultureId}_${suffix}`;
  let counter = 1;
  while (existingIds.includes(newId)) {
    newId = `${cultureId}_${suffix}_${counter}`;
    counter++;
  }
  return newId;
}

/**
 * Extract all slot:xxx references from a grammar
 */
function extractSlotReferences(grammar) {
  const refs = new Set();
  const slotPattern = /slot:([a-zA-Z0-9_]+)/g;

  for (const productions of Object.values(grammar.rules || {})) {
    for (const prod of productions) {
      for (const token of prod) {
        let match;
        while ((match = slotPattern.exec(token)) !== null) {
          refs.add(match[1]);
        }
      }
    }
  }

  return Array.from(refs);
}

/**
 * Substitute grammar references from source culture to target culture.
 */
function substituteGrammarReferences(sourceGrammar, sourceCulture, targetCulture, targetCultureId) {
  const sourceNaming = sourceCulture?.naming || {};
  const targetNaming = targetCulture?.naming || {};
  const sourceDomains = (sourceNaming.domains || []).map(d => d.id);
  const targetDomains = (targetNaming.domains || []).map(d => d.id);
  const sourceLexemes = Object.keys(sourceNaming.lexemeLists || {});
  const targetLexemes = Object.keys(targetNaming.lexemeLists || {});

  const substitutions = {};

  // Map domains by position
  sourceDomains.forEach((srcDomain, i) => {
    if (targetDomains[i]) {
      substitutions[srcDomain] = targetDomains[i];
    } else if (targetDomains.length > 0) {
      substitutions[srcDomain] = targetDomains[0];
    }
  });

  // Map lexeme lists by suffix pattern
  sourceLexemes.forEach(srcLex => {
    const parts = srcLex.split('_');
    const suffix = parts.length > 1 ? parts.slice(1).join('_') : srcLex;

    const match = targetLexemes.find(tl => {
      const tParts = tl.split('_');
      const tSuffix = tParts.length > 1 ? tParts.slice(1).join('_') : tl;
      return tSuffix === suffix;
    });

    substitutions[srcLex] = match || srcLex;
  });

  // Apply substitutions to rules
  const newRules = {};
  for (const [key, productions] of Object.entries(sourceGrammar.rules || {})) {
    newRules[key] = productions.map(prod =>
      prod.map(token => substituteToken(token, substitutions))
    );
  }

  return {
    ...sourceGrammar,
    id: `${targetCultureId}_copied`,
    rules: newRules
  };
}

function substituteToken(token, substitutions) {
  let result = token;
  result = result.replace(/domain:([a-zA-Z0-9_]+)/g, (_, id) => `domain:${substitutions[id] || id}`);
  result = result.replace(/slot:([a-zA-Z0-9_]+)/g, (_, id) => `slot:${substitutions[id] || id}`);
  return result;
}

/**
 * Live preview of grammar output
 */
function GrammarPreview({ grammar, domains, lexemeLists }) {
  const [names, setNames] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!grammar?.rules || Object.keys(grammar.rules).length === 0) {
      setNames([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    previewGrammarNames({ grammar, domains, lexemeLists, count: 6 })
      .then((result) => {
        if (!cancelled) {
          setNames(result);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setNames([]);
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [grammar, domains, lexemeLists]);

  if (!grammar?.rules || Object.keys(grammar.rules).length === 0) {
    return <div className="grammar-preview empty"><span className="text-muted text-small">No rules defined</span></div>;
  }

  if (loading) {
    return <div className="grammar-preview"><span className="text-muted text-small">Generating...</span></div>;
  }

  if (names.length === 0) {
    return <div className="grammar-preview empty"><span className="text-muted text-small">Could not generate preview</span></div>;
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

/**
 * Copy Grammar Modal - copy grammar from another culture with smart substitution
 */
export function CopyGrammarModal({ cultureId, cultureConfig, allCultures, existingGrammarIds, onCopy, onClose }) {
  const [selectedCulture, setSelectedCulture] = useState(null);
  const [selectedGrammar, setSelectedGrammar] = useState(null);
  const [newGrammarId, setNewGrammarId] = useState('');
  const [substitutedGrammar, setSubstitutedGrammar] = useState(null);
  const [dependencies, setDependencies] = useState({ missing: [], existing: [] });
  const [selectedDeps, setSelectedDeps] = useState(new Set());
  const mouseDownOnOverlay = useRef(false);

  const handleOverlayMouseDown = (e) => {
    mouseDownOnOverlay.current = e.target === e.currentTarget;
  };

  const handleOverlayClick = (e) => {
    if (mouseDownOnOverlay.current && e.target === e.currentTarget) {
      onClose();
    }
  };

  const otherCultures = Object.entries(allCultures || {})
    .filter(([id]) => id !== cultureId)
    .map(([id, config]) => ({ id, name: config.name || id, grammars: config.naming?.grammars || [] }));

  useEffect(() => {
    if (!selectedGrammar || !selectedCulture) {
      setSubstitutedGrammar(null);
      setDependencies({ missing: [], existing: [] });
      setSelectedDeps(new Set());
      return;
    }

    const sourceCulture = allCultures[selectedCulture];
    const sourceGrammar = sourceCulture?.naming?.grammars?.find(g => g.id === selectedGrammar);
    if (!sourceGrammar) return;

    // Find dependencies
    const slotRefs = extractSlotReferences(sourceGrammar);
    const targetLexemes = Object.keys(cultureConfig?.naming?.lexemeLists || {});
    const sourceLexemes = sourceCulture?.naming?.lexemeLists || {};

    const missing = [];
    const existing = [];
    slotRefs.forEach(slotId => {
      if (sourceLexemes[slotId]) {
        const suffix = slotId.replace(/^[^_]+_/, '');
        const targetEquivalent = targetLexemes.find(tl => {
          const tSuffix = tl.replace(/^[^_]+_/, '');
          return tSuffix === suffix;
        });

        if (targetEquivalent) {
          existing.push({ sourceId: slotId, targetId: targetEquivalent });
        } else {
          missing.push({ sourceId: slotId, entries: sourceLexemes[slotId].entries?.length || 0 });
        }
      }
    });

    setDependencies({ missing, existing });
    setSelectedDeps(new Set(missing.map(d => d.sourceId)));

    const substituted = substituteGrammarReferences(sourceGrammar, sourceCulture, cultureConfig, cultureId);
    const finalId = generateUniqueId(cultureId, sourceGrammar.id, existingGrammarIds);

    setNewGrammarId(finalId);
    setSubstitutedGrammar({ ...substituted, id: finalId });
  }, [selectedGrammar, selectedCulture, allCultures, cultureConfig, cultureId, existingGrammarIds]);

  const toggleDep = (sourceId) => {
    const newSelected = new Set(selectedDeps);
    if (newSelected.has(sourceId)) {
      newSelected.delete(sourceId);
    } else {
      newSelected.add(sourceId);
    }
    setSelectedDeps(newSelected);
  };

  const handleCopy = () => {
    if (!substitutedGrammar) return;

    const copiedLexemeLists = {};
    const sourceCulture = allCultures[selectedCulture];
    const existingListIds = Object.keys(cultureConfig?.naming?.lexemeLists || {});

    selectedDeps.forEach(sourceId => {
      const sourceList = sourceCulture?.naming?.lexemeLists?.[sourceId];
      if (sourceList) {
        const newId = generateUniqueId(cultureId, sourceId, [...existingListIds, ...Object.keys(copiedLexemeLists)]);
        copiedLexemeLists[newId] = {
          ...sourceList,
          id: newId,
          description: sourceList.description
            ? `${sourceList.description} (copied from ${selectedCulture})`
            : `Copied from ${selectedCulture}`
        };
      }
    });

    let finalGrammar = { ...substitutedGrammar, id: newGrammarId };
    if (Object.keys(copiedLexemeLists).length > 0) {
      const idMapping = {};
      selectedDeps.forEach(sourceId => {
        const suffix = sourceId.replace(/^[^_]+_/, '');
        const newId = Object.keys(copiedLexemeLists).find(k => {
          const kSuffix = k.replace(/^[^_]+_/, '').replace(/_\d+$/, '');
          return kSuffix === suffix;
        });
        if (newId) idMapping[sourceId] = newId;
      });

      const newRules = {};
      for (const [key, productions] of Object.entries(finalGrammar.rules || {})) {
        newRules[key] = productions.map(prod =>
          prod.map(token => {
            let result = token;
            Object.entries(idMapping).forEach(([oldId, newId]) => {
              result = result.replace(new RegExp(`slot:${oldId}\\b`, 'g'), `slot:${newId}`);
            });
            return result;
          })
        );
      }
      finalGrammar = { ...finalGrammar, rules: newRules };
    }

    onCopy(finalGrammar, copiedLexemeLists);
  };

  const selectedCultureGrammars = selectedCulture
    ? (allCultures[selectedCulture]?.naming?.grammars || []).filter(g => Object.keys(g.rules || {}).length > 0)
    : [];

  return (
    <div className="modal-overlay" onMouseDown={handleOverlayMouseDown} onClick={handleOverlayClick}>
      <div className="modal-content copy-modal">
        <div className="tab-header mb-md">
          <h3 className="mt-0">Copy Grammar from Another Culture</h3>
          <button className="secondary" onClick={onClose}>×</button>
        </div>

        <div className="copy-modal-body">
          <div className="form-group">
            <label>Source Culture</label>
            <select
              value={selectedCulture || ''}
              onChange={(e) => {
                setSelectedCulture(e.target.value || null);
                setSelectedGrammar(null);
              }}
            >
              <option value="">Select a culture...</option>
              {otherCultures.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.grammars.filter(g => Object.keys(g.rules || {}).length > 0).length} grammars)
                </option>
              ))}
            </select>
          </div>

          {selectedCulture && (
            <div className="form-group">
              <label>Grammar to Copy</label>
              {selectedCultureGrammars.length === 0 ? (
                <p className="text-muted text-small">No grammars with rules in this culture.</p>
              ) : (
                <select
                  value={selectedGrammar || ''}
                  onChange={(e) => setSelectedGrammar(e.target.value || null)}
                >
                  <option value="">Select a grammar...</option>
                  {selectedCultureGrammars.map(g => (
                    <option key={g.id} value={g.id}>{g.id}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          {substitutedGrammar && (
            <div className="copy-preview">
              <div className="form-group">
                <label>New Grammar ID</label>
                <input
                  value={newGrammarId}
                  onChange={(e) => setNewGrammarId(e.target.value)}
                  placeholder="grammar_id"
                />
              </div>

              {(dependencies.missing.length > 0 || dependencies.existing.length > 0) && (
                <div className="dependency-section">
                  <h5>Lexeme List Dependencies</h5>

                  {dependencies.existing.length > 0 && (
                    <div className="dependency-list mb-sm">
                      {dependencies.existing.map(dep => (
                        <div key={dep.sourceId} className="dependency-item exists">
                          <span>✓</span>
                          <span><code>{dep.sourceId}</code> → <code>{dep.targetId}</code></span>
                        </div>
                      ))}
                    </div>
                  )}

                  {dependencies.missing.length > 0 && (
                    <>
                      <p className="text-small text-muted mb-sm">
                        These lexeme lists are missing. Select which to copy:
                      </p>
                      <div className="dependency-list">
                        {dependencies.missing.map(dep => (
                          <label key={dep.sourceId} className="dependency-item missing">
                            <input
                              type="checkbox"
                              checked={selectedDeps.has(dep.sourceId)}
                              onChange={() => toggleDep(dep.sourceId)}
                            />
                            <span><code>{dep.sourceId}</code> ({dep.entries} entries)</span>
                          </label>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              <div className="copy-preview-section">
                <h4>Substitutions Applied</h4>
                <p className="text-small text-muted">
                  References to source culture resources are substituted with matching resources from this culture.
                </p>
                <div className="copy-preview-rules">
                  {Object.entries(substitutedGrammar.rules || {}).map(([key, productions]) => (
                    <div key={key} className="rule-card">
                      <div className="font-mono text-small">
                        <strong className="text-gold">{key}</strong>
                        <span className="text-muted"> → </span>
                        {productions.map((prod, i) => (
                          <span key={i}>
                            <span className="text-light">{prod.join(' ')}</span>
                            {i < productions.length - 1 && <span className="text-muted"> | </span>}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="copy-preview-section">
                <h4>Sample Names</h4>
                <GrammarPreview
                  grammar={substitutedGrammar}
                  domains={cultureConfig?.naming?.domains || []}
                  lexemeLists={cultureConfig?.naming?.lexemeLists || EMPTY_LEXEME_LISTS}
                />
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="secondary" onClick={onClose}>Cancel</button>
          <button
            className="primary"
            onClick={handleCopy}
            disabled={!substitutedGrammar || !newGrammarId.trim()}
          >
            Copy Grammar{selectedDeps.size > 0 ? ` + ${selectedDeps.size} List${selectedDeps.size > 1 ? 's' : ''}` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

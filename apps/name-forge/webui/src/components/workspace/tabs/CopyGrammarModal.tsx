import React, { useState, useEffect, useMemo, useCallback } from "react";
import { ModalShell } from "@the-canonry/shared-components";
import { previewGrammarNames } from "../../../lib/browser-generator";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface GrammarRule {
  rules: Record<string, string[][]>;
  id: string;
}

interface NamingConfig {
  domains?: Array<{ id: string }>;
  grammars?: GrammarRule[];
  lexemeLists?: Record<string, LexemeList>;
  lexemeSpecs?: unknown[];
}

interface CultureConfig {
  name?: string;
  naming?: NamingConfig;
}

interface LexemeList {
  entries?: unknown[];
  description?: string;
  id?: string;
}

interface ExistingDep {
  sourceId: string;
  targetId: string;
}

interface MissingDep {
  sourceId: string;
  entries: number;
}

interface Dependencies {
  missing: MissingDep[];
  existing: ExistingDep[];
}

interface CopyGrammarModalProps {
  cultureId: string;
  cultureConfig: CultureConfig;
  allCultures: Record<string, CultureConfig>;
  existingGrammarIds: string[];
  onCopy: (grammar: GrammarRule, copiedLexemeLists: Record<string, LexemeList>) => void;
  onClose: () => void;
}

interface GrammarPreviewProps {
  grammar: GrammarRule;
  domains: Array<{ id: string }>;
  lexemeLists: Record<string, LexemeList>;
}

/* ------------------------------------------------------------------ */
/*  Pure helpers                                                       */
/* ------------------------------------------------------------------ */

const EMPTY_LEXEME_LISTS: Record<string, LexemeList> = Object.freeze({});

function generateUniqueId(cultureId: string, sourceId: string, existingIds: string[]): string {
  const suffix = sourceId.replace(/^[^_]+_/, "");
  let newId = `${cultureId}_${suffix}`;
  let counter = 1;
  while (existingIds.includes(newId)) {
    newId = `${cultureId}_${suffix}_${counter}`;
    counter++;
  }
  return newId;
}

function extractSlotReferences(grammar: GrammarRule): string[] {
  const refs = new Set<string>();
  const slotPattern = /slot:(\w+)/g;

  for (const productions of Object.values(grammar.rules || {})) {
    for (const prod of productions) {
      for (const token of prod) {
        let match: RegExpExecArray | null;
        while ((match = slotPattern.exec(token)) !== null) {
          refs.add(match[1]);
        }
      }
    }
  }

  return Array.from(refs);
}

function substituteToken(token: string, substitutions: Record<string, string>): string {
  let result = token;
  result = result.replace(
    /domain:(\w+)/g,
    (_, id: string) => `domain:${substitutions[id] || id}`,
  );
  result = result.replace(/slot:(\w+)/g, (_, id: string) => `slot:${substitutions[id] || id}`);
  return result;
}

function buildSubstitutions(
  sourceCulture: CultureConfig,
  targetCulture: CultureConfig,
): Record<string, string> {
  const sourceNaming = sourceCulture?.naming || {};
  const targetNaming = targetCulture?.naming || {};
  const sourceDomains = (sourceNaming.domains || []).map((d) => d.id);
  const targetDomains = (targetNaming.domains || []).map((d) => d.id);
  const sourceLexemes = Object.keys(sourceNaming.lexemeLists || {});
  const targetLexemes = Object.keys(targetNaming.lexemeLists || {});

  const substitutions: Record<string, string> = {};

  sourceDomains.forEach((srcDomain, i) => {
    if (targetDomains[i]) {
      substitutions[srcDomain] = targetDomains[i];
    } else if (targetDomains.length > 0) {
      substitutions[srcDomain] = targetDomains[0];
    }
  });

  sourceLexemes.forEach((srcLex) => {
    const parts = srcLex.split("_");
    const suffix = parts.length > 1 ? parts.slice(1).join("_") : srcLex;

    const match = targetLexemes.find((tl) => {
      const tParts = tl.split("_");
      const tSuffix = tParts.length > 1 ? tParts.slice(1).join("_") : tl;
      return tSuffix === suffix;
    });

    substitutions[srcLex] = match || srcLex;
  });

  return substitutions;
}

function substituteGrammarReferences(
  sourceGrammar: GrammarRule,
  sourceCulture: CultureConfig,
  targetCulture: CultureConfig,
  targetCultureId: string,
): GrammarRule {
  const substitutions = buildSubstitutions(sourceCulture, targetCulture);

  const newRules: Record<string, string[][]> = {};
  for (const [key, productions] of Object.entries(sourceGrammar.rules || {})) {
    newRules[key] = productions.map((prod) =>
      prod.map((token) => substituteToken(token, substitutions)),
    );
  }

  return {
    ...sourceGrammar,
    id: `${targetCultureId}_copied`,
    rules: newRules,
  };
}

function applySlotIdMapping(token: string, idMapping: Record<string, string>): string {
  let result = token;
  Object.entries(idMapping).forEach(([oldId, newId]) => {
    result = result.replace(new RegExp(`slot:${oldId}\\b`, "g"), `slot:${newId}`);
  });
  return result;
}

function computeDependencies(
  sourceGrammar: GrammarRule,
  sourceLexemes: Record<string, LexemeList>,
  targetLexemes: string[],
): Dependencies {
  const slotRefs = extractSlotReferences(sourceGrammar);
  const missing: MissingDep[] = [];
  const existing: ExistingDep[] = [];

  slotRefs.forEach((slotId) => {
    if (sourceLexemes[slotId]) {
      const suffix = slotId.replace(/^[^_]+_/, "");
      const targetEquivalent = targetLexemes.find((tl) => {
        const tSuffix = tl.replace(/^[^_]+_/, "");
        return tSuffix === suffix;
      });

      if (targetEquivalent) {
        existing.push({ sourceId: slotId, targetId: targetEquivalent });
      } else {
        missing.push({ sourceId: slotId, entries: sourceLexemes[slotId].entries?.length || 0 });
      }
    }
  });

  return { missing, existing };
}

/* ------------------------------------------------------------------ */
/*  Grammar preview sub-component                                      */
/* ------------------------------------------------------------------ */

function GrammarPreview({ grammar, domains, lexemeLists }: GrammarPreviewProps) {
  const [names, setNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!grammar?.rules || Object.keys(grammar.rules).length === 0) {
      return;
    }

    let cancelled = false;
    setLoading(true);

    previewGrammarNames({ grammar, domains, lexemeLists, count: 6 })
      .then((result: string[]) => {
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

    return () => {
      cancelled = true;
    };
  }, [grammar, domains, lexemeLists]);

  if (!grammar?.rules || Object.keys(grammar.rules).length === 0) {
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
          <span key={i} className="grammar-preview-name">
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Source selection sub-component                                     */
/* ------------------------------------------------------------------ */

interface OtherCulture {
  id: string;
  name: string;
  grammars: GrammarRule[];
}

interface SourceSelectionProps {
  otherCultures: OtherCulture[];
  selectedCulture: string | null;
  selectedGrammar: string | null;
  selectedCultureGrammars: GrammarRule[];
  onCultureChange: (cultureId: string | null) => void;
  onGrammarChange: (grammarId: string | null) => void;
}

function SourceSelection({
  otherCultures,
  selectedCulture,
  selectedGrammar,
  selectedCultureGrammars,
  onCultureChange,
  onGrammarChange,
}: SourceSelectionProps) {
  const handleCultureChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onCultureChange(e.target.value || null);
    },
    [onCultureChange],
  );

  const handleGrammarChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onGrammarChange(e.target.value || null);
    },
    [onGrammarChange],
  );

  return (
    <>
      <div className="form-group">
        <label htmlFor="source-culture">Source Culture</label>
        <select
          id="source-culture"
          value={selectedCulture || ""}
          onChange={handleCultureChange}
        >
          <option value="">Select a culture...</option>
          {otherCultures.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.grammars.filter((g) => Object.keys(g.rules || {}).length > 0).length}{" "}
              grammars)
            </option>
          ))}
        </select>
      </div>

      {selectedCulture && (
        <div className="form-group">
          <label htmlFor="grammar-to-copy">Grammar to Copy</label>
          {selectedCultureGrammars.length === 0 ? (
            <p className="text-muted text-small">No grammars with rules in this culture.</p>
          ) : (
            <select
              id="grammar-to-copy"
              value={selectedGrammar || ""}
              onChange={handleGrammarChange}
            >
              <option value="">Select a grammar...</option>
              {selectedCultureGrammars.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.id}
                </option>
              ))}
            </select>
          )}
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Preview sub-component                                              */
/* ------------------------------------------------------------------ */

interface CopyPreviewProps {
  substitutedGrammar: GrammarRule;
  newGrammarId: string;
  dependencies: Dependencies;
  selectedDeps: Set<string>;
  cultureConfig: CultureConfig;
  onNewGrammarIdChange: (id: string) => void;
  onToggleDep: (sourceId: string) => void;
}

function CopyPreview({
  substitutedGrammar,
  newGrammarId,
  dependencies,
  selectedDeps,
  cultureConfig,
  onNewGrammarIdChange,
  onToggleDep,
}: CopyPreviewProps) {
  const handleIdChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onNewGrammarIdChange(e.target.value),
    [onNewGrammarIdChange],
  );

  const domainsForPreview = useMemo(
    () => cultureConfig?.naming?.domains || [],
    [cultureConfig?.naming?.domains],
  );

  const lexemeListsForPreview = useMemo(
    () => cultureConfig?.naming?.lexemeLists || EMPTY_LEXEME_LISTS,
    [cultureConfig?.naming?.lexemeLists],
  );

  return (
    <div className="copy-preview">
      <div className="form-group">
        <label htmlFor="new-grammar-id">New Grammar ID</label>
        <input
          id="new-grammar-id"
          value={newGrammarId}
          onChange={handleIdChange}
          placeholder="grammar_id"
        />
      </div>

      {(dependencies.missing.length > 0 || dependencies.existing.length > 0) && (
        <div className="dependency-section">
          <h5>Lexeme List Dependencies</h5>

          {dependencies.existing.length > 0 && (
            <div className="dependency-list mb-sm">
              {dependencies.existing.map((dep) => (
                <div key={dep.sourceId} className="dependency-item exists">
                  <span>{"\u2713"}</span>
                  <span>
                    <code>{dep.sourceId}</code> {"\u2192"} <code>{dep.targetId}</code>
                  </span>
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
                {dependencies.missing.map((dep) => (
                  <label key={dep.sourceId} className="dependency-item missing">
                    <input
                      type="checkbox"
                      checked={selectedDeps.has(dep.sourceId)}
                      onChange={() => onToggleDep(dep.sourceId)}
                    />
                    <span>
                      <code>{dep.sourceId}</code> ({dep.entries} entries)
                    </span>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <div className="viewer-section">
        <h4>Substitutions Applied</h4>
        <p className="text-small text-muted">
          References to source culture resources are substituted with matching resources
          from this culture.
        </p>
        <div className="copy-preview-rules">
          {Object.entries(substitutedGrammar.rules || {}).map(([key, productions]) => (
            <div key={key} className="rule-card">
              <div className="font-mono text-small">
                <strong className="text-gold">{key}</strong>
                <span className="text-muted"> {"\u2192"} </span>
                {productions.map((prod, i) => (
                  <span key={i}>
                    <span className="text-light">{prod.join(" ")}</span>
                    {i < productions.length - 1 && <span className="text-muted"> | </span>}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="viewer-section">
        <h4>Sample Names</h4>
        <GrammarPreview
          grammar={substitutedGrammar}
          domains={domainsForPreview}
          lexemeLists={lexemeListsForPreview}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main modal component                                               */
/* ------------------------------------------------------------------ */

export function CopyGrammarModal({
  cultureId,
  cultureConfig,
  allCultures,
  existingGrammarIds,
  onCopy,
  onClose,
}: CopyGrammarModalProps) {
  const [selectedCulture, setSelectedCulture] = useState<string | null>(null);
  const [selectedGrammar, setSelectedGrammar] = useState<string | null>(null);
  const [newGrammarId, setNewGrammarId] = useState("");
  const [substitutedGrammar, setSubstitutedGrammar] = useState<GrammarRule | null>(null);
  const [dependencies, setDependencies] = useState<Dependencies>({ missing: [], existing: [] });
  const [selectedDeps, setSelectedDeps] = useState<Set<string>>(new Set());

  const otherCultures = useMemo(
    () =>
      Object.entries(allCultures || {})
        .filter(([id]) => id !== cultureId)
        .map(([id, config]) => ({
          id,
          name: config.name || id,
          grammars: (config.naming?.grammars || []) as GrammarRule[],
        })),
    [allCultures, cultureId],
  );

  // Compute substituted grammar and dependencies from selection
  useEffect(() => {
    if (!selectedGrammar || !selectedCulture) {
      setSubstitutedGrammar(null);
      setDependencies({ missing: [], existing: [] });
      setSelectedDeps(new Set());
      return;
    }

    const sourceCulture = allCultures[selectedCulture];
    const sourceGrammar = sourceCulture?.naming?.grammars?.find(
      (g) => g.id === selectedGrammar,
    ) as GrammarRule | undefined;
    if (!sourceGrammar) return;

    const targetLexemes = Object.keys(cultureConfig?.naming?.lexemeLists || {});
    const sourceLexemes = sourceCulture?.naming?.lexemeLists || {};
    const deps = computeDependencies(sourceGrammar, sourceLexemes as Record<string, LexemeList>, targetLexemes);

    setDependencies(deps);
    setSelectedDeps(new Set(deps.missing.map((d) => d.sourceId)));

    const substituted = substituteGrammarReferences(
      sourceGrammar,
      sourceCulture,
      cultureConfig,
      cultureId,
    );
    const finalId = generateUniqueId(cultureId, sourceGrammar.id, existingGrammarIds);

    setNewGrammarId(finalId);
    setSubstitutedGrammar({ ...substituted, id: finalId });
  }, [selectedGrammar, selectedCulture, allCultures, cultureConfig, cultureId, existingGrammarIds]);

  const handleCultureChange = useCallback(
    (id: string | null) => {
      setSelectedCulture(id);
      setSelectedGrammar(null);
    },
    [],
  );

  const toggleDep = useCallback((sourceId: string) => {
    setSelectedDeps((prev) => {
      const next = new Set(prev);
      if (next.has(sourceId)) {
        next.delete(sourceId);
      } else {
        next.add(sourceId);
      }
      return next;
    });
  }, []);

  const handleCopy = useCallback(() => {
    if (!substitutedGrammar || !selectedCulture) return;

    const copiedLexemeLists: Record<string, LexemeList> = {};
    const sourceCulture = allCultures[selectedCulture];
    const existingListIds = Object.keys(cultureConfig?.naming?.lexemeLists || {});

    selectedDeps.forEach((sourceId) => {
      const sourceList = sourceCulture?.naming?.lexemeLists?.[sourceId];
      if (sourceList) {
        const newId = generateUniqueId(cultureId, sourceId, [
          ...existingListIds,
          ...Object.keys(copiedLexemeLists),
        ]);
        copiedLexemeLists[newId] = {
          ...sourceList,
          id: newId,
          description: sourceList.description
            ? `${sourceList.description} (copied from ${selectedCulture})`
            : `Copied from ${selectedCulture}`,
        };
      }
    });

    let finalGrammar: GrammarRule = { ...substitutedGrammar, id: newGrammarId };
    if (Object.keys(copiedLexemeLists).length > 0) {
      const idMapping: Record<string, string> = {};
      selectedDeps.forEach((sourceId) => {
        const suffix = sourceId.replace(/^[^_]+_/, "");
        const newId = Object.keys(copiedLexemeLists).find((k) => {
          const kSuffix = k.replace(/^[^_]+_/, "").replace(/_\d+$/, "");
          return kSuffix === suffix;
        });
        if (newId) idMapping[sourceId] = newId;
      });

      const newRules: Record<string, string[][]> = {};
      for (const [key, productions] of Object.entries(finalGrammar.rules || {})) {
        newRules[key] = productions.map((prod) =>
          prod.map((token) => applySlotIdMapping(token, idMapping)),
        );
      }
      finalGrammar = { ...finalGrammar, rules: newRules };
    }

    onCopy(finalGrammar, copiedLexemeLists);
  }, [substitutedGrammar, selectedCulture, allCultures, cultureConfig, cultureId, selectedDeps, newGrammarId, onCopy]);

  const selectedCultureGrammars = useMemo(
    () =>
      selectedCulture
        ? ((allCultures[selectedCulture]?.naming?.grammars || []) as GrammarRule[]).filter(
            (g) => Object.keys(g.rules || {}).length > 0,
          )
        : [],
    [selectedCulture, allCultures],
  );

  const footer = useMemo(
    () => (
      <>
        <button className="secondary" onClick={onClose}>
          Cancel
        </button>
        <button
          className="primary"
          onClick={handleCopy}
          disabled={!substitutedGrammar || !newGrammarId.trim()}
        >
          Copy Grammar
          {selectedDeps.size > 0 && (
            ` + ${selectedDeps.size} List${selectedDeps.size > 1 ? "s" : ""}`
          )}
        </button>
      </>
    ),
    [onClose, handleCopy, substitutedGrammar, newGrammarId, selectedDeps],
  );

  return (
    <ModalShell onClose={onClose} title="Copy Grammar from Another Culture" className="copy-modal" footer={footer}>
      <SourceSelection
        otherCultures={otherCultures}
        selectedCulture={selectedCulture}
        selectedGrammar={selectedGrammar}
        selectedCultureGrammars={selectedCultureGrammars}
        onCultureChange={handleCultureChange}
        onGrammarChange={setSelectedGrammar}
      />

      {substitutedGrammar && (
        <CopyPreview
          substitutedGrammar={substitutedGrammar}
          newGrammarId={newGrammarId}
          dependencies={dependencies}
          selectedDeps={selectedDeps}
          cultureConfig={cultureConfig}
          onNewGrammarIdChange={setNewGrammarId}
          onToggleDep={toggleDep}
        />
      )}
    </ModalShell>
  );
}

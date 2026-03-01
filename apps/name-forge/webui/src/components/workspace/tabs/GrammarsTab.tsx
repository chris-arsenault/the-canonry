import React, { useState, useEffect, useRef, useCallback, useMemo, useReducer } from "react";
import { ErrorMessage, useExpandBoolean } from "@the-canonry/shared-components";
import { MARKOV_MODELS, CONTEXT_KEYS, COMMON_LITERALS, GRAMMAR_MODIFIERS } from "../../constants";
import { previewGrammarNames } from "../../../lib/browser-generator";
import { CopyGrammarModal } from "./CopyGrammarModal";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GrammarRule {
  [key: string]: string[][];
}

interface Grammar {
  id: string;
  start: string;
  capitalization?: string;
  rules: GrammarRule;
}

interface DomainMorphology {
  prefixes?: string[];
  suffixes?: string[];
}

interface Domain {
  id: string;
  morphology?: DomainMorphology;
}

interface CultureConfig {
  naming?: {
    grammars?: Grammar[];
    lexemeLists?: Record<string, unknown>;
    domains?: Domain[];
  };
}

interface GrammarsTabProps {
  cultureId: string;
  cultureConfig: CultureConfig;
  onGrammarsChange: (grammars: Grammar[]) => void;
  onLexemesChange?: (
    lists: Record<string, unknown>,
    arg2: undefined,
    grammars: Grammar[],
  ) => void;
  allCultures?: Record<string, CultureConfig>;
}

interface InsertItem {
  code: string;
  title: string;
}

interface ClickToInsertSectionProps {
  title: string;
  subtitle?: string;
  items: InsertItem[];
  onInsert: (text: string) => void;
  variant?: string;
}

interface DomainInsertSectionProps {
  domain: Domain;
  onInsert: (text: string) => void;
}

interface InsertCallbackProps {
  onInsert: (text: string) => void;
}

interface GrammarHelpModalProps {
  onClose: () => void;
}

interface GrammarPreviewProps {
  grammar: Grammar;
  domains: Domain[];
  lexemeLists: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build the set of grammar IDs to replace during save, and perform the save. */
function performAutosave(
  formData: Grammar,
  editingGrammar: string,
  grammars: Grammar[],
  onGrammarsChange: (grammars: Grammar[]) => void,
  lastSavedIdRef: React.MutableRefObject<string | null>,
  lastSavedFormDataRef: React.MutableRefObject<string | null>,
  formDataStr: string,
): void {
  if (!formData.id.trim()) return;

  const idsToRemove = new Set([formData.id]);
  if (lastSavedIdRef.current) idsToRemove.add(lastSavedIdRef.current);
  if (editingGrammar !== "new") idsToRemove.add(editingGrammar);

  const newGrammars = [...grammars.filter((g) => !idsToRemove.has(g.id)), formData];
  onGrammarsChange(newGrammars);
  lastSavedFormDataRef.current = formDataStr;
  lastSavedIdRef.current = formData.id;
}

const CAPITALIZATION_EXAMPLES: Record<string, string> = {
  titleWords: '"King Of North"',
  title: '"King of north"',
  allcaps: '"KING OF NORTH"',
  lowercase: '"king of north"',
  mixed: '"KiNg Of NoRtH"',
};

function getCapitalizationExample(cap: string | undefined): string {
  if (!cap) return "unchanged";
  return CAPITALIZATION_EXAMPLES[cap] || "unchanged";
}

// ---------------------------------------------------------------------------
// InsertChip - accessible clickable code chip (replaces <code role="button">)
// ---------------------------------------------------------------------------

interface InsertChipProps {
  code: string;
  title: string;
  className: string;
  onInsert: (text: string) => void;
}

function InsertChip({ code, title, className, onInsert }: InsertChipProps) {
  const handleClick = useCallback(() => onInsert(code), [onInsert, code]);
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onInsert(code);
      }
    },
    [onInsert, code],
  );

  return (
    <button
      type="button"
      className={className}
      onClick={handleClick}
      title={title}
      onKeyDown={handleKeyDown}
    >
      {code}
    </button>
  );
}

// ---------------------------------------------------------------------------
// GrammarsTab (main component)
// ---------------------------------------------------------------------------

function GrammarsTab({ cultureId, cultureConfig, onGrammarsChange, onLexemesChange, allCultures }: GrammarsTabProps) {
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [editingGrammar, setEditingGrammar] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [showCopyModal, setShowCopyModal] = useState(false);

  const naming = cultureConfig?.naming || {};
  const grammars = naming.grammars || [];
  const lexemeLists = naming.lexemeLists || {};
  const domains = naming.domains || [];

  const handleShowHelp = useCallback(() => setShowHelp(true), []);
  const handleCloseHelp = useCallback(() => setShowHelp(false), []);
  const handleShowCopy = useCallback(() => setShowCopyModal(true), []);
  const handleCloseCopy = useCallback(() => setShowCopyModal(false), []);

  const handleDelete = useCallback(
    (id: string) => {
      const newGrammars = grammars.filter((g) => g.id !== id);
      onGrammarsChange(newGrammars);
    },
    [grammars, onGrammarsChange],
  );

  const handleEdit = useCallback((grammar: Grammar) => {
    setEditingGrammar(grammar.id);
    setMode("edit");
  }, []);

  const handleAddNew = useCallback(() => {
    setEditingGrammar("new");
    setMode("edit");
  }, []);

  const handleCopy = useCallback(
    (copiedGrammar: Grammar, copiedLexemeLists: Record<string, unknown> | null) => {
      const newGrammars = [...grammars, copiedGrammar];
      if (copiedLexemeLists && Object.keys(copiedLexemeLists).length > 0 && onLexemesChange) {
        const updatedLists = { ...lexemeLists, ...copiedLexemeLists };
        onLexemesChange(updatedLists, undefined, newGrammars);
      } else {
        onGrammarsChange(newGrammars);
      }
      setShowCopyModal(false);
    },
    [grammars, lexemeLists, onGrammarsChange, onLexemesChange],
  );

  const existingGrammarIds = useMemo(() => grammars.map((g) => g.id), [grammars]);

  // View mode
  if (mode === "view") {
    return (
      <div>
        <div className="tab-header">
          <h3 className="mt-0">Context-Free Grammars</h3>
          <div className="flex gap-sm">
            <button className="secondary" onClick={handleShowHelp}>
              ? Help
            </button>
            {allCultures && Object.keys(allCultures).length > 1 && (
              <button className="secondary" onClick={handleShowCopy}>
                Copy from...
              </button>
            )}
            <button className="primary" onClick={handleAddNew}>
              + New Grammar
            </button>
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
              <GrammarCard
                key={grammar.id}
                grammar={grammar}
                domains={domains}
                lexemeLists={lexemeLists}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}

        {showHelp && <GrammarHelpModal onClose={handleCloseHelp} />}
        {showCopyModal && (
          <CopyGrammarModal
            cultureId={cultureId}
            cultureConfig={cultureConfig}
            allCultures={allCultures}
            existingGrammarIds={existingGrammarIds}
            onCopy={handleCopy}
            onClose={handleCloseCopy}
          />
        )}
      </div>
    );
  }

  // Edit mode
  return (
    <GrammarEditForm
      cultureId={cultureId}
      editingGrammar={editingGrammar!}
      initialGrammar={editingGrammar === "new" ? null : grammars.find((g) => g.id === editingGrammar) || null}
      grammars={grammars}
      lexemeLists={lexemeLists}
      domains={domains}
      onGrammarsChange={onGrammarsChange}
      onCancel={() => {
        setMode("view");
        setEditingGrammar(null);
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// GrammarCard - view-mode card for a single grammar
// ---------------------------------------------------------------------------

interface GrammarCardProps {
  grammar: Grammar;
  domains: Domain[];
  lexemeLists: Record<string, unknown>;
  onEdit: (grammar: Grammar) => void;
  onDelete: (id: string) => void;
}

function GrammarCard({ grammar, domains, lexemeLists, onEdit, onDelete }: GrammarCardProps) {
  const handleEdit = useCallback(() => onEdit(grammar), [onEdit, grammar]);
  const handleDelete = useCallback(() => onDelete(grammar.id), [onDelete, grammar.id]);

  return (
    <div className="grammar-card">
      <div className="flex justify-between align-start">
        <div>
          <strong>{grammar.id}</strong>
          <div className="text-small text-muted mt-xs">
            Start: <code>{grammar.start}</code> •{" "}
            {Object.keys(grammar.rules || {}).length} rules
            {grammar.capitalization && (
              <>
                {" "}
                • Case: <code>{grammar.capitalization}</code>
              </>
            )}
          </div>
        </div>
        <div className="flex gap-sm">
          <button className="secondary text-small" onClick={handleEdit}>
            Edit
          </button>
          <button className="danger text-small" onClick={handleDelete}>
            Delete
          </button>
        </div>
      </div>
      <GrammarPreview grammar={grammar} domains={domains} lexemeLists={lexemeLists} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// GrammarEditForm - encapsulates the entire edit-mode UI
// ---------------------------------------------------------------------------

interface GrammarEditFormProps {
  cultureId: string;
  editingGrammar: string;
  initialGrammar: Grammar | null;
  grammars: Grammar[];
  lexemeLists: Record<string, unknown>;
  domains: Domain[];
  onGrammarsChange: (grammars: Grammar[]) => void;
  onCancel: () => void;
}

function GrammarEditForm({
  cultureId,
  editingGrammar,
  initialGrammar,
  grammars,
  lexemeLists,
  domains,
  onGrammarsChange,
  onCancel,
}: GrammarEditFormProps) {
  const [formData, setFormData] = useState<Grammar>(
    initialGrammar || {
      id: `${cultureId}_grammar`,
      start: "name",
      capitalization: "",
      rules: {},
    },
  );
  const [newRuleKey, setNewRuleKey] = useState("");
  const [newRuleValue, setNewRuleValue] = useState("");
  const [editingRuleKey, setEditingRuleKey] = useState<string | null>(null);

  // Autosave refs
  const autosaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedFormDataRef = useRef<string | null>(null);
  const lastSavedIdRef = useRef<string | null>(null);

  // Autosave effect
  useEffect(() => {
    const formDataStr = JSON.stringify(formData);
    if (formDataStr === lastSavedFormDataRef.current) return;

    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
    }

    autosaveTimeoutRef.current = setTimeout(() => {
      performAutosave(formData, editingGrammar, grammars, onGrammarsChange, lastSavedIdRef, lastSavedFormDataRef, formDataStr);
    }, 1000);

    return () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }
    };
  }, [formData, editingGrammar, grammars, onGrammarsChange]);

  const handleAddRule = useCallback(() => {
    if (!newRuleKey.trim() || !newRuleValue.trim()) return;

    const newProductions = newRuleValue
      .split("|")
      .map((p) =>
        p
          .trim()
          .split(/\s+/)
          .filter((s) => s),
      )
      .filter((p) => p.length > 0);

    if (editingRuleKey) {
      const newRules = { ...formData.rules };
      if (editingRuleKey !== newRuleKey) {
        delete newRules[editingRuleKey];
      }
      newRules[newRuleKey] = newProductions;
      setFormData({ ...formData, rules: newRules });
      setEditingRuleKey(null);
    } else {
      const existingProductions = formData.rules[newRuleKey] || [];
      const mergedProductions = [...existingProductions, ...newProductions];
      setFormData({
        ...formData,
        rules: {
          ...formData.rules,
          [newRuleKey]: mergedProductions,
        },
      });
    }
    setNewRuleKey("");
    setNewRuleValue("");
  }, [newRuleKey, newRuleValue, editingRuleKey, formData]);

  const handleEditRule = useCallback(
    (key: string) => {
      const productions = formData.rules[key] || [];
      const valueStr = productions.map((p) => p.join(" ")).join(" | ");
      setNewRuleKey(key);
      setNewRuleValue(valueStr);
      setEditingRuleKey(key);
    },
    [formData.rules],
  );

  const handleCancelEdit = useCallback(() => {
    setNewRuleKey("");
    setNewRuleValue("");
    setEditingRuleKey(null);
  }, []);

  const handleDeleteRule = useCallback(
    (key: string) => {
      const newRules = { ...formData.rules };
      delete newRules[key];
      setFormData({ ...formData, rules: newRules });
    },
    [formData],
  );

  const handleSave = useCallback(() => {
    if (!formData.id.trim()) return;

    const idsToRemove = new Set([formData.id]);
    if (lastSavedIdRef.current) {
      idsToRemove.add(lastSavedIdRef.current);
    }
    if (editingGrammar !== "new") {
      idsToRemove.add(editingGrammar);
    }

    const newGrammars = [...grammars.filter((g) => !idsToRemove.has(g.id)), formData];
    onGrammarsChange(newGrammars);
    onCancel();
  }, [formData, editingGrammar, grammars, onGrammarsChange, onCancel]);

  const insertIntoRule = useCallback((text: string) => {
    setNewRuleValue((prev) => (prev ? `${prev} ${text}` : text));
  }, []);

  const handleIdChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, id: e.target.value }),
    [formData],
  );

  const handleStartChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, start: e.target.value }),
    [formData],
  );

  const handleCapChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) =>
      setFormData({ ...formData, capitalization: e.target.value || undefined }),
    [formData],
  );

  const handleRuleKeyChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setNewRuleKey(e.target.value),
    [],
  );

  const handleRuleValueChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setNewRuleValue(e.target.value),
    [],
  );

  const availableLexemeLists = useMemo(
    () =>
      Object.keys(lexemeLists).map((id) => ({
        code: `slot:${id}`,
        title: "Lexeme list",
      })),
    [lexemeLists],
  );

  const markovItems = useMemo(
    () =>
      MARKOV_MODELS.map(({ id, name, desc }: { id: string; name: string; desc: string }) => ({
        code: `markov:${id}`,
        title: `${name}: ${desc}`,
      })),
    [],
  );

  const commonLiteralItems = useMemo(
    () => COMMON_LITERALS.map((lit: string) => ({ code: lit, title: lit })),
    [],
  );

  return (
    <div>
      <div className="tab-header">
        <h3 className="mt-0">{editingGrammar === "new" ? "New Grammar" : "Edit Grammar"}</h3>
        <div className="flex gap-sm">
          <button className="primary" onClick={handleSave}>
            Save
          </button>
          <button className="secondary" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="grammar-id">Grammar ID</label>
        <input
          id="grammar-id"
          value={formData.id}
          onChange={handleIdChange}
          placeholder={`${cultureId}_grammar`}
        />
      </div>

      <div className="form-group">
        <label htmlFor="start-symbol">Start Symbol</label>
        <input
          id="start-symbol"
          value={formData.start}
          onChange={handleStartChange}
          placeholder="e.g., name, phrase, title"
        />
        <small className="text-muted">The entry point for name generation</small>
      </div>

      <div className="form-group">
        <label htmlFor="capitalization">Capitalization</label>
        <select
          id="capitalization"
          value={formData.capitalization || ""}
          onChange={handleCapChange}
        >
          <option value="">None</option>
          <option value="titleWords">Each Word Capitalized</option>
          <option value="title">First Letter Only</option>
          <option value="allcaps">ALL CAPS</option>
          <option value="lowercase">lowercase</option>
          <option value="mixed">MiXeD (alternating)</option>
        </select>
        <small className="text-muted">
          e.g., &quot;king of north&quot; →{" "}
          {getCapitalizationExample(formData.capitalization)}
        </small>
      </div>

      <h4 className="mt-lg mb-md">Production Rules</h4>

      {/* Current rules */}
      {Object.keys(formData.rules).length > 0 && (
        <div className="mb-md">
          {Object.entries(formData.rules).map(([key, productions]) => (
            <div key={key} className={`rule-card ${editingRuleKey === key ? "editing" : ""}`}>
              <div className="font-mono text-small flex-1">
                <strong className="text-gold">{key}</strong>
                <span className="text-muted"> → </span>
                {productions.map((prod, i) => (
                  <span key={i}>
                    <span className="text-light">{prod.join(" ")}</span>
                    {i < productions.length - 1 && <span className="text-muted"> | </span>}
                  </span>
                ))}
              </div>
              <div className="rule-actions">
                <button className="secondary btn-xs" onClick={() => handleEditRule(key)} title="Edit rule">
                  Edit
                </button>
                <button className="danger btn-xs" onClick={() => handleDeleteRule(key)} title="Delete rule">
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
            onChange={handleRuleKeyChange}
            placeholder="Non-terminal"
          />
          <span className="rule-arrow">→</span>
          <input
            className="flex-1"
            value={newRuleValue}
            onChange={handleRuleValueChange}
            placeholder="slot:lexeme_id | literal | other_nonterminal"
          />
          <button className="primary" onClick={handleAddRule}>
            {editingRuleKey ? "Update" : "Add"}
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
        {availableLexemeLists.length > 0 && (
          <ClickToInsertSection
            title="Lexeme Lists"
            items={availableLexemeLists}
            onInsert={insertIntoRule}
            variant="gold"
          />
        )}

        {domains.map((domain) => (
          <DomainInsertSection key={domain.id} domain={domain} onInsert={insertIntoRule} />
        ))}

        <ClickToInsertSection
          title="Markov Chain Models"
          subtitle="(statistically-generated names)"
          items={markovItems}
          onInsert={insertIntoRule}
          variant="purple"
        />

        <EntityLinkageSection onInsert={insertIntoRule} />

        <ClickToInsertSection
          title="Common Literals"
          items={commonLiteralItems}
          onInsert={insertIntoRule}
          variant="muted"
        />

        <ModifiersSection onInsert={insertIntoRule} />
      </CollapsiblePanel>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CollapsiblePanel - uses useExpandBoolean from shared hooks
// ---------------------------------------------------------------------------

interface CollapsiblePanelProps {
  title: string;
  defaultExpanded?: boolean;
  children: React.ReactNode;
}

function CollapsiblePanel({ title, defaultExpanded = true, children }: CollapsiblePanelProps) {
  const { expanded, toggle } = useExpandBoolean();
  const [initialized, setInitialized] = useState(false);

  // Set initial expanded state based on defaultExpanded prop
  useEffect(() => {
    if (!initialized) {
      if (defaultExpanded !== expanded) {
        toggle();
      }
      setInitialized(true);
    }
  }, [initialized, defaultExpanded, expanded, toggle]);

  return (
    <div className="collapsible-panel">
      <button
        type="button"
        onClick={toggle}
        className={`collapsible-header ${expanded ? "expanded" : ""}`}
      >
        <span>{title}</span>
        <span className={`collapsible-arrow ${expanded ? "expanded" : ""}`}>▼</span>
      </button>
      {expanded && <div className="collapsible-content">{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ClickToInsertSection
// ---------------------------------------------------------------------------

function ClickToInsertSection({ title, subtitle, items, onInsert, variant = "blue" }: ClickToInsertSectionProps) {
  return (
    <div className={`insert-panel ${variant}`}>
      <div className="insert-panel-title">
        <strong>{title}</strong> {subtitle && <span className="text-muted">{subtitle}</span>}
      </div>
      <div className="flex flex-wrap gap-sm">
        {items.map(({ code, title: itemTitle }) => (
          <InsertChip
            key={code}
            code={code}
            title={itemTitle}
            className={`insert-chip ${variant}`}
            onInsert={onInsert}
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DomainInsertSection
// ---------------------------------------------------------------------------

function DomainInsertSection({ domain, onInsert }: DomainInsertSectionProps) {
  return (
    <div className="insert-panel domain">
      <div className="insert-panel-title text-purple">
        <strong>Domain: {domain.id}</strong>
      </div>

      <div className="mb-sm">
        <InsertChip
          code={`domain:${domain.id}`}
          title="Generate phonotactic name from this domain"
          className="insert-chip gold domain-chip"
          onInsert={onInsert}
        />
        <span className="text-xs text-muted ml-sm">(generates phonotactic names)</span>
      </div>

      {domain.morphology?.prefixes && domain.morphology.prefixes.length > 0 && (
        <div className="mb-sm">
          <span className="text-xs text-muted">Prefixes: </span>
          {domain.morphology.prefixes.slice(0, 8).map((p, i) => (
            <InsertChip
              key={i}
              code={p}
              title={p}
              className="morph-chip"
              onInsert={onInsert}
            />
          ))}
        </div>
      )}

      {domain.morphology?.suffixes && domain.morphology.suffixes.length > 0 && (
        <div>
          <span className="text-xs text-muted">Suffixes: </span>
          {domain.morphology.suffixes.slice(0, 8).map((s, i) => (
            <InsertChip
              key={i}
              code={s}
              title={s}
              className="morph-chip"
              onInsert={onInsert}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// EntityLinkageSection
// ---------------------------------------------------------------------------

function EntityLinkageSection({ onInsert }: InsertCallbackProps) {
  return (
    <div className="insert-panel green">
      <div className="insert-panel-title text-green">
        <strong>Entity Linkage</strong> (uses related entity names from KG)
      </div>
      <div className="flex flex-wrap gap-sm mb-sm">
        {CONTEXT_KEYS.npcRelations.map(({ key, desc }: { key: string; desc: string }) => (
          <InsertChip
            key={key}
            code={`context:${key}`}
            title={desc}
            className="insert-chip green"
            onInsert={onInsert}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-sm">
        {CONTEXT_KEYS.locationFactionRelations.map(({ key, desc }: { key: string; desc: string }) => (
          <InsertChip
            key={key}
            code={`context:${key}`}
            title={desc}
            className="insert-chip green"
            onInsert={onInsert}
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ModifiersSection
// ---------------------------------------------------------------------------

interface ModifierEntry {
  code: string;
  desc: string;
}

function ModifiersSection({ onInsert }: InsertCallbackProps) {
  return (
    <div className="insert-panel cyan">
      <div className="insert-panel-title">
        <strong>Modifiers</strong> <span className="text-muted">(append to tokens)</span>
      </div>
      <div className="mb-sm">
        <span className="text-xs text-muted">Morphology (irregulars handled): </span>
        <div className="flex flex-wrap gap-sm mt-xs">
          {GRAMMAR_MODIFIERS.derivation.map(({ code, desc }: ModifierEntry) => (
            <InsertChip
              key={code}
              code={code}
              title={desc}
              className="insert-chip cyan"
              onInsert={onInsert}
            />
          ))}
        </div>
      </div>
      <div className="mb-sm">
        <span className="text-xs text-muted">Capitalization: </span>
        <div className="flex flex-wrap gap-sm mt-xs">
          {GRAMMAR_MODIFIERS.capitalization.map(({ code, desc }: ModifierEntry) => (
            <InsertChip
              key={code}
              code={code}
              title={desc}
              className="insert-chip cyan"
              onInsert={onInsert}
            />
          ))}
        </div>
      </div>
      <div>
        <span className="text-xs text-muted">Operators: </span>
        <div className="flex flex-wrap gap-sm mt-xs">
          {GRAMMAR_MODIFIERS.operators.map(({ code, desc }: ModifierEntry) => (
            <InsertChip
              key={code}
              code={code}
              title={desc}
              className="insert-chip cyan"
              onInsert={onInsert}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GrammarHelpModal
// ---------------------------------------------------------------------------

function GrammarHelpSyntaxSection() {
  return (
    <>
      <h4>Syntax</h4>
      <ul className="text-small">
        <li>
          <code>slot:id</code> - Lexeme list
        </li>
        <li>
          <code>domain:id</code> - Phonotactic name
        </li>
        <li>
          <code>markov:id</code> - Markov chain name
        </li>
        <li>
          <code>context:key</code> - Related entity name
        </li>
        <li>
          <code>^</code> - Join without space:
          <ul>
            <li>
              <code>domain:x^&apos;s</code> → &lt;domain&gt;&apos;s
            </li>
            <li>
              <code>^&apos;slot:x</code> → &apos;&lt;slot&gt;
            </li>
            <li>
              <code>domain:x^&apos;^slot:y</code> → &lt;domain&gt;&apos;&lt;slot&gt;
            </li>
          </ul>
        </li>
        <li>
          <code>~</code> - Per-token capitalization:
          <ul>
            <li>
              <code>~cap</code> / <code>~c</code> - Capitalized
            </li>
            <li>
              <code>~lower</code> / <code>~l</code> - lowercase
            </li>
            <li>
              <code>~upper</code> / <code>~u</code> - UPPERCASE
            </li>
            <li>
              <code>~title</code> / <code>~t</code> - Title Case
            </li>
          </ul>
          <div className="mt-xs">
            Example: <code>domain:x~cap domain:y~lower^&apos;^slot:z~cap</code>
          </div>
          <div>→ &quot;Capital lower&apos;Capital&quot;</div>
        </li>
        <li>
          <code>~</code> - Morphological derivations (transform words):
          <ul>
            <li>
              <code>~er</code> - Agentive: hunt → hunter, forge → forger
            </li>
            <li>
              <code>~est</code> - Superlative: deep → deepest, grim → grimmest
            </li>
            <li>
              <code>~comp</code> - Comparative: dark → darker, swift → swifter
            </li>
            <li>
              <code>~ing</code> - Gerund: burn → burning, forge → forging
            </li>
            <li>
              <code>~ed</code> - Past: curse → cursed, slay → slain
            </li>
            <li>
              <code>~poss</code> - Possessive: storm → storm&apos;s, darkness → darkness&apos;
            </li>
          </ul>
          <div className="mt-xs">
            Example: <code>slot:verbs~er</code> → &quot;Hunter&quot;
          </div>
          <div>
            Combine: <code>slot:adj~est~cap</code> → &quot;Deepest&quot;
          </div>
          <div className="text-muted mt-xs">
            Handles irregulars: break→broken, good→best, lie→liar
          </div>
        </li>
        <li>
          <code>|</code> - Alternatives
        </li>
      </ul>
    </>
  );
}

function GrammarHelpCapitalizationSection() {
  return (
    <>
      <h4>Capitalization</h4>
      <p className="text-small">Controls how the final generated name is formatted:</p>
      <ul className="text-small">
        <li>
          <strong>Each Word Capitalized</strong> - &quot;king of north&quot; → &quot;King Of North&quot;
        </li>
        <li>
          <strong>First Letter Only</strong> - &quot;king of north&quot; → &quot;King of north&quot;
        </li>
        <li>
          <strong>ALL CAPS / lowercase</strong> - Force case
        </li>
        <li>
          <strong>MiXeD</strong> - &quot;king of north&quot; → &quot;KiNg Of NoRtH&quot;
        </li>
      </ul>
    </>
  );
}

function GrammarHelpModal({ onClose }: GrammarHelpModalProps) {
  const mouseDownOnOverlay = useRef(false);

  const handleOverlayMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    mouseDownOnOverlay.current = e.target === e.currentTarget;
  }, []);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (mouseDownOnOverlay.current && e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose],
  );

  return (
    <div
      className="modal-overlay"
      onMouseDown={handleOverlayMouseDown}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label="Context-Free Grammar Help"
    >
      <div className="modal-content help-modal">
        <div className="tab-header mb-md">
          <h3 className="mt-0">Context-Free Grammars</h3>
          <button className="secondary" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="help-content">
          <p>CFGs define structured patterns for name generation.</p>

          <h4>Example</h4>
          <div className="code-block">
            <div>name → adj - noun</div>
            <div>adj → slot:adjectives</div>
            <div>noun → slot:nouns</div>
          </div>
          <p className="text-small">→ &quot;Swift-Scale&quot;, &quot;Dark-Fang&quot;</p>

          <GrammarHelpSyntaxSection />
          <GrammarHelpCapitalizationSection />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GrammarPreview - async preview with useReducer for async state
// ---------------------------------------------------------------------------

interface PreviewState {
  names: string[];
  pending: boolean;
  previewError: string | null;
}

type PreviewAction =
  | { type: "start" }
  | { type: "success"; names: string[] }
  | { type: "failure"; message: string }
  | { type: "reset" };

function previewReducer(state: PreviewState, action: PreviewAction): PreviewState {
  switch (action.type) {
    case "start":
      return { ...state, pending: true, previewError: null };
    case "success":
      return { names: action.names, pending: false, previewError: null };
    case "failure":
      return { names: [], pending: false, previewError: action.message };
    case "reset":
      return { names: [], pending: false, previewError: null };
  }
}

const PREVIEW_INITIAL_STATE: PreviewState = { names: [], pending: false, previewError: null };

function GrammarPreview({ grammar, domains, lexemeLists }: GrammarPreviewProps) {
  const [state, dispatch] = useReducer(previewReducer, PREVIEW_INITIAL_STATE);

  const hasRules = grammar.rules && Object.keys(grammar.rules).length > 0;

  // Generate preview names when grammar changes
  useEffect(() => {
    if (!hasRules) {
      dispatch({ type: "reset" });
      return;
    }

    let cancelled = false;
    dispatch({ type: "start" });

    previewGrammarNames({
      grammar,
      domains,
      lexemeLists,
      count: 6,
    })
      .then((result: string[]) => {
        if (!cancelled) {
          dispatch({ type: "success", names: result });
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          dispatch({ type: "failure", message: err.message });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [grammar, domains, lexemeLists, hasRules]);

  if (!hasRules) {
    return (
      <div className="grammar-preview empty">
        <span className="text-muted text-small">No rules defined</span>
      </div>
    );
  }

  if (state.pending) {
    return (
      <div className="grammar-preview">
        <span className="text-muted text-small">Generating...</span>
      </div>
    );
  }

  if (state.previewError) {
    return (
      <div className="grammar-preview">
        <ErrorMessage message={state.previewError} className="text-small" />
      </div>
    );
  }

  if (state.names.length === 0) {
    return (
      <div className="grammar-preview empty">
        <span className="text-muted text-small">Could not generate preview</span>
      </div>
    );
  }

  return (
    <div className="grammar-preview">
      <div className="grammar-preview-names">
        {state.names.map((name, i) => (
          <span key={i} className="grammar-preview-name">
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}

export default GrammarsTab;

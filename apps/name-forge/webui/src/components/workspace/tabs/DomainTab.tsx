import React, { useState, useCallback, useMemo } from "react";
import { NumberInput, useExpandSet, expandableProps } from "@the-canonry/shared-components";
import { getAllDomains } from "../../utils";
import PhonemeWeightGrid from "./PhonemeWeightGrid";
import "./DomainTab.css";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Phonology {
  consonants: string[];
  vowels: string[];
  syllableTemplates: string[];
  lengthRange: [number, number];
  favoredClusters: string[];
  forbiddenClusters: string[];
  favoredClusterBoost: number;
  consonantWeights?: number[];
  vowelWeights?: number[];
  templateWeights?: number[];
}

interface Morphology {
  prefixes: string[];
  suffixes: string[];
  structure: string[];
  structureWeights: number[];
}

interface Style {
  capitalization: string;
  apostropheRate: number;
  hyphenRate: number;
  preferredEndings: string[];
  preferredEndingBoost: number;
  rhythmBias: string;
}

interface Domain {
  id: string;
  cultureId: string;
  phonology: Phonology;
  morphology: Morphology;
  style: Style;
}

interface SourceDomain extends Domain {
  sourceCulture: string;
}

interface NamingConfig {
  domains?: Domain[];
}

interface CultureConfig {
  naming?: NamingConfig;
}

interface DomainTabProps {
  cultureId: string;
  cultureConfig: CultureConfig;
  allCultures: Record<string, CultureConfig>;
  onDomainsChange: (domains: Domain[]) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDefaultDomain(cultureId: string, count: number): Domain {
  return {
    id: `${cultureId}_domain_${count + 1}`,
    cultureId,
    phonology: {
      consonants: [],
      vowels: [],
      syllableTemplates: ["CV", "CVC"],
      lengthRange: [2, 4],
      favoredClusters: [],
      forbiddenClusters: [],
      favoredClusterBoost: 1.0,
    },
    morphology: {
      prefixes: [],
      suffixes: [],
      structure: ["root", "root-suffix"],
      structureWeights: [0.5, 0.5],
    },
    style: {
      capitalization: "title",
      apostropheRate: 0,
      hyphenRate: 0,
      preferredEndings: [],
      preferredEndingBoost: 1.0,
      rhythmBias: "neutral",
    },
  };
}

function splitWhitespace(value: string): string[] {
  return value.split(/\s+/).filter((s) => s);
}

// ---------------------------------------------------------------------------
// DomainListView - Shows domain cards when domains exist and not editing
// ---------------------------------------------------------------------------

function DomainListView({ cultureDomains, cultureId, onCreateNew, onCopy, onEdit, onDelete }: Readonly<{
  cultureDomains: Domain[];
  cultureId: string;
  onCreateNew: () => void;
  onCopy: (domain: Domain) => void;
  onEdit: (domain: Domain, index: number) => void;
  onDelete: (index: number) => void;
}>) {
  return (
    <div>
      <div className="tab-header">
        <h3>Phonological Domains ({cultureDomains.length})</h3>
        <button className="primary" onClick={onCreateNew}>
          + Add Domain
        </button>
      </div>

      <p className="text-muted tab-intro">
        Domains define the sound patterns for <strong>{cultureId}</strong> names. Reference them
        in grammars using <code>domain:domain_id</code>. Use the <strong>Optimizer</strong> tab to
        tune domain parameters.
      </p>

      <div className="grid gap-md">
        {cultureDomains.map((domain, index) => (
          <DomainCard
            key={domain.id}
            domain={domain}
            index={index}
            onCopy={onCopy}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DomainCard - single domain summary card in list view
// ---------------------------------------------------------------------------

function DomainCard({ domain, index, onCopy, onEdit, onDelete }: Readonly<{
  domain: Domain;
  index: number;
  onCopy: (domain: Domain) => void;
  onEdit: (domain: Domain, index: number) => void;
  onDelete: (index: number) => void;
}>) {
  const handleCopy = useCallback(() => onCopy(domain), [onCopy, domain]);
  const handleEdit = useCallback(() => onEdit(domain, index), [onEdit, domain, index]);
  const handleDelete = useCallback(() => onDelete(index), [onDelete, index]);

  return (
    <div className="domain-card">
      <div className="domain-card-header">
        <div>
          <strong className="domain-card-title">{domain.id}</strong>
          <div className="domain-card-hint">
            Use in grammars: <code>domain:{domain.id}</code>
          </div>
        </div>
        <div className="domain-card-actions">
          <button className="secondary icon-btn" onClick={handleCopy}>
            {"\uD83D\uDCCB"}
          </button>
          <button className="secondary icon-btn" onClick={handleEdit}>
            {"\u270F\uFE0F"}
          </button>
          <button className="secondary icon-btn danger" onClick={handleDelete}>
            {"\uD83D\uDDD1\uFE0F"}
          </button>
        </div>
      </div>

      <div className="domain-summary-grid">
        <div>
          <div>Phonology</div>
          <div>
            <div>
              C: {domain.phonology?.consonants?.slice(0, 5).join(" ") || "None"}
              {(domain.phonology?.consonants?.length ?? 0) > 5 ? "..." : ""}
            </div>
            <div>V: {domain.phonology?.vowels?.join(" ") || "None"}</div>
            <div>Syl: {domain.phonology?.syllableTemplates?.join(", ") || "CV, CVC"}</div>
          </div>
        </div>
        <div>
          <div>Morphology</div>
          <div>
            <div>Pre: {domain.morphology?.prefixes?.slice(0, 3).join(", ") || "None"}</div>
            <div>Suf: {domain.morphology?.suffixes?.slice(0, 3).join(", ") || "None"}</div>
          </div>
        </div>
        <div>
          <div>Style</div>
          <div>
            <div>Cap: {domain.style?.capitalization || "title"}</div>
            <div>Rhythm: {domain.style?.rhythmBias || "neutral"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EmptyDomainView - shown when no domains exist yet
// ---------------------------------------------------------------------------

function EmptyDomainView({ cultureId, allDomains, onCreateNew, onCopy }: Readonly<{
  cultureId: string;
  allDomains: SourceDomain[];
  onCreateNew: () => void;
  onCopy: (domain: Domain) => void;
}>) {
  const otherCultureDomains = useMemo(
    () => allDomains.filter((d) => d.sourceCulture !== cultureId).slice(0, 5),
    [allDomains, cultureId],
  );

  return (
    <div>
      <h3>Phonological Domains</h3>
      <p className="text-muted">
        Define the sound patterns and morphology for <strong>{cultureId}</strong> names.
      </p>

      <div className="empty-state-card">
        <p>No domains configured for this culture yet.</p>
        <button className="primary" onClick={onCreateNew}>
          + Create First Domain
        </button>
      </div>

      {otherCultureDomains.length > 0 && (
        <div className="dt-copy-from-panel">
          <h4>Copy from other cultures</h4>
          <div className="grid gap-sm">
            {otherCultureDomains.map((domain) => (
              <CopyDomainItem key={`${domain.sourceCulture}_${domain.id}`} domain={domain} onCopy={onCopy} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CopyDomainItem({ domain, onCopy }: Readonly<{
  domain: SourceDomain;
  onCopy: (domain: Domain) => void;
}>) {
  const handleCopy = useCallback(() => onCopy(domain), [onCopy, domain]);

  return (
    <div className="copy-item">
      <div>
        <strong>{domain.id}</strong>
        <div className="copy-item-meta">From culture: {domain.sourceCulture}</div>
      </div>
      <button className="secondary sm" onClick={handleCopy}>
        Copy &amp; Edit
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PhonologySection - phonology fields in editing form
// ---------------------------------------------------------------------------

function PhonologySection({ formData, setFormData }: Readonly<{
  formData: Domain;
  setFormData: React.Dispatch<React.SetStateAction<Domain>>;
}>) {
  const handleConsonantsBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      phonology: { ...prev.phonology, consonants: splitWhitespace(e.target.value) },
    }));
  }, [setFormData]);

  const handleVowelsBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      phonology: { ...prev.phonology, vowels: splitWhitespace(e.target.value) },
    }));
  }, [setFormData]);

  const handleSyllableBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      phonology: { ...prev.phonology, syllableTemplates: splitWhitespace(e.target.value) },
    }));
  }, [setFormData]);

  const handleMinLengthChange = useCallback((v: number | undefined) => {
    setFormData((prev) => ({
      ...prev,
      phonology: {
        ...prev.phonology,
        lengthRange: [v ?? 2, prev.phonology.lengthRange[1]],
      },
    }));
  }, [setFormData]);

  const handleMaxLengthChange = useCallback((v: number | undefined) => {
    setFormData((prev) => ({
      ...prev,
      phonology: {
        ...prev.phonology,
        lengthRange: [prev.phonology.lengthRange[0], v ?? 4],
      },
    }));
  }, [setFormData]);

  const handleFavoredBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      phonology: { ...prev.phonology, favoredClusters: splitWhitespace(e.target.value) },
    }));
  }, [setFormData]);

  const handleForbiddenBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      phonology: { ...prev.phonology, forbiddenClusters: splitWhitespace(e.target.value) },
    }));
  }, [setFormData]);

  return (
    <div className="form-grid-2">
      <div className="form-group">
        <label htmlFor="consonants-space-separated">Consonants (space-separated)</label>
        <input
          id="consonants-space-separated"
          defaultValue={formData.phonology.consonants.join(" ")}
          onBlur={handleConsonantsBlur}
          placeholder="l r th f n m v s"
        />
      </div>
      <div className="form-group">
        <label htmlFor="vowels-space-separated">Vowels (space-separated)</label>
        <input
          id="vowels-space-separated"
          defaultValue={formData.phonology.vowels.join(" ")}
          onBlur={handleVowelsBlur}
          placeholder="a e i o u ae"
        />
      </div>
      <div className="form-group">
        <label htmlFor="syllable-templates">Syllable Templates</label>
        <input
          id="syllable-templates"
          defaultValue={formData.phonology.syllableTemplates.join(" ")}
          onBlur={handleSyllableBlur}
          placeholder="CV CVC CVV"
        />
      </div>
      <div className="flex-row-responsive">
        <div className="form-group dt-flex-item">
          <label>Min Length
            <NumberInput
              value={formData.phonology.lengthRange[0]}
              onChange={handleMinLengthChange}
              integer
            />
          </label>
        </div>
        <div className="form-group dt-flex-item">
          <label>Max Length
            <NumberInput
              value={formData.phonology.lengthRange[1]}
              onChange={handleMaxLengthChange}
              integer
            />
          </label>
        </div>
      </div>
      <div className="form-group">
        <label htmlFor="favored-clusters-optional">Favored Clusters (optional)</label>
        <input
          id="favored-clusters-optional"
          defaultValue={formData.phonology.favoredClusters.join(" ")}
          onBlur={handleFavoredBlur}
          placeholder="th ae gr"
        />
      </div>
      <div className="form-group">
        <label htmlFor="forbidden-clusters-optional">Forbidden Clusters (optional)</label>
        <input
          id="forbidden-clusters-optional"
          defaultValue={formData.phonology.forbiddenClusters.join(" ")}
          onBlur={handleForbiddenBlur}
          placeholder="ii uu xx"
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MorphologySection - morphology fields in editing form
// ---------------------------------------------------------------------------

function MorphologySection({ formData, setFormData }: Readonly<{
  formData: Domain;
  setFormData: React.Dispatch<React.SetStateAction<Domain>>;
}>) {
  const handlePrefixesBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      morphology: { ...prev.morphology, prefixes: splitWhitespace(e.target.value) },
    }));
  }, [setFormData]);

  const handleSuffixesBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      morphology: { ...prev.morphology, suffixes: splitWhitespace(e.target.value) },
    }));
  }, [setFormData]);

  const handleStructureBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      morphology: {
        ...prev.morphology,
        structure: e.target.value.split(",").map((s) => s.trim()).filter((s) => s),
      },
    }));
  }, [setFormData]);

  const handleWeightsBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      morphology: {
        ...prev.morphology,
        structureWeights: e.target.value
          .split(",")
          .map((s) => parseFloat(s.trim()))
          .filter((n) => !isNaN(n)),
      },
    }));
  }, [setFormData]);

  return (
    <div className="form-grid-2">
      <div className="form-group">
        <label htmlFor="prefixes-space-separated">Prefixes (space-separated)</label>
        <input
          id="prefixes-space-separated"
          defaultValue={formData.morphology.prefixes.join(" ")}
          onBlur={handlePrefixesBlur}
          placeholder="Ael Ith Vor"
        />
      </div>
      <div className="form-group">
        <label htmlFor="suffixes-space-separated">Suffixes (space-separated)</label>
        <input
          id="suffixes-space-separated"
          defaultValue={formData.morphology.suffixes.join(" ")}
          onBlur={handleSuffixesBlur}
          placeholder="riel ion aen"
        />
      </div>
      <div className="form-group">
        <label htmlFor="structure-comma-separated">Structure (comma-separated)</label>
        <input
          id="structure-comma-separated"
          defaultValue={formData.morphology.structure.join(", ")}
          onBlur={handleStructureBlur}
          placeholder="root, root-suffix, prefix-root"
        />
      </div>
      <div className="form-group">
        <label htmlFor="structure-weights-comma-separated">Structure Weights (comma-separated)</label>
        <input
          id="structure-weights-comma-separated"
          defaultValue={formData.morphology.structureWeights.join(", ")}
          onBlur={handleWeightsBlur}
          placeholder="0.5, 0.3, 0.2"
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// StyleSection - style fields in editing form
// ---------------------------------------------------------------------------

function StyleSection({ formData, setFormData }: Readonly<{
  formData: Domain;
  setFormData: React.Dispatch<React.SetStateAction<Domain>>;
}>) {
  const handleCapChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setFormData((prev) => ({
      ...prev,
      style: { ...prev.style, capitalization: e.target.value },
    }));
  }, [setFormData]);

  const handleRhythmChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setFormData((prev) => ({
      ...prev,
      style: { ...prev.style, rhythmBias: e.target.value },
    }));
  }, [setFormData]);

  const handleApostropheChange = useCallback((v: number | undefined) => {
    setFormData((prev) => ({
      ...prev,
      style: { ...prev.style, apostropheRate: v ?? 0 },
    }));
  }, [setFormData]);

  const handleHyphenChange = useCallback((v: number | undefined) => {
    setFormData((prev) => ({
      ...prev,
      style: { ...prev.style, hyphenRate: v ?? 0 },
    }));
  }, [setFormData]);

  const handleEndingsBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      style: { ...prev.style, preferredEndings: splitWhitespace(e.target.value) },
    }));
  }, [setFormData]);

  const handleEndingBoostChange = useCallback((v: number | undefined) => {
    setFormData((prev) => ({
      ...prev,
      style: { ...prev.style, preferredEndingBoost: v ?? 1.0 },
    }));
  }, [setFormData]);

  return (
    <div className="form-grid-3">
      <div className="form-group">
        <label htmlFor="capitalization">Capitalization</label>
        <select id="capitalization" value={formData.style.capitalization} onChange={handleCapChange}>
          <option value="title">Title Case</option>
          <option value="lower">lowercase</option>
          <option value="upper">UPPERCASE</option>
          <option value="mixed">MiXeD</option>
        </select>
      </div>
      <div className="form-group">
        <label htmlFor="rhythm-bias">Rhythm Bias</label>
        <select id="rhythm-bias" value={formData.style.rhythmBias} onChange={handleRhythmChange}>
          <option value="neutral">Neutral</option>
          <option value="flowing">Flowing</option>
          <option value="harsh">Harsh</option>
          <option value="staccato">Staccato</option>
        </select>
      </div>
      <div className="form-group">
        <label>Apostrophe Rate
          <NumberInput
            step={0.05}
            min={0}
            max={1}
            value={formData.style.apostropheRate}
            onChange={handleApostropheChange}
          />
        </label>
      </div>
      <div className="form-group">
        <label>Hyphen Rate
          <NumberInput
            step={0.05}
            min={0}
            max={1}
            value={formData.style.hyphenRate}
            onChange={handleHyphenChange}
          />
        </label>
      </div>
      <div className="form-group">
        <label htmlFor="preferred-endings">Preferred Endings</label>
        <input
          id="preferred-endings"
          defaultValue={formData.style.preferredEndings.join(" ")}
          onBlur={handleEndingsBlur}
          placeholder="iel ion riel"
        />
      </div>
      <div className="form-group">
        <label>Ending Boost
          <NumberInput
            step={0.1}
            value={formData.style.preferredEndingBoost}
            onChange={handleEndingBoostChange}
          />
        </label>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// WeightsSection - advanced phoneme weight tuning
// ---------------------------------------------------------------------------

function WeightsSection({ formData, setFormData }: Readonly<{
  formData: Domain;
  setFormData: React.Dispatch<React.SetStateAction<Domain>>;
}>) {
  const consonantItems = useMemo(() => formData.phonology.consonants, [formData.phonology.consonants]);
  const consonantWeights = useMemo(() => formData.phonology.consonantWeights ?? [], [formData.phonology.consonantWeights]);
  const vowelItems = useMemo(() => formData.phonology.vowels, [formData.phonology.vowels]);
  const vowelWeights = useMemo(() => formData.phonology.vowelWeights ?? [], [formData.phonology.vowelWeights]);
  const templateItems = useMemo(() => formData.phonology.syllableTemplates, [formData.phonology.syllableTemplates]);
  const templateWeights = useMemo(() => formData.phonology.templateWeights ?? [], [formData.phonology.templateWeights]);

  const handleConsonantWeights = useCallback((newWeights: number[]) => {
    setFormData((prev) => ({
      ...prev,
      phonology: { ...prev.phonology, consonantWeights: newWeights },
    }));
  }, [setFormData]);

  const handleVowelWeights = useCallback((newWeights: number[]) => {
    setFormData((prev) => ({
      ...prev,
      phonology: { ...prev.phonology, vowelWeights: newWeights },
    }));
  }, [setFormData]);

  const handleTemplateWeights = useCallback((newWeights: number[]) => {
    setFormData((prev) => ({
      ...prev,
      phonology: { ...prev.phonology, templateWeights: newWeights },
    }));
  }, [setFormData]);

  const handleClusterBoost = useCallback((v: number | undefined) => {
    setFormData((prev) => ({
      ...prev,
      phonology: { ...prev.phonology, favoredClusterBoost: v ?? 1.0 },
    }));
  }, [setFormData]);

  return (
    <>
      <p className="text-muted mb-md">
        Fine-tune phoneme selection probabilities. Higher weights = more likely to appear.
        Default is 1.0 for all.
      </p>

      <PhonemeWeightGrid
        label="Consonant Weights"
        items={consonantItems}
        weights={consonantWeights}
        onChange={handleConsonantWeights}
      />

      <PhonemeWeightGrid
        label="Vowel Weights"
        items={vowelItems}
        weights={vowelWeights}
        onChange={handleVowelWeights}
      />

      <PhonemeWeightGrid
        label="Template Weights"
        items={templateItems}
        weights={templateWeights}
        onChange={handleTemplateWeights}
      />

      <div className="form-group mt-md">
        <label>Favored Cluster Boost
          <NumberInput
            step={0.1}
            min={1.0}
            max={5.0}
            value={formData.phonology.favoredClusterBoost}
            onChange={handleClusterBoost}
          />
        </label>
        <small className="text-muted">
          Multiplier applied to favored clusters (defined in Phonology section). Default: 1.0
        </small>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// CollapsibleFormSection - generic expandable section wrapper
// ---------------------------------------------------------------------------

function CollapsibleFormSection({ id, title, expanded, onToggle, children }: Readonly<{
  id: string;
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}>) {
  return (
    <div className="viewer-section dt-form-panel">
      <div className="dt-collapsible-trigger" {...expandableProps(onToggle)}>
        <h4>{title}</h4>
        <span>{expanded ? "\u25BC" : "\u25B6"}</span>
      </div>
      {expanded && (
        <div className="dt-collapsible-body" id={id}>
          {children}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DomainEditForm - the full editing form
// ---------------------------------------------------------------------------

function DomainEditForm({ formData, setFormData, editingIndex, cultureId, expanded, onToggle, onSave, onCancel }: Readonly<{
  formData: Domain;
  setFormData: React.Dispatch<React.SetStateAction<Domain>>;
  editingIndex: number;
  cultureId: string;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onSave: () => void;
  onCancel: () => void;
}>) {
  const handleIdChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormData((prev) => ({ ...prev, id: e.target.value }));
    },
    [setFormData],
  );

  return (
    <div>
      <div className="tab-header">
        <h3>{editingIndex >= 0 ? "Edit Domain" : "Create Domain"}</h3>
        <div className="flex gap-sm">
          <button className="primary" onClick={onSave}>
            Save
          </button>
          <button className="secondary" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>

      <div className="form-group mb-md">
        <label htmlFor="domain-id">Domain ID</label>
        <input
          id="domain-id"
          value={formData.id}
          onChange={handleIdChange}
          placeholder={`${cultureId}_domain`}
        />
        <small className="text-muted">
          Unique identifier for this domain. Use in grammars as{" "}
          <code>domain:{formData.id || "domain_id"}</code>
        </small>
      </div>

      <CollapsibleFormSection
        id="phonology-section"
        title="Phonology"
        expanded={expanded.has("phonology")}
        onToggle={() => onToggle("phonology")}
      >
        <PhonologySection formData={formData} setFormData={setFormData} />
      </CollapsibleFormSection>

      <CollapsibleFormSection
        id="morphology-section"
        title="Morphology"
        expanded={expanded.has("morphology")}
        onToggle={() => onToggle("morphology")}
      >
        <MorphologySection formData={formData} setFormData={setFormData} />
      </CollapsibleFormSection>

      <CollapsibleFormSection
        id="style-section"
        title="Style"
        expanded={expanded.has("style")}
        onToggle={() => onToggle("style")}
      >
        <StyleSection formData={formData} setFormData={setFormData} />
      </CollapsibleFormSection>

      <CollapsibleFormSection
        id="weights-section"
        title="Weights (Advanced Tuning)"
        expanded={expanded.has("weights")}
        onToggle={() => onToggle("weights")}
      >
        <WeightsSection formData={formData} setFormData={setFormData} />
      </CollapsibleFormSection>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DomainTab - main component
// ---------------------------------------------------------------------------

function DomainTab({ cultureId, cultureConfig, allCultures, onDomainsChange }: Readonly<DomainTabProps>) {
  const [editing, setEditing] = useState(false);
  const [editingIndex, setEditingIndex] = useState(-1);
  const { expanded, toggle: toggleSection, set: setExpanded } = useExpandSet();

  const cultureDomains = useMemo(
    () => cultureConfig?.naming?.domains ?? [],
    [cultureConfig],
  );

  const allDomains = useMemo(
    () => getAllDomains(allCultures) as SourceDomain[],
    [allCultures],
  );

  const [formData, setFormData] = useState<Domain>(() => makeDefaultDomain(cultureId, 0));

  const handleSave = useCallback(() => {
    let newDomains: Domain[];
    if (editingIndex >= 0) {
      newDomains = [...cultureDomains];
      newDomains[editingIndex] = formData;
    } else {
      newDomains = [...cultureDomains, formData];
    }
    onDomainsChange(newDomains);
    setEditing(false);
    setEditingIndex(-1);
  }, [editingIndex, cultureDomains, formData, onDomainsChange]);

  const handleCreateNew = useCallback(() => {
    setFormData(makeDefaultDomain(cultureId, cultureDomains.length));
    setEditingIndex(-1);
    setEditing(true);
    setExpanded(new Set(["phonology"]));
  }, [cultureId, cultureDomains.length, setExpanded]);

  const handleEditDomain = useCallback((domain: Domain, index: number) => {
    setFormData({ ...domain });
    setEditingIndex(index);
    setEditing(true);
    setExpanded(new Set(["phonology"]));
  }, [setExpanded]);

  const handleDeleteDomain = useCallback((index: number) => {
    if (!window.confirm("Delete this domain? This cannot be undone.")) return;
    const newDomains = cultureDomains.filter((_, i) => i !== index);
    onDomainsChange(newDomains);
  }, [cultureDomains, onDomainsChange]);

  const handleCopyDomain = useCallback((domain: Domain) => {
    setFormData({ ...domain, id: `${domain.id}_copy` });
    setEditingIndex(-1);
    setEditing(true);
    setExpanded(new Set(["phonology"]));
  }, [setExpanded]);

  const handleCancel = useCallback(() => {
    setEditing(false);
    setEditingIndex(-1);
  }, []);

  if (editing) {
    return (
      <DomainEditForm
        formData={formData}
        setFormData={setFormData}
        editingIndex={editingIndex}
        cultureId={cultureId}
        expanded={expanded}
        onToggle={toggleSection}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    );
  }

  if (cultureDomains.length > 0) {
    return (
      <DomainListView
        cultureDomains={cultureDomains}
        cultureId={cultureId}
        onCreateNew={handleCreateNew}
        onCopy={handleCopyDomain}
        onEdit={handleEditDomain}
        onDelete={handleDeleteDomain}
      />
    );
  }

  return (
    <EmptyDomainView
      cultureId={cultureId}
      allDomains={allDomains}
      onCreateNew={handleCreateNew}
      onCopy={handleCopyDomain}
    />
  );
}

export default DomainTab;

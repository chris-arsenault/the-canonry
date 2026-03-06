/**
 * GraphContagionTab - Configuration for graph contagion systems
 */
import React, { useCallback, useMemo } from "react";
import { DIRECTIONS } from "../constants";
import { ReferenceDropdown, NumberInput, LocalTextArea } from "../../shared";
import TagSelector from "@the-canonry/shared-components/TagSelector";

// -- Interfaces ---------------------------------------------------------------
interface RelationshipKindDef { kind: string; description?: string }
interface TagDefinition { key: string; label?: string; description?: string; category?: string }
interface DomainSchema { relationshipKinds?: RelationshipKindDef[]; tagRegistry?: TagDefinition[] }
interface DropdownOption { value: string; label: string }
interface ContagionConfig { type?: string; relationshipKind?: string; tagPattern?: string }
interface TransmissionConfig { baseRate?: number; contactMultiplier?: number; maxProbability?: number }
interface InfectionActionConfig {
  type?: string; kind?: string; src?: string; dst?: string;
  strength?: number; bidirectional?: boolean; entity?: string; tag?: string; value?: string;
}
interface Vector { relationshipKind: string; direction: string; minStrength: number }
interface SystemConfig {
  contagion?: ContagionConfig; transmission?: TransmissionConfig;
  infectionAction?: InfectionActionConfig; vectors?: Vector[]; narrationTemplate?: string;
}
interface System { config: SystemConfig; [key: string]: unknown }

// -- Static option arrays -----------------------------------------------------
const CONTAGION_TYPE_OPTIONS: DropdownOption[] = [
  { value: "relationship", label: "Relationship" },
  { value: "tag", label: "Tag" },
];
const INFECTION_ACTION_TYPE_OPTIONS: DropdownOption[] = [
  { value: "create_relationship", label: "Create Relationship" },
  { value: "set_tag", label: "Set Tag" },
];
const ENTITY_REF_OPTIONS: DropdownOption[] = [
  { value: "$self", label: "$self" },
  { value: "$source", label: "$source" },
  { value: "$contagion_source", label: "$contagion_source" },
];

// -- ContagionSourceSection ---------------------------------------------------
function ContagionSourceSection({
  contagion, onUpdateContagion, relationshipKindOptions,
}: Readonly<{
  contagion: ContagionConfig | undefined;
  onUpdateContagion: (field: string, value: unknown) => void;
  relationshipKindOptions: DropdownOption[];
}>) {
  const handleType = useCallback(
    (v: string | undefined) => onUpdateContagion("type", v), [onUpdateContagion]);
  const handleRelKind = useCallback(
    (v: string | undefined) => onUpdateContagion("relationshipKind", v), [onUpdateContagion]);
  const handleTagPattern = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onUpdateContagion("tagPattern", e.target.value),
    [onUpdateContagion]);
  return (
    <div className="section">
      <div className="section-title">Contagion Source</div>
      <div className="section-desc">What is being spread through the network.</div>
      <div className="form-grid">
        <ReferenceDropdown label="Type" value={contagion?.type || "relationship"}
          onChange={handleType} options={CONTAGION_TYPE_OPTIONS} />
        {contagion?.type === "relationship" && (
          <ReferenceDropdown label="Relationship Kind" value={contagion?.relationshipKind}
            onChange={handleRelKind} options={relationshipKindOptions} />
        )}
        {contagion?.type === "tag" && (
          <div className="form-group">
            <label htmlFor="tag" className="label">Tag</label>
            <input id="tag" type="text" value={contagion?.tagPattern || ""}
              onChange={handleTagPattern} className="input" />
          </div>
        )}
      </div>
    </div>
  );
}

// -- VectorCard ---------------------------------------------------------------
function VectorCard({
  vector, index, onUpdateVector, onRemoveVector, relationshipKindOptions,
}: Readonly<{
  vector: Vector; index: number;
  onUpdateVector: (index: number, field: string, value: unknown) => void;
  onRemoveVector: (index: number) => void;
  relationshipKindOptions: DropdownOption[];
}>) {
  const handleRelKind = useCallback(
    (v: string | undefined) => onUpdateVector(index, "relationshipKind", v), [onUpdateVector, index]);
  const handleDir = useCallback(
    (v: string | undefined) => onUpdateVector(index, "direction", v), [onUpdateVector, index]);
  const handleStrength = useCallback(
    (v: number | undefined) => onUpdateVector(index, "minStrength", v), [onUpdateVector, index]);
  const handleRemove = useCallback(() => onRemoveVector(index), [onRemoveVector, index]);
  return (
    <div className="item-card">
      <div className="p-xl">
        <div className="form-row-with-delete">
          <div className="form-row-fields">
            <ReferenceDropdown label="Relationship Kind" value={vector.relationshipKind}
              onChange={handleRelKind} options={relationshipKindOptions} />
            <ReferenceDropdown label="Direction" value={vector.direction || "both"}
              onChange={handleDir} options={DIRECTIONS} />
            <div className="form-group">
              <label className="label">Min Strength
              <NumberInput value={vector.minStrength} onChange={handleStrength}
                className="input" step={0.1} min={0} max={1} allowEmpty />
              </label>
            </div>
          </div>
          <button className="btn-icon btn-icon-danger" onClick={handleRemove}>×</button>
        </div>
      </div>
    </div>
  );
}

// -- VectorsSection -----------------------------------------------------------
function VectorsSection({
  vectors, onAddVector, onUpdateVector, onRemoveVector, relationshipKindOptions,
}: Readonly<{
  vectors: Vector[]; onAddVector: () => void;
  onUpdateVector: (index: number, field: string, value: unknown) => void;
  onRemoveVector: (index: number) => void;
  relationshipKindOptions: DropdownOption[];
}>) {
  return (
    <div className="section">
      <div className="section-title">Transmission Vectors ({vectors.length})</div>
      <div className="section-desc">Relationships through which the contagion spreads.</div>
      {vectors.map((vector, index) => (
        <VectorCard key={index} vector={vector} index={index}
          onUpdateVector={onUpdateVector} onRemoveVector={onRemoveVector}
          relationshipKindOptions={relationshipKindOptions} />
      ))}
      <button className="btn-add" onClick={onAddVector}>+ Add Vector</button>
    </div>
  );
}

// -- TransmissionRatesSection -------------------------------------------------
function TransmissionRatesSection({
  transmission, onUpdateTransmission,
}: Readonly<{
  transmission: TransmissionConfig | undefined;
  onUpdateTransmission: (field: string, value: unknown) => void;
}>) {
  const handleBaseRate = useCallback(
    (v: number | undefined) => onUpdateTransmission("baseRate", v), [onUpdateTransmission]);
  const handleContactMult = useCallback(
    (v: number | undefined) => onUpdateTransmission("contactMultiplier", v), [onUpdateTransmission]);
  const handleMaxProb = useCallback(
    (v: number | undefined) => onUpdateTransmission("maxProbability", v), [onUpdateTransmission]);
  return (
    <div className="section">
      <div className="section-title">Transmission Rates</div>
      <div className="form-grid">
        <div className="form-group">
          <label className="label">Base Rate
          <NumberInput value={transmission?.baseRate} onChange={handleBaseRate}
            className="input" step={0.05} min={0} max={1} allowEmpty />
          </label>
        </div>
        <div className="form-group">
          <label className="label">Contact Multiplier
          <NumberInput value={transmission?.contactMultiplier} onChange={handleContactMult}
            className="input" step={0.05} min={0} allowEmpty />
          </label>
        </div>
        <div className="form-group">
          <label className="label">Max Probability
          <NumberInput value={transmission?.maxProbability} onChange={handleMaxProb}
            className="input" step={0.05} min={0} max={1} allowEmpty />
          </label>
        </div>
      </div>
    </div>
  );
}

// -- InfectionRelationshipFields ----------------------------------------------
function InfectionRelationshipFields({
  infectionAction, onUpdate, relationshipKindOptions,
}: Readonly<{
  infectionAction: InfectionActionConfig | undefined;
  onUpdate: (field: string, value: unknown) => void;
  relationshipKindOptions: DropdownOption[];
}>) {
  const handleKind = useCallback((v: string | undefined) => onUpdate("kind", v), [onUpdate]);
  const handleSrc = useCallback((v: string | undefined) => onUpdate("src", v), [onUpdate]);
  const handleDst = useCallback((v: string | undefined) => onUpdate("dst", v), [onUpdate]);
  const handleStr = useCallback((v: number | undefined) => onUpdate("strength", v), [onUpdate]);
  const handleBidir = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onUpdate("bidirectional", e.target.checked || undefined),
    [onUpdate]);
  return (
    <>
      <ReferenceDropdown label="Relationship Kind" value={infectionAction?.kind}
        onChange={handleKind} options={relationshipKindOptions} />
      <ReferenceDropdown label="Source" value={infectionAction?.src || "$self"}
        onChange={handleSrc} options={ENTITY_REF_OPTIONS} />
      <ReferenceDropdown label="Destination" value={infectionAction?.dst || "$source"}
        onChange={handleDst} options={ENTITY_REF_OPTIONS} />
      <div className="form-group">
        <label className="label">Strength
        <NumberInput value={infectionAction?.strength} onChange={handleStr}
          className="input" step={0.1} min={0} max={1} allowEmpty />
        </label>
      </div>
      <div className="form-group">
        <label className="checkbox-label">
          <input type="checkbox" checked={infectionAction?.bidirectional || false}
            onChange={handleBidir} className="checkbox" />
          Bidirectional
        </label>
      </div>
    </>
  );
}

// -- InfectionTagFields -------------------------------------------------------
function InfectionTagFields({
  infectionAction, onUpdate, tagRegistry,
}: Readonly<{
  infectionAction: InfectionActionConfig | undefined;
  onUpdate: (field: string, value: unknown) => void;
  tagRegistry: TagDefinition[];
}>) {
  const handleEntity = useCallback((v: string | undefined) => onUpdate("entity", v), [onUpdate]);
  const handleTag = useCallback((tags: string[]) => onUpdate("tag", tags[0] || ""), [onUpdate]);
  const handleValue = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onUpdate("value", e.target.value || undefined),
    [onUpdate]);
  const tagValue = useMemo(
    () => (infectionAction?.tag ? [infectionAction.tag] : []),
    [infectionAction]);
  return (
    <>
      <ReferenceDropdown label="Entity" value={infectionAction?.entity || "$self"}
        onChange={handleEntity} options={ENTITY_REF_OPTIONS} />
      <div className="form-group">
        <label className="label">Tag
        <TagSelector value={tagValue} onChange={handleTag}
          tagRegistry={tagRegistry} placeholder="Select tag..." singleSelect />
        </label>
      </div>
      <div className="form-group">
        <label htmlFor="value-optional" className="label">Value (optional)</label>
        <input id="value-optional" type="text"
          value={infectionAction?.value !== undefined ? String(infectionAction.value) : ""}
          onChange={handleValue} className="input" placeholder="true" />
      </div>
    </>
  );
}

// -- InfectionActionSection ---------------------------------------------------
function InfectionActionSection({
  infectionAction, onUpdate, relationshipKindOptions, tagRegistry,
}: Readonly<{
  infectionAction: InfectionActionConfig | undefined;
  onUpdate: (field: string, value: unknown) => void;
  relationshipKindOptions: DropdownOption[];
  tagRegistry: TagDefinition[];
}>) {
  const handleType = useCallback(
    (v: string | undefined) => onUpdate("type", v), [onUpdate]);
  return (
    <div className="section">
      <div className="section-title">Infection Action</div>
      <div className="section-desc">What happens when an entity gets infected.</div>
      <div className="form-grid">
        <ReferenceDropdown label="Action Type" value={infectionAction?.type || "create_relationship"}
          onChange={handleType} options={INFECTION_ACTION_TYPE_OPTIONS} />
        {infectionAction?.type === "create_relationship" && (
          <InfectionRelationshipFields infectionAction={infectionAction}
            onUpdate={onUpdate} relationshipKindOptions={relationshipKindOptions} />
        )}
        {infectionAction?.type === "set_tag" && (
          <InfectionTagFields infectionAction={infectionAction}
            onUpdate={onUpdate} tagRegistry={tagRegistry} />
        )}
      </div>
    </div>
  );
}

// -- NarrationSection ---------------------------------------------------------
function NarrationSection({
  narrationTemplate, onUpdateConfig,
}: Readonly<{
  narrationTemplate: string | undefined;
  onUpdateConfig: (field: string, value: unknown) => void;
}>) {
  const handleChange = useCallback(
    (value: string) => onUpdateConfig("narrationTemplate", value || undefined),
    [onUpdateConfig]);
  return (
    <div className="mt-xl">
      <span className="label">Narration Template</span>
      <div className="section-desc mb-xs text-xs">
        Syntax: {"{$self.field}"}, {"{$source.field}"}, {"{$contagion_source.field}"},{" "}
        {"{field|fallback}"}.
      </div>
      <LocalTextArea value={narrationTemplate || ""} onChange={handleChange}
        placeholder="e.g., {$self.name} fell under the influence of {$source.name}." rows={2} />
    </div>
  );
}

// -- GraphContagionTab (main export) ------------------------------------------
export function GraphContagionTab({
  system, onChange, schema,
}: Readonly<{
  system: System; onChange: (system: System) => void; schema?: DomainSchema;
}>) {
  const config = system.config;
  const relationshipKindOptions = useMemo(
    () => (schema?.relationshipKinds || []).map((rk) => ({
      value: rk.kind, label: rk.description || rk.kind,
    })), [schema?.relationshipKinds]);
  const tagRegistry = useMemo(() => schema?.tagRegistry || [], [schema?.tagRegistry]);
  const updateConfig = useCallback(
    (field: string, value: unknown) => {
      onChange({ ...system, config: { ...config, [field]: value } });
    }, [onChange, system, config]);
  const updateContagion = useCallback(
    (field: string, value: unknown) => {
      updateConfig("contagion", { ...config.contagion, [field]: value });
    }, [updateConfig, config.contagion]);
  const updateTransmission = useCallback(
    (field: string, value: unknown) => {
      updateConfig("transmission", { ...config.transmission, [field]: value });
    }, [updateConfig, config.transmission]);
  const updateInfectionAction = useCallback(
    (field: string, value: unknown) => {
      updateConfig("infectionAction", { ...config.infectionAction, [field]: value });
    }, [updateConfig, config.infectionAction]);
  const vectors = useMemo(() => config.vectors || [], [config.vectors]);
  const addVector = useCallback(() => {
    updateConfig("vectors", [
      ...vectors, { relationshipKind: "", direction: "both", minStrength: 0.5 },
    ]);
  }, [updateConfig, vectors]);
  const updateVector = useCallback(
    (index: number, field: string, value: unknown) => {
      const newVectors = [...vectors];
      newVectors[index] = { ...newVectors[index], [field]: value } as Vector;
      updateConfig("vectors", newVectors);
    }, [updateConfig, vectors]);
  const removeVector = useCallback(
    (index: number) => {
      updateConfig("vectors", vectors.filter((_, i) => i !== index));
    }, [updateConfig, vectors]);
  return (
    <div>
      <ContagionSourceSection contagion={config.contagion}
        onUpdateContagion={updateContagion} relationshipKindOptions={relationshipKindOptions} />
      <VectorsSection vectors={vectors} onAddVector={addVector} onUpdateVector={updateVector}
        onRemoveVector={removeVector} relationshipKindOptions={relationshipKindOptions} />
      <TransmissionRatesSection transmission={config.transmission}
        onUpdateTransmission={updateTransmission} />
      <InfectionActionSection infectionAction={config.infectionAction}
        onUpdate={updateInfectionAction} relationshipKindOptions={relationshipKindOptions}
        tagRegistry={tagRegistry} />
      <NarrationSection narrationTemplate={config.narrationTemplate}
        onUpdateConfig={updateConfig} />
    </div>
  );
}

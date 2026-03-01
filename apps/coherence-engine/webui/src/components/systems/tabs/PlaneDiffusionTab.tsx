/**
 * PlaneDiffusionTab - Configuration for plane diffusion systems
 *
 * True time-evolving 2D diffusion field simulation.
 * Uses a 100x100 grid matching the semantic coordinate space.
 * Sources SET values at their positions (Dirichlet boundary).
 * Values diffuse via heat equation. Simulation is uncapped internally.
 * Output (tags) is clamped to -100 to 100.
 */
import React, { useCallback, useMemo } from "react";
import { NumberInput } from "../../shared";
import TagSelector from "@the-canonry/shared-components/TagSelector";

// -- Interfaces ---------------------------------------------------------------
interface TagDefinition { key: string; label?: string; description?: string; category?: string }
interface DomainSchema { tagRegistry?: TagDefinition[] }
interface DropdownOption { value: string; label: string }
interface SourceSinkConfig { tagFilter?: string; defaultStrength?: number }
interface DiffusionConfig {
  rate?: number; sourceRadius?: number; falloffType?: string;
  decayRate?: number; iterationsPerTick?: number;
}
interface OutputTag { tag: string; minValue?: number; maxValue?: number }
interface SystemConfig {
  sources?: SourceSinkConfig; sinks?: SourceSinkConfig;
  diffusion?: DiffusionConfig; outputTags?: OutputTag[]; valueTag?: string;
}
interface System { config: SystemConfig; [key: string]: unknown }

// -- Static option arrays -----------------------------------------------------
const FALLOFF_OPTIONS: DropdownOption[] = [
  { value: "absolute", label: "Absolute (100\u219999\u219998...)" },
  { value: "none", label: "None (full strength in radius)" },
  { value: "linear", label: "Linear % (1 - d/r)" },
  { value: "inverse_square", label: "Inverse Square % (1/(1+d\u00B2))" },
  { value: "sqrt", label: "Square Root % (1 - \u221A(d/r))" },
  { value: "exponential", label: "Exponential % (e^(-3d/r))" },
];

// -- SourceSinkSection --------------------------------------------------------
function SourceSinkSection({
  title, description, config, onUpdate, tagRegistry, strengthHint, tagHint,
}: Readonly<{
  title: string; description: string;
  config: SourceSinkConfig | undefined;
  onUpdate: (field: string, value: unknown) => void;
  tagRegistry: TagDefinition[];
  strengthHint: string; tagHint: string;
}>) {
  const tagValue = useMemo(
    () => (config?.tagFilter ? [config.tagFilter] : []),
    [config]);
  const handleTag = useCallback(
    (tags: string[]) => onUpdate("tagFilter", tags[0] || ""), [onUpdate]);
  const handleStrength = useCallback(
    (v: number | undefined) => onUpdate("defaultStrength", v), [onUpdate]);
  return (
    <div className="section">
      <div className="section-title">{title}</div>
      <div className="section-desc">{description}</div>
      <div className="form-grid">
        <div className="form-group">
          <label className="label">Tag Filter
          <TagSelector value={tagValue} onChange={handleTag}
            tagRegistry={tagRegistry} placeholder="Select tag..." singleSelect />
          </label>
          <div className="hint">{tagHint}</div>
        </div>
        <div className="form-group">
          <label className="label">Default Strength
          <NumberInput value={config?.defaultStrength} onChange={handleStrength} allowEmpty />
          </label>
          <div className="hint">{strengthHint}</div>
        </div>
      </div>
    </div>
  );
}

// -- DiffusionRateFields ------------------------------------------------------
function DiffusionRateFields({
  diffusion, onUpdate,
}: Readonly<{
  diffusion: DiffusionConfig | undefined;
  onUpdate: (field: string, value: unknown) => void;
}>) {
  const handleRate = useCallback(
    (v: number | undefined) => onUpdate("rate", v), [onUpdate]);
  const handleRadius = useCallback(
    (v: number | undefined) => onUpdate("sourceRadius", v), [onUpdate]);
  const handleFalloff = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => onUpdate("falloffType", e.target.value),
    [onUpdate]);
  return (
    <>
      <div className="form-group">
        <label className="label">Rate
        <NumberInput value={diffusion?.rate} onChange={handleRate}
          min={0} max={1} allowEmpty />
        </label>
        <div className="hint">0-1. Recommended 0.1-0.25. Above 0.25 may cause oscillations.</div>
      </div>
      <div className="form-group">
        <label className="label">Source Radius
        <NumberInput value={diffusion?.sourceRadius} onChange={handleRadius}
          min={0} max={50} integer allowEmpty />
        </label>
        <div className="hint">Grid cells where source/sink SET values. Default: 1.</div>
      </div>
      <div className="form-group">
        <label htmlFor="falloff-type" className="label">Falloff Type</label>
        <select id="falloff-type" className="input"
          value={diffusion?.falloffType || "absolute"} onChange={handleFalloff}>
          {FALLOFF_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <div className="hint">How strength decreases within source radius.</div>
      </div>
    </>
  );
}

// -- DiffusionDecayFields -----------------------------------------------------
function DiffusionDecayFields({
  diffusion, onUpdate,
}: Readonly<{
  diffusion: DiffusionConfig | undefined;
  onUpdate: (field: string, value: unknown) => void;
}>) {
  const handleDecay = useCallback(
    (v: number | undefined) => onUpdate("decayRate", v), [onUpdate]);
  const handleIterations = useCallback(
    (v: number | undefined) => onUpdate("iterationsPerTick", v), [onUpdate]);
  return (
    <>
      <div className="form-group">
        <label className="label">Decay Rate
        <NumberInput value={diffusion?.decayRate} onChange={handleDecay}
          min={0} max={1} allowEmpty />
        </label>
        <div className="hint">0-1. Default: 0 (no decay). Decay fights diffusion spreading.</div>
      </div>
      <div className="form-group">
        <label className="label">Iterations Per Tick
        <NumberInput value={diffusion?.iterationsPerTick} onChange={handleIterations}
          min={1} max={200} integer allowEmpty />
        </label>
        <div className="hint">Default: 20. Higher = faster spreading. 20 achieves ~50 cells in 15 ticks.</div>
      </div>
    </>
  );
}

// -- DiffusionSection ---------------------------------------------------------
function DiffusionSection({
  diffusion, onUpdate,
}: Readonly<{
  diffusion: DiffusionConfig | undefined;
  onUpdate: (field: string, value: unknown) => void;
}>) {
  return (
    <div className="section">
      <div className="section-title">Diffusion</div>
      <div className="section-desc">
        Heat equation parameters. Each tick: sources/sinks SET values (fixed boundary), then
        diffusion runs N iterations to spread values.
      </div>
      <div className="form-grid">
        <DiffusionRateFields diffusion={diffusion} onUpdate={onUpdate} />
        <DiffusionDecayFields diffusion={diffusion} onUpdate={onUpdate} />
      </div>
    </div>
  );
}

// -- OutputTagCard ------------------------------------------------------------
function OutputTagCard({
  tag, index, onUpdateOutputTag, onRemoveOutputTag, tagRegistry,
}: Readonly<{
  tag: OutputTag; index: number;
  onUpdateOutputTag: (index: number, tag: OutputTag) => void;
  onRemoveOutputTag: (index: number) => void;
  tagRegistry: TagDefinition[];
}>) {
  const tagValue = useMemo(() => (tag.tag ? [tag.tag] : []), [tag]);
  const handleTag = useCallback(
    (tags: string[]) => onUpdateOutputTag(index, { ...tag, tag: tags[0] || "" }),
    [onUpdateOutputTag, index, tag]);
  const handleMin = useCallback(
    (v: number | undefined) => onUpdateOutputTag(index, { ...tag, minValue: v }),
    [onUpdateOutputTag, index, tag]);
  const handleMax = useCallback(
    (v: number | undefined) => onUpdateOutputTag(index, { ...tag, maxValue: v }),
    [onUpdateOutputTag, index, tag]);
  const handleRemove = useCallback(() => onRemoveOutputTag(index), [onRemoveOutputTag, index]);
  return (
    <div className="item-card">
      <div className="py-lg px-xl">
        <div className="form-row-with-delete">
          <div className="form-row-fields">
            <div className="form-group">
              <label className="label">Tag
              <TagSelector value={tagValue} onChange={handleTag}
                tagRegistry={tagRegistry} placeholder="Select tag..." singleSelect />
              </label>
            </div>
            <div className="form-group">
              <label className="label">Min Value
              <NumberInput value={tag.minValue} onChange={handleMin}
                min={-100} max={100} allowEmpty />
              </label>
              <div className="hint">-100 to 100</div>
            </div>
            <div className="form-group">
              <label className="label">Max Value
              <NumberInput value={tag.maxValue} onChange={handleMax}
                min={-100} max={100} allowEmpty />
              </label>
              <div className="hint">-100 to 100</div>
            </div>
          </div>
          <button className="btn-icon btn-icon-danger" onClick={handleRemove}>×</button>
        </div>
      </div>
    </div>
  );
}

// -- OutputTagsSection --------------------------------------------------------
function OutputTagsSection({
  outputTags, valueTag, onAddOutputTag, onUpdateOutputTag,
  onRemoveOutputTag, onUpdateConfig, tagRegistry,
}: Readonly<{
  outputTags: OutputTag[]; valueTag: string | undefined;
  onAddOutputTag: () => void;
  onUpdateOutputTag: (index: number, tag: OutputTag) => void;
  onRemoveOutputTag: (index: number) => void;
  onUpdateConfig: (field: string, value: unknown) => void;
  tagRegistry: TagDefinition[];
}>) {
  const valueTagArray = useMemo(() => (valueTag ? [valueTag] : []), [valueTag]);
  const handleValueTag = useCallback(
    (tags: string[]) => onUpdateConfig("valueTag", tags[0] || ""), [onUpdateConfig]);
  return (
    <div className="section">
      <div className="section-title">Output Tags ({outputTags.length})</div>
      <div className="section-desc">
        Tags assigned to entities based on sampled field value (clamped to -100 to 100).
      </div>
      {outputTags.map((tag, index) => (
        <OutputTagCard key={index} tag={tag} index={index}
          onUpdateOutputTag={onUpdateOutputTag} onRemoveOutputTag={onRemoveOutputTag}
          tagRegistry={tagRegistry} />
      ))}
      <button className="btn-add" onClick={onAddOutputTag}>+ Add Output Tag</button>
      <div className="mt-xl">
        <div className="form-group">
          <label className="label">Value Tag
          <TagSelector value={valueTagArray} onChange={handleValueTag}
            tagRegistry={tagRegistry} placeholder="Select tag..." singleSelect />
          </label>
          <div className="hint">
            Optional: Store clamped field value as tag (e.g., &quot;field_value:25.5&quot;)
          </div>
        </div>
      </div>
    </div>
  );
}

// -- PlaneDiffusionTab (main export) ------------------------------------------
export function PlaneDiffusionTab({
  system, onChange, schema,
}: Readonly<{
  system: System; onChange: (system: System) => void; schema?: DomainSchema;
}>) {
  const config = system.config;
  const tagRegistry = useMemo(() => schema?.tagRegistry || [], [schema?.tagRegistry]);
  const updateConfig = useCallback(
    (field: string, value: unknown) => {
      onChange({ ...system, config: { ...config, [field]: value } });
    }, [onChange, system, config]);
  const updateSources = useCallback(
    (field: string, value: unknown) => {
      updateConfig("sources", { ...config.sources, [field]: value });
    }, [updateConfig, config.sources]);
  const updateSinks = useCallback(
    (field: string, value: unknown) => {
      updateConfig("sinks", { ...config.sinks, [field]: value });
    }, [updateConfig, config.sinks]);
  const updateDiffusion = useCallback(
    (field: string, value: unknown) => {
      updateConfig("diffusion", { ...config.diffusion, [field]: value });
    }, [updateConfig, config.diffusion]);
  const outputTags = useMemo(() => config.outputTags || [], [config.outputTags]);
  const addOutputTag = useCallback(() => {
    updateConfig("outputTags", [...outputTags, { tag: "", minValue: 0 }]);
  }, [updateConfig, outputTags]);
  const updateOutputTag = useCallback(
    (index: number, tag: OutputTag) => {
      const newTags = [...outputTags];
      newTags[index] = tag;
      updateConfig("outputTags", newTags);
    }, [updateConfig, outputTags]);
  const removeOutputTag = useCallback(
    (index: number) => {
      updateConfig("outputTags", outputTags.filter((_, i) => i !== index));
    }, [updateConfig, outputTags]);
  return (
    <div>
      <SourceSinkSection title="Sources"
        description="Entities that SET values into the diffusion field. Values are maintained at source positions each tick (Dirichlet boundary condition)."
        config={config.sources} onUpdate={updateSources} tagRegistry={tagRegistry}
        tagHint="Tag that marks an entity as a source"
        strengthHint="Any number. Simulation is uncapped. Output tags clamp to -100/100." />
      <SourceSinkSection title="Sinks"
        description="Entities that SET negative values into the diffusion field."
        config={config.sinks} onUpdate={updateSinks} tagRegistry={tagRegistry}
        tagHint="Tag that marks an entity as a sink"
        strengthHint="Will be negated. Any number - simulation is uncapped." />
      <DiffusionSection diffusion={config.diffusion} onUpdate={updateDiffusion} />
      <OutputTagsSection outputTags={outputTags} valueTag={config.valueTag}
        onAddOutputTag={addOutputTag} onUpdateOutputTag={updateOutputTag}
        onRemoveOutputTag={removeOutputTag} onUpdateConfig={updateConfig}
        tagRegistry={tagRegistry} />
    </div>
  );
}

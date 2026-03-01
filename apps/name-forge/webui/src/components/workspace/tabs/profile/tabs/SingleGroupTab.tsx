/**
 * SingleGroupTab - Edit a single strategy group
 */

import React, { useMemo, useCallback } from "react";
import { TagSelector, NumberInput, EnableToggle } from "@the-canonry/shared-components";
import MultiSelectPills from "../MultiSelectPills";
import "./SingleGroupTab.css";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface StrategyConditions {
  entityKinds: string[];
  prominence: string[];
  subtypes: string[];
  subtypeMatchAll: boolean;
  tags: string[];
  tagMatchAll: boolean;
}

interface Strategy {
  type: "phonotactic" | "grammar";
  weight: number;
  domainId?: string;
  grammarId?: string;
}

interface StrategyGroup {
  name: string;
  priority: number;
  conditions: StrategyConditions | null;
  strategies: Strategy[];
}

interface Domain {
  id: string;
}

interface Grammar {
  id: string;
}

interface HardStateEntry {
  kind: string;
  subtype?: string[];
}

interface WorldSchema {
  hardState?: HardStateEntry[];
}

interface TagDef {
  tag: string;
  category: string;
  rarity: string;
  description?: string;
}

interface SingleGroupTabProps {
  group: StrategyGroup;
  groupIdx: number;
  onChange: (group: StrategyGroup) => void;
  onDelete: () => void;
  domains: Domain[];
  grammars: Grammar[];
  entityKinds: string[];
  worldSchema: WorldSchema;
  tagRegistry: TagDef[];
  onAddTag: (tagDef: TagDef) => void;
}

const PROMINENCE_LEVELS: string[] = ["forgotten", "marginal", "recognized", "renowned", "mythic"];
const EMPTY_ENTITY_KINDS: string[] = [];
const EMPTY_PROMINENCE: string[] = [];
const EMPTY_SUBTYPES: string[] = [];
const EMPTY_TAGS: string[] = [];

/* ------------------------------------------------------------------ */
/*  Conditions sub-component                                           */
/* ------------------------------------------------------------------ */

interface ConditionsSectionProps {
  group: StrategyGroup;
  hasConditions: boolean;
  entityKinds: string[];
  availableSubtypes: string[];
  tagRegistry: TagDef[];
  onConditionChange: (field: string, value: string[] | boolean) => void;
  onAddTag: (tagDef: TagDef) => void;
  onToggleConditions: () => void;
}

function ConditionsSection({
  group,
  hasConditions,
  entityKinds,
  availableSubtypes,
  tagRegistry,
  onConditionChange,
  onAddTag,
  onToggleConditions,
}: ConditionsSectionProps) {
  const entityKindsSelected = useMemo(
    () => group.conditions?.entityKinds || EMPTY_ENTITY_KINDS,
    [group.conditions?.entityKinds],
  );
  const prominenceSelected = useMemo(
    () => group.conditions?.prominence || EMPTY_PROMINENCE,
    [group.conditions?.prominence],
  );
  const subtypesSelected = useMemo(
    () => group.conditions?.subtypes || EMPTY_SUBTYPES,
    [group.conditions?.subtypes],
  );
  const tagsSelected = useMemo(
    () => group.conditions?.tags || EMPTY_TAGS,
    [group.conditions?.tags],
  );

  const handleEntityKindsChange = useCallback(
    (val: string[]) => onConditionChange("entityKinds", val),
    [onConditionChange],
  );
  const handleProminenceChange = useCallback(
    (val: string[]) => onConditionChange("prominence", val),
    [onConditionChange],
  );
  const handleSubtypeMatchAllChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      onConditionChange("subtypeMatchAll", e.target.checked),
    [onConditionChange],
  );
  const handleSubtypesChange = useCallback(
    (val: string[]) => onConditionChange("subtypes", val),
    [onConditionChange],
  );
  const handleTagsChange = useCallback(
    (val: string[]) => onConditionChange("tags", val),
    [onConditionChange],
  );
  const handleTagMatchAllChange = useCallback(
    (val: boolean) => onConditionChange("tagMatchAll", val),
    [onConditionChange],
  );

  return (
    <div className="viewer-section">
      <div className="section-header">
        <h4>Conditions</h4>
        <EnableToggle
          enabled={hasConditions}
          onChange={onToggleConditions}
          label={hasConditions ? "Conditional" : "Always Match"}
        />
      </div>

      {hasConditions ? (
        <div className="conditions-grid">
          <div className="condition-field">
            <label>Entity Types
            <MultiSelectPills
              options={entityKinds}
              selected={entityKindsSelected}
              onChange={handleEntityKindsChange}
              allLabel="All"
            />
            </label>
          </div>

          <div className="condition-field">
            <label>Prominence
            <MultiSelectPills
              options={PROMINENCE_LEVELS}
              selected={prominenceSelected}
              onChange={handleProminenceChange}
              allLabel="Any"
            />
            </label>
          </div>

          <div className="condition-field">
            <label>
              Subtypes
              <label className="match-all-toggle">
                <input
                  type="checkbox"
                  checked={group.conditions?.subtypeMatchAll || false}
                  onChange={handleSubtypeMatchAllChange}
                />
                Match all
              </label>
            </label>
            {availableSubtypes.length > 0 ? (
              <MultiSelectPills
                options={availableSubtypes}
                selected={subtypesSelected}
                onChange={handleSubtypesChange}
                allLabel="Any"
              />
            ) : (
              <p className="text-muted text-small sgt-no-subtypes">
                {(group.conditions?.entityKinds?.length || 0) > 0
                  ? "Selected entity types have no subtypes defined"
                  : "Select entity types to see available subtypes"}
              </p>
            )}
          </div>

          <div className="condition-field">
            <label>Tags
            <TagSelector
              value={tagsSelected}
              onChange={handleTagsChange}
              tagRegistry={tagRegistry}
              placeholder="Select tags..."
              matchAllEnabled={true}
              matchAll={group.conditions?.tagMatchAll || false}
              onMatchAllChange={handleTagMatchAllChange}
              onAddToRegistry={onAddTag}
            />
            </label>
          </div>
        </div>
      ) : (
        <p className="text-muted text-small">
          This group will always be considered. Click &quot;Always Match&quot; to add conditions.
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Strategy item                                                      */
/* ------------------------------------------------------------------ */

interface StrategyItemProps {
  strategy: Strategy;
  stratIdx: number;
  groupTotalWeight: number;
  domains: Domain[];
  grammars: Grammar[];
  onWeightChange: (stratIdx: number, value: string) => void;
  onConfigChange: (stratIdx: number, field: string, value: string) => void;
  onDelete: (stratIdx: number) => void;
}

function StrategyItem({
  strategy,
  stratIdx,
  groupTotalWeight,
  domains,
  grammars,
  onWeightChange,
  onConfigChange,
  onDelete,
}: StrategyItemProps) {
  const handleWeightChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onWeightChange(stratIdx, e.target.value),
    [stratIdx, onWeightChange],
  );
  const handleDelete = useCallback(() => onDelete(stratIdx), [stratIdx, onDelete]);
  const handleConfigChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) =>
      onConfigChange(stratIdx, strategy.type === "phonotactic" ? "domainId" : "grammarId", e.target.value),
    [stratIdx, strategy.type, onConfigChange],
  );

  return (
    <div className={`strategy-item ${strategy.type}`}>
      <div className="strategy-header">
        <span className="strategy-type">{strategy.type}</span>
        <span className="strategy-weight">
          {groupTotalWeight > 0
            ? Math.round((strategy.weight / groupTotalWeight) * 100)
            : 0}
          %
        </span>
        <button className="remove-btn" onClick={handleDelete}>
          x
        </button>
      </div>

      <div className="strategy-body">
        <div className="weight-slider">
          <label htmlFor={`weight-${stratIdx}`}>Weight</label>
          <input
            id={`weight-${stratIdx}`}
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={strategy.weight}
            onChange={handleWeightChange}
          />
        </div>

        {strategy.type === "phonotactic" && (
          <div className="strategy-config">
            <label htmlFor={`domain-${stratIdx}`}>Domain</label>
            <select
              id={`domain-${stratIdx}`}
              value={strategy.domainId || ""}
              onChange={handleConfigChange}
            >
              <option value="">Select domain...</option>
              {domains.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.id}
                </option>
              ))}
            </select>
          </div>
        )}

        {strategy.type === "grammar" && (
          <div className="strategy-config">
            <label htmlFor={`grammar-${stratIdx}`}>Grammar</label>
            <select
              id={`grammar-${stratIdx}`}
              value={strategy.grammarId || ""}
              onChange={handleConfigChange}
            >
              <option value="">Select grammar...</option>
              {grammars.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.id}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function SingleGroupTab({
  group,
  groupIdx: _groupIdx,
  onChange,
  onDelete,
  domains,
  grammars,
  entityKinds,
  worldSchema,
  tagRegistry,
  onAddTag,
}: SingleGroupTabProps) {
  const hasConditions = !!group.conditions;
  const groupTotalWeight = group.strategies.reduce((sum, s) => sum + s.weight, 0);

  const availableSubtypes = useMemo(() => {
    const selectedKinds = group.conditions?.entityKinds || [];
    const entityDefs = worldSchema?.hardState || [];

    const kindsToCheck =
      selectedKinds.length > 0
        ? entityDefs.filter((e) => selectedKinds.includes(e.kind))
        : entityDefs;

    const subtypes = new Set<string>();
    kindsToCheck.forEach((entityDef) => {
      (entityDef.subtype || []).forEach((st) => {
        if (st) subtypes.add(st);
      });
    });

    return Array.from(subtypes).sort();
  }, [group.conditions?.entityKinds, worldSchema]);

  const updateGroup = useCallback(
    (updates: Partial<StrategyGroup>) => {
      onChange({ ...group, ...updates });
    },
    [group, onChange],
  );

  const toggleConditions = useCallback(() => {
    if (hasConditions) {
      updateGroup({ conditions: null });
    } else {
      updateGroup({
        conditions: {
          entityKinds: [],
          prominence: [],
          subtypes: [],
          subtypeMatchAll: false,
          tags: [],
          tagMatchAll: false,
        },
      });
    }
  }, [hasConditions, updateGroup]);

  const handleConditionChange = useCallback(
    (field: string, value: string[] | boolean) => {
      updateGroup({
        conditions: { ...group.conditions!, [field]: value },
      });
    },
    [group.conditions, updateGroup],
  );

  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => updateGroup({ name: e.target.value }),
    [updateGroup],
  );

  const handlePriorityChange = useCallback(
    (v: number | undefined) => updateGroup({ priority: v ?? 0 }),
    [updateGroup],
  );

  const handleAddPhonotactic = useCallback(
    () => {
      const newStrategy: Strategy = { type: "phonotactic", weight: 0.25, domainId: domains[0]?.id || "" };
      updateGroup({ strategies: [...group.strategies, newStrategy] });
    },
    [domains, group.strategies, updateGroup],
  );

  const handleAddGrammar = useCallback(
    () => {
      const newStrategy: Strategy = { type: "grammar", weight: 0.25, grammarId: grammars[0]?.id || "" };
      updateGroup({ strategies: [...group.strategies, newStrategy] });
    },
    [grammars, group.strategies, updateGroup],
  );

  const handleDeleteStrategy = useCallback(
    (stratIdx: number) => {
      updateGroup({
        strategies: group.strategies.filter((_, i) => i !== stratIdx),
      });
    },
    [group.strategies, updateGroup],
  );

  const handleWeightChange = useCallback(
    (stratIdx: number, newWeight: string) => {
      const strategies = [...group.strategies];
      strategies[stratIdx] = { ...strategies[stratIdx], weight: parseFloat(newWeight) || 0 };
      updateGroup({ strategies });
    },
    [group.strategies, updateGroup],
  );

  const handleStrategyConfigChange = useCallback(
    (stratIdx: number, field: string, value: string) => {
      const strategies = [...group.strategies];
      strategies[stratIdx] = { ...strategies[stratIdx], [field]: value };
      updateGroup({ strategies });
    },
    [group.strategies, updateGroup],
  );

  return (
    <div className="single-group-tab">
      {/* Group Header */}
      <div className="viewer-section">
        <div className="group-name-row">
          <div className="form-group">
            <label htmlFor="group-name">Group Name</label>
            <input
              id="group-name"
              value={group.name || ""}
              onChange={handleNameChange}
              placeholder="e.g., Noble Names"
            />
          </div>
          <div className="form-group priority-field">
            <label>Priority
            <NumberInput
              value={group.priority || 0}
              onChange={handlePriorityChange}
              integer
            />
            </label>
          </div>
        </div>
        <p className="text-muted text-small mt-0">
          Higher priority groups are evaluated first. The first matching group&apos;s strategies are
          used.
        </p>
      </div>

      {/* Conditions Section */}
      <ConditionsSection
        group={group}
        hasConditions={hasConditions}
        entityKinds={entityKinds}
        availableSubtypes={availableSubtypes}
        tagRegistry={tagRegistry}
        onConditionChange={handleConditionChange}
        onAddTag={onAddTag}
        onToggleConditions={toggleConditions}
      />

      {/* Strategies Section */}
      <div className="viewer-section">
        <div className="section-header">
          <h4>Strategies</h4>
          <div className="add-strategy-buttons">
            <button
              className="add-btn phonotactic"
              onClick={handleAddPhonotactic}
            >
              + Phonotactic
            </button>
            <button className="add-btn grammar" onClick={handleAddGrammar}>
              + Grammar
            </button>
          </div>
        </div>

        {group.strategies.length === 0 ? (
          <div className="empty-strategies">
            <p>No strategies yet. Add a strategy to define how names are generated.</p>
          </div>
        ) : (
          <div className="strategies-list">
            {group.strategies.map((strategy, stratIdx) => (
              <StrategyItem
                key={stratIdx}
                strategy={strategy}
                stratIdx={stratIdx}
                groupTotalWeight={groupTotalWeight}
                domains={domains}
                grammars={grammars}
                onWeightChange={handleWeightChange}
                onConfigChange={handleStrategyConfigChange}
                onDelete={handleDeleteStrategy}
              />
            ))}
          </div>
        )}
      </div>

      {/* Danger Zone */}
      <div className="danger-zone">
        <button className="danger" onClick={onDelete}>
          Delete Group
        </button>
      </div>
    </div>
  );
}

import React, { useCallback, useMemo } from "react";
import { TagSelector, NumberInput } from "@the-canonry/shared-components";
import MultiSelectPills from "./MultiSelectPills";
import TagsInput from "./TagsInput";

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

interface EditedProfile {
  strategyGroups: StrategyGroup[];
}

interface StrategyGroupEditorProps {
  group: StrategyGroup;
  groupIdx: number;
  domains: Domain[];
  grammars: Grammar[];
  entityKinds: string[];
  prominenceLevels: string[];
  tagRegistry: Array<{ tag: string; category: string; rarity: string; description?: string }>;
  editedProfile: EditedProfile;
  setEditedProfile: (profile: EditedProfile) => void;
  onDeleteGroup: (groupIdx: number) => void;
  onAddStrategy: (groupIdx: number, type: "phonotactic" | "grammar") => void;
  onDeleteStrategy: (groupIdx: number, stratIdx: number) => void;
  onWeightChange: (groupIdx: number, stratIdx: number, value: string) => void;
  onConditionChange: (groupIdx: number, field: string, value: string[] | boolean) => void;
  onAddTag: (tagDef: { tag: string; category: string; rarity: string; description?: string }) => void;
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

interface ConditionsPanelProps {
  group: StrategyGroup;
  groupIdx: number;
  entityKinds: string[];
  prominenceLevels: string[];
  tagRegistry: StrategyGroupEditorProps["tagRegistry"];
  onConditionChange: StrategyGroupEditorProps["onConditionChange"];
  onAddTag: StrategyGroupEditorProps["onAddTag"];
}

const EMPTY_ENTITY_KINDS: string[] = [];
const EMPTY_PROMINENCE: string[] = [];
const EMPTY_SUBTYPES: string[] = [];
const EMPTY_TAGS: string[] = [];

function ConditionsPanel({
  group,
  groupIdx,
  entityKinds,
  prominenceLevels,
  tagRegistry,
  onConditionChange,
  onAddTag,
}: ConditionsPanelProps) {
  const entityKindsSelected = useMemo(
    () => group.conditions?.entityKinds || EMPTY_ENTITY_KINDS,
    [group.conditions?.entityKinds],
  );
  const prominenceSelected = useMemo(
    () => group.conditions?.prominence || EMPTY_PROMINENCE,
    [group.conditions?.prominence],
  );
  const subtypesValue = useMemo(
    () => group.conditions?.subtypes || EMPTY_SUBTYPES,
    [group.conditions?.subtypes],
  );
  const tagsValue = useMemo(
    () => group.conditions?.tags || EMPTY_TAGS,
    [group.conditions?.tags],
  );

  const handleEntityKindsChange = useCallback(
    (val: string[]) => onConditionChange(groupIdx, "entityKinds", val),
    [groupIdx, onConditionChange],
  );
  const handleProminenceChange = useCallback(
    (val: string[]) => onConditionChange(groupIdx, "prominence", val),
    [groupIdx, onConditionChange],
  );
  const handleSubtypeMatchAllChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      onConditionChange(groupIdx, "subtypeMatchAll", e.target.checked),
    [groupIdx, onConditionChange],
  );
  const handleSubtypesChange = useCallback(
    (val: string[]) => onConditionChange(groupIdx, "subtypes", val),
    [groupIdx, onConditionChange],
  );
  const handleTagsChange = useCallback(
    (val: string[]) => onConditionChange(groupIdx, "tags", val),
    [groupIdx, onConditionChange],
  );
  const handleTagMatchAllChange = useCallback(
    (val: boolean) => onConditionChange(groupIdx, "tagMatchAll", val),
    [groupIdx, onConditionChange],
  );

  return (
    <div className="conditions-panel">
      <div className="text-xs font-bold text-purple mb-md">Group Conditions</div>

      {/* Row 1: Entity Types and Prominence */}
      <div className="form-grid-2 mb-md">
        <div>
          <label className="condition-label">Entity Types
          <MultiSelectPills
            options={entityKinds}
            selected={entityKindsSelected}
            onChange={handleEntityKindsChange}
            allLabel="All"
          />
          </label>
        </div>

        <div>
          <label className="condition-label">Prominence
          <MultiSelectPills
            options={prominenceLevels}
            selected={prominenceSelected}
            onChange={handleProminenceChange}
            allLabel="Any"
          />
          </label>
        </div>
      </div>

      {/* Row 2: Subtypes and Tags */}
      <div className="form-grid-2">
        <div>
          <div className="flex justify-between align-center mb-xs">
            <span className="condition-label mb-0">Subtypes</span>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={group.conditions?.subtypeMatchAll || false}
                onChange={handleSubtypeMatchAllChange}
                className="checkbox-small"
              />
              Match all
            </label>
          </div>
          <TagsInput
            value={subtypesValue}
            onChange={handleSubtypesChange}
            placeholder="Type and press space..."
          />
        </div>

        <div>
          <label className="condition-label">Tags
          <TagSelector
            value={tagsValue}
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
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Strategy card                                                      */
/* ------------------------------------------------------------------ */

interface StrategyCardProps {
  strategy: Strategy;
  stratIdx: number;
  groupIdx: number;
  groupTotalWeight: number;
  domains: Domain[];
  grammars: Grammar[];
  editedProfile: EditedProfile;
  setEditedProfile: (profile: EditedProfile) => void;
  onDeleteStrategy: (groupIdx: number, stratIdx: number) => void;
  onWeightChange: (groupIdx: number, stratIdx: number, value: string) => void;
}

function StrategyCard({
  strategy,
  stratIdx,
  groupIdx,
  groupTotalWeight,
  domains,
  grammars,
  editedProfile,
  setEditedProfile,
  onDeleteStrategy,
  onWeightChange,
}: StrategyCardProps) {
  const handleDelete = useCallback(
    () => onDeleteStrategy(groupIdx, stratIdx),
    [groupIdx, stratIdx, onDeleteStrategy],
  );

  const handleWeightChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onWeightChange(groupIdx, stratIdx, e.target.value),
    [groupIdx, stratIdx, onWeightChange],
  );

  const handleDomainChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const groups = [...editedProfile.strategyGroups];
      const strategies = [...groups[groupIdx].strategies];
      strategies[stratIdx] = { ...strategies[stratIdx], domainId: e.target.value };
      groups[groupIdx] = { ...groups[groupIdx], strategies };
      setEditedProfile({ ...editedProfile, strategyGroups: groups });
    },
    [editedProfile, groupIdx, stratIdx, setEditedProfile],
  );

  const handleGrammarChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const groups = [...editedProfile.strategyGroups];
      const strategies = [...groups[groupIdx].strategies];
      strategies[stratIdx] = { ...strategies[stratIdx], grammarId: e.target.value };
      groups[groupIdx] = { ...groups[groupIdx], strategies };
      setEditedProfile({ ...editedProfile, strategyGroups: groups });
    },
    [editedProfile, groupIdx, stratIdx, setEditedProfile],
  );

  return (
    <div className={`strategy-card ${strategy.type}`}>
      <div className="flex justify-between align-center mb-sm">
        <div className="flex align-center gap-sm">
          <strong className="capitalize text-small">{strategy.type}</strong>
          <span className="weight-badge">
            {groupTotalWeight > 0 ? ((strategy.weight / groupTotalWeight) * 100).toFixed(0) : 0}
            %
          </span>
        </div>
        <button className="danger btn-xs" onClick={handleDelete}>
          Remove
        </button>
      </div>

      <input
        type="range"
        min="0"
        max="1"
        step="0.05"
        value={strategy.weight}
        onChange={handleWeightChange}
        className="strategy-slider"
      />

      {strategy.type === "phonotactic" && (
        <select
          value={strategy.domainId || ""}
          onChange={handleDomainChange}
          className="strategy-select"
        >
          <option value="">Select domain...</option>
          {domains.map((d) => (
            <option key={d.id} value={d.id}>
              {d.id}
            </option>
          ))}
        </select>
      )}

      {strategy.type === "grammar" && (
        <select
          value={strategy.grammarId || ""}
          onChange={handleGrammarChange}
          className="strategy-select"
        >
          <option value="">Select grammar...</option>
          {grammars.map((g) => (
            <option key={g.id} value={g.id}>
              {g.id}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function StrategyGroupEditor({
  group,
  groupIdx,
  domains,
  grammars,
  entityKinds,
  prominenceLevels,
  tagRegistry,
  editedProfile,
  setEditedProfile,
  onDeleteGroup,
  onAddStrategy,
  onDeleteStrategy,
  onWeightChange,
  onConditionChange,
  onAddTag,
}: StrategyGroupEditorProps) {
  const groupTotalWeight = group.strategies.reduce((sum, s) => sum + s.weight, 0);
  const hasConditions = !!group.conditions;

  const toggleConditions = useCallback(() => {
    const groups = [...editedProfile.strategyGroups];
    if (hasConditions) {
      groups[groupIdx] = { ...groups[groupIdx], conditions: null };
    } else {
      groups[groupIdx] = {
        ...groups[groupIdx],
        conditions: {
          entityKinds: [],
          prominence: [],
          subtypes: [],
          subtypeMatchAll: false,
          tags: [],
          tagMatchAll: false,
        },
      };
    }
    setEditedProfile({ ...editedProfile, strategyGroups: groups });
  }, [editedProfile, groupIdx, hasConditions, setEditedProfile]);

  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const groups = [...editedProfile.strategyGroups];
      groups[groupIdx] = { ...groups[groupIdx], name: e.target.value };
      setEditedProfile({ ...editedProfile, strategyGroups: groups });
    },
    [editedProfile, groupIdx, setEditedProfile],
  );

  const handlePriorityChange = useCallback(
    (v: number | undefined) => {
      const groups = [...editedProfile.strategyGroups];
      groups[groupIdx] = { ...groups[groupIdx], priority: v ?? 0 };
      setEditedProfile({ ...editedProfile, strategyGroups: groups });
    },
    [editedProfile, groupIdx, setEditedProfile],
  );

  const handleDeleteGroup = useCallback(
    () => onDeleteGroup(groupIdx),
    [groupIdx, onDeleteGroup],
  );

  const handleAddPhonotactic = useCallback(
    () => onAddStrategy(groupIdx, "phonotactic"),
    [groupIdx, onAddStrategy],
  );

  const handleAddGrammar = useCallback(
    () => onAddStrategy(groupIdx, "grammar"),
    [groupIdx, onAddStrategy],
  );

  return (
    <div className={`strategy-group ${hasConditions ? "conditional" : "default"}`}>
      <div className="flex justify-between align-center mb-md">
        <div className="flex align-center gap-md">
          <input
            value={group.name || ""}
            onChange={handleNameChange}
            placeholder="Group name"
            className="input-group-name"
          />
          <div className="flex align-center gap-xs">
            <label className="text-xs text-muted">Priority:
            <NumberInput
              value={group.priority || 0}
              onChange={handlePriorityChange}
              className="input-priority"
              integer
            />
            </label>
          </div>
          <button className="secondary btn-xs" onClick={toggleConditions}>
            {hasConditions ? "Remove Conditions" : "Add Conditions"}
          </button>
        </div>
        <button className="danger text-xs" onClick={handleDeleteGroup}>
          Delete Group
        </button>
      </div>

      {/* Group Conditions */}
      {hasConditions && (
        <ConditionsPanel
          group={group}
          groupIdx={groupIdx}
          entityKinds={entityKinds}
          prominenceLevels={prominenceLevels}
          tagRegistry={tagRegistry}
          onConditionChange={onConditionChange}
          onAddTag={onAddTag}
        />
      )}

      {/* Strategies */}
      {group.strategies.length === 0 && (
        <div className="text-muted text-small mb-sm">No strategies. Add one below.</div>
      )}

      {group.strategies.map((strategy, stratIdx) => (
        <StrategyCard
          key={stratIdx}
          strategy={strategy}
          stratIdx={stratIdx}
          groupIdx={groupIdx}
          groupTotalWeight={groupTotalWeight}
          domains={domains}
          grammars={grammars}
          editedProfile={editedProfile}
          setEditedProfile={setEditedProfile}
          onDeleteStrategy={onDeleteStrategy}
          onWeightChange={onWeightChange}
        />
      ))}

      <div className="flex gap-xs mt-sm">
        <button
          className="secondary text-xs"
          onClick={handleAddPhonotactic}
        >
          + Phonotactic
        </button>
        <button className="secondary text-xs" onClick={handleAddGrammar}>
          + Grammar
        </button>
      </div>
    </div>
  );
}

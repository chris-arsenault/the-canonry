/**
 * FilterFieldsSwitch - routes filter.type to the correct sub-component.
 *
 * Sub-components live in filterFieldsTag.tsx and filterFieldsEntity.tsx.
 */

import React, { useCallback } from "react";
import { GraphPathEditor } from "./GraphPathEditor";
import { SingleTagFields, MultiTagFields, CultureFields, MatchesCultureFields, StatusFields, ProminenceFields } from "./filterFieldsTag";
import { RelationshipFields, ExcludeFields, SharesRelatedFields } from "./filterFieldsEntity";
import type {
  SelectionFilter,
  SelectionFilterSchema,
  TagDefinition,
  DropdownOption,
  GraphPathAssert,
} from "./selectionFilterTypes";

type UpdateField<V = unknown> = (field: string, value: V) => void;

// ---------------------------------------------------------------------------
// Helpers that group related types to keep switch complexity low
// ---------------------------------------------------------------------------

const MULTI_TAG_LABELS: Record<string, string> = {
  has_tags: "Tags (must have ALL)",
  has_any_tag: "Tags (must have at least ONE)",
  lacks_any_tag: "Tags (exclude if has ANY)",
};

function renderTagFamily(
  filter: SelectionFilter,
  onUpdateField: UpdateField,
  tagRegistry: readonly TagDefinition[],
): React.JSX.Element | null {
  if (filter.type === "has_tag" || filter.type === "lacks_tag") {
    return (
      <SingleTagFields
        filter={filter}
        onUpdateField={onUpdateField as UpdateField<string | undefined>}
        tagRegistry={tagRegistry}
      />
    );
  }
  const multiLabel = MULTI_TAG_LABELS[filter.type];
  if (multiLabel) {
    return (
      <MultiTagFields
        filter={filter}
        onUpdateField={onUpdateField as UpdateField<string[]>}
        tagRegistry={tagRegistry}
        label={multiLabel}
      />
    );
  }
  return null;
}

function renderAttributeFamily(
  filter: SelectionFilter,
  onUpdateField: UpdateField,
  cultureOptions: readonly DropdownOption[],
  refOptions: readonly DropdownOption[],
): React.JSX.Element | null {
  if (filter.type === "has_culture") {
    return <CultureFields filter={filter} onUpdateField={onUpdateField as UpdateField<string | undefined>} cultureOptions={cultureOptions} />;
  }
  if (filter.type === "matches_culture") {
    return <MatchesCultureFields filter={filter} onUpdateField={onUpdateField as UpdateField<string | undefined>} refOptions={refOptions} />;
  }
  if (filter.type === "has_status") {
    return <StatusFields filter={filter} onUpdateField={onUpdateField as UpdateField<string>} />;
  }
  if (filter.type === "has_prominence") {
    return <ProminenceFields filter={filter} onUpdateField={onUpdateField as UpdateField<string | undefined>} />;
  }
  return null;
}

function renderEntityFamily(
  filter: SelectionFilter,
  onUpdateField: UpdateField,
  relationshipKindOptions: readonly DropdownOption[],
  refOptions: readonly DropdownOption[],
): React.JSX.Element | null {
  if (filter.type === "has_relationship" || filter.type === "lacks_relationship") {
    return <RelationshipFields filter={filter} onUpdateField={onUpdateField as UpdateField<string | undefined>} relationshipKindOptions={relationshipKindOptions} refOptions={refOptions} />;
  }
  if (filter.type === "exclude") {
    return <ExcludeFields filter={filter} onUpdateField={onUpdateField as UpdateField<string[]>} refOptions={refOptions} />;
  }
  if (filter.type === "shares_related") {
    return <SharesRelatedFields filter={filter} onUpdateField={onUpdateField as UpdateField<string | undefined>} relationshipKindOptions={relationshipKindOptions} refOptions={refOptions} />;
  }
  return null;
}

// ---------------------------------------------------------------------------
// FilterFieldsSwitch
// ---------------------------------------------------------------------------

interface FilterFieldsSwitchProps {
  readonly filter: SelectionFilter;
  readonly onUpdateField: UpdateField;
  readonly tagRegistry: readonly TagDefinition[];
  readonly relationshipKindOptions: readonly DropdownOption[];
  readonly refOptions: readonly DropdownOption[];
  readonly cultureOptions: readonly DropdownOption[];
  readonly schema?: SelectionFilterSchema;
  readonly availableRefs?: readonly string[];
}

export function FilterFieldsSwitch({
  filter,
  onUpdateField,
  tagRegistry,
  relationshipKindOptions,
  refOptions,
  cultureOptions,
  schema,
  availableRefs,
}: FilterFieldsSwitchProps) {
  const handleAssertChange = useCallback(
    (assert: GraphPathAssert) => onUpdateField("assert", assert),
    [onUpdateField],
  );

  const tagResult = renderTagFamily(filter, onUpdateField, tagRegistry);
  if (tagResult) return tagResult;

  const attrResult = renderAttributeFamily(filter, onUpdateField, cultureOptions, refOptions);
  if (attrResult) return attrResult;

  const entityResult = renderEntityFamily(filter, onUpdateField, relationshipKindOptions, refOptions);
  if (entityResult) return entityResult;

  if (filter.type === "graph_path") {
    return (
      <GraphPathEditor
        assert={filter.assert}
        onChange={handleAssertChange}
        schema={schema}
        availableRefs={availableRefs}
      />
    );
  }

  return <div className="text-muted">Unknown filter type: {filter.type}</div>;
}

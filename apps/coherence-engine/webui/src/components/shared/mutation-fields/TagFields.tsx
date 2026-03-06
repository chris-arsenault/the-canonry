/**
 * Fields for the "set_tag" and "remove_tag" mutation types
 */

import React, { useCallback, useMemo } from "react";
import { ReferenceDropdown } from "../index";
import TagSelector from "@the-canonry/shared-components/TagSelector";
import type { Mutation, EntityRefOption } from "../mutationUtils";
import { parseTagValue } from "../mutationUtils";

interface TagDefinition {
  name: string;
  rarity: string;
  description?: string;
  isAxis?: boolean;
}

interface TagFieldsProps {
  readonly mutation: Mutation;
  readonly update: (field: string, value: string | number | boolean | undefined) => void;
  readonly entityRefs: EntityRefOption[];
  readonly tagRegistry: TagDefinition[];
}

export function TagFields({
  mutation,
  update,
  entityRefs,
  tagRegistry,
}: TagFieldsProps) {
  const handleEntityChange = useCallback(
    (v: string | undefined) => update("entity", v),
    [update],
  );
  const tagValue = useMemo(
    () => (mutation.tag ? [mutation.tag] : []),
    [mutation.tag],
  );
  const handleTagChange = useCallback(
    (tags: string[]) => update("tag", tags[0] || ""),
    [update],
  );

  return (
    <>
      <ReferenceDropdown
        label="Entity"
        value={mutation.entity || ""}
        onChange={handleEntityChange}
        options={entityRefs}
        placeholder="Select entity..."
      />
      <div className="form-group">
        <label className="label">
          Tag
          <TagSelector
            value={tagValue}
            onChange={handleTagChange}
            tagRegistry={tagRegistry}
            placeholder="Select tag..."
            singleSelect
          />
        </label>
      </div>
    </>
  );
}

interface SetTagValueFieldsProps {
  readonly mutation: Mutation;
  readonly update: (field: string, value: string | number | boolean | undefined) => void;
}

export function SetTagValueFields({
  mutation,
  update,
}: SetTagValueFieldsProps) {
  const handleValueChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      update("value", parseTagValue(e.target.value)),
    [update],
  );
  const handleValueFromChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      update("valueFrom", e.target.value || undefined),
    [update],
  );

  return (
    <>
      <div className="form-group">
        <label htmlFor="value-optional" className="label">
          Value (optional)
        </label>
        <input
          id="value-optional"
          type="text"
          value={
            mutation.value !== undefined ? String(mutation.value) : ""
          }
          onChange={handleValueChange}
          className="input"
          placeholder="true"
          disabled={Boolean(mutation.valueFrom)}
        />
      </div>
      <div className="form-group">
        <label htmlFor="value-source-optional" className="label">
          Value Source (optional)
        </label>
        <input
          id="value-source-optional"
          type="text"
          value={mutation.valueFrom || ""}
          onChange={handleValueFromChange}
          className="input"
          placeholder="e.g., cluster_id"
        />
      </div>
    </>
  );
}

export default TagFields;

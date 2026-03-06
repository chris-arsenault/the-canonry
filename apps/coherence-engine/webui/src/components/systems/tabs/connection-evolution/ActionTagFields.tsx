/**
 * ActionTagFields - Fields for the "set_tag" action type.
 */

import React, { useCallback, useMemo } from "react";
import TagSelector from "@the-canonry/shared-components/TagSelector";
import type { TagDefinition } from "./types";

interface ActionTagFieldsProps {
  readonly tag: string | undefined;
  readonly actionValue: string | undefined;
  readonly onUpdateAction: (field: string, value: unknown) => void;
  readonly tagRegistry: readonly TagDefinition[];
}

export function ActionTagFields({
  tag,
  actionValue,
  onUpdateAction,
  tagRegistry,
}: ActionTagFieldsProps) {
  const tagValue = useMemo(
    () => (tag ? [tag] : []),
    [tag],
  );

  const handleTagChange = useCallback(
    (tags: string[]) => onUpdateAction("tag", tags[0] || ""),
    [onUpdateAction],
  );

  const handleValueChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      onUpdateAction("value", e.target.value || undefined),
    [onUpdateAction],
  );

  return (
    <>
      <div className="form-group">
        <label className="label">Tag
        <TagSelector
          value={tagValue}
          onChange={handleTagChange}
          tagRegistry={tagRegistry}
          placeholder="Select tag..."
          singleSelect
        />
        </label>
      </div>
      <div className="form-group">
        <label htmlFor="value-optional" className="label">Value (optional)</label>
        <input
          id="value-optional"
          type="text"
          value={actionValue ?? ""}
          onChange={handleValueChange}
          className="input"
          placeholder="true"
        />
      </div>
    </>
  );
}

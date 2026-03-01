/**
 * VariableCard - Individual variable editor card
 */

import React, { useCallback, useMemo } from "react";
import { useExpandBoolean } from "../../../shared";
import VariableSelectionEditor from "../../../shared/VariableSelectionEditor";
import type { VariableConfig, Schema } from "./types";

// ---------------------------------------------------------------------------
// VariableCardHeader
// ---------------------------------------------------------------------------

interface VariableCardHeaderProps {
  readonly name: string;
  readonly isRequired: boolean;
  readonly displayMode: string;
  readonly displayStrategy: string;
  readonly filterCount: number;
  readonly expanded: boolean;
  readonly hovering: boolean;
  readonly onToggle: () => void;
  readonly onHoverEnter: () => void;
  readonly onHoverLeave: () => void;
  readonly onRemove: () => void;
}

function VariableCardHeader({
  name,
  isRequired,
  displayMode,
  displayStrategy,
  filterCount,
  expanded,
  hovering,
  onToggle,
  onHoverEnter,
  onHoverLeave,
  onRemove,
}: VariableCardHeaderProps) {
  const keyDownHandler = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onToggle();
      }
    },
    [onToggle],
  );

  const handleRemoveClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onRemove();
    },
    [onRemove],
  );

  return (
    <div
      className={`item-card-header ${hovering ? "item-card-header-hover" : ""}`}
      onClick={onToggle}
      onMouseEnter={onHoverEnter}
      onMouseLeave={onHoverLeave}
      role="button"
      tabIndex={0}
      onKeyDown={keyDownHandler}
    >
      <div className="item-card-icon item-card-icon-variable">&#x1F4E6;</div>
      <div className="item-card-info">
        <div className="item-card-title">
          <span className="variable-ref">{name}</span>
          {isRequired && (
            <span className="badge badge-warning tab-required-badge">
              Required
            </span>
          )}
        </div>
        <div className="item-card-subtitle">
          {displayMode} &bull; {displayStrategy}
          {filterCount > 0 && (
            <span className="ml-xs">
              &bull; {filterCount} filter{filterCount > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>
      <div className="item-card-actions">
        <button className="btn-icon">{expanded ? "\u25B2" : "\u25BC"}</button>
        <button
          className="btn-icon btn-icon-danger"
          onClick={handleRemoveClick}
        >
          &times;
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// VariableCard
// ---------------------------------------------------------------------------

interface VariableCardProps {
  readonly name: string;
  readonly config: VariableConfig;
  readonly onChange: (config: VariableConfig) => void;
  readonly onRemove: () => void;
  readonly schema: Schema;
  readonly availableRefs: string[];
}

function VariableCard({
  name,
  config,
  onChange,
  onRemove,
  schema,
  availableRefs,
}: VariableCardProps) {
  const { expanded, toggle, hovering, setHovering } = useExpandBoolean();

  const selectConfig = config.select || {};
  const isRequired = config.required || false;

  const updateRequired = useCallback(
    (value: boolean) => {
      onChange({ ...config, required: value });
    },
    [config, onChange],
  );

  const handleSelectionChange = useCallback(
    (updated: Record<string, unknown>) => {
      onChange({ ...config, select: updated });
    },
    [config, onChange],
  );

  const displayMode = useMemo(() => {
    const from = selectConfig.from;
    if (!from || from === "graph") {
      return (selectConfig.kind as string) || "Not configured";
    }
    if (typeof from === "object" && from !== null && "path" in from) {
      const pathArr = (from as Record<string, unknown>).path as unknown[] | undefined;
      const stepCount = pathArr?.length || 0;
      return `Path traversal (${stepCount} step${stepCount !== 1 ? "s" : ""})`;
    }
    return "Related entities";
  }, [selectConfig.from, selectConfig.kind]);

  const displayStrategy = (selectConfig.pickStrategy as string) || "Not set";
  const filterCount = ((selectConfig.filters as unknown[]) || []).length;

  const handleHoverEnter = useCallback(() => setHovering(true), [setHovering]);
  const handleHoverLeave = useCallback(() => setHovering(false), [setHovering]);

  return (
    <div className="item-card">
      <VariableCardHeader
        name={name}
        isRequired={isRequired}
        displayMode={displayMode}
        displayStrategy={displayStrategy}
        filterCount={filterCount}
        expanded={expanded}
        hovering={hovering}
        onToggle={toggle}
        onHoverEnter={handleHoverEnter}
        onHoverLeave={handleHoverLeave}
        onRemove={onRemove}
      />

      {expanded && (
        <div className="item-card-body">
          <div className="mb-xl">
            <label className="tab-checkbox-label">
              <input
                type="checkbox"
                checked={isRequired}
                onChange={(e) => updateRequired(e.target.checked)}
              />
              <span className="label mb-0">Required</span>
              <span className="text-muted tab-required-hint">
                (Entity is skipped if this variable can&apos;t be resolved)
              </span>
            </label>
          </div>

          <VariableSelectionEditor
            value={selectConfig}
            onChange={handleSelectionChange}
            schema={schema}
            availableRefs={availableRefs}
          />
        </div>
      )}
    </div>
  );
}

export default VariableCard;

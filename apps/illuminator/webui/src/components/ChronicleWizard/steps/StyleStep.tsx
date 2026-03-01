/**
 * StyleStep - Step 1: Narrative style selection
 *
 * Shows a grid of available narrative styles with role previews.
 */

import React, { useState, useMemo, useEffect } from "react";
import type {
  NarrativeStyle,
  RoleDefinition,
} from "@canonry/world-schema";
import { useWizard } from "../WizardContext";
import { getNarrativeStyleUsageStats } from "../../../lib/db/chronicleRepository";
import "./StyleStep.css";

/** Get roles from either story or document style */
function getRoles(style: NarrativeStyle): RoleDefinition[] {
  if (style.format === "story") {
    return (style).roles || [];
  }
  // Document styles have roles directly on the style object
  const docStyle = style;
  return docStyle.roles || [];
}

interface StyleStepProps {
  styles: NarrativeStyle[];
}

export default function StyleStep({ styles }: Readonly<StyleStepProps>) {
  const { state, selectStyle, setAcceptDefaults, simulationRunId } = useWizard();
  const [searchText, setSearchText] = useState("");
  const [formatFilter, setFormatFilter] = useState<"all" | "story" | "document">("all");
  const [styleUsage, setStyleUsage] = useState<Map<string, { usageCount: number }>>(new Map());
  const [usageLoading, setUsageLoading] = useState(false);

  // Clear usage when no simulationRunId
  useEffect(() => {
    if (simulationRunId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clear async usage state when simulation is unset
    setStyleUsage(new Map());
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clear async usage state when simulation is unset
    setUsageLoading(false);
  }, [simulationRunId]);

  useEffect(() => {
    if (!simulationRunId) return;

    let isActive = true;
    setUsageLoading(true);

    getNarrativeStyleUsageStats(simulationRunId)
      .then((stats) => {
        if (isActive) setStyleUsage(stats);
      })
      .catch((err) => {
        console.error("[Chronicle Wizard] Failed to load narrative style usage stats:", err);
        if (isActive) setStyleUsage(new Map());
      })
      .finally(() => {
        if (isActive) setUsageLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [simulationRunId]);

  // Filter styles
  const filteredStyles = useMemo(() => {
    return styles.filter((style) => {
      // Format filter
      if (formatFilter !== "all" && style.format !== formatFilter) {
        return false;
      }
      // Search filter
      if (searchText.trim()) {
        const search = searchText.toLowerCase();
        return (
          style.name.toLowerCase().includes(search) ||
          style.description.toLowerCase().includes(search) ||
          style.tags?.some((tag) => tag.toLowerCase().includes(search))
        );
      }
      return true;
    });
  }, [styles, formatFilter, searchText]);

  // Group by format
  const storyStyles = filteredStyles.filter((s) => s.format === "story");
  const documentStyles = filteredStyles.filter((s) => s.format === "document");

  return (
    <div>
      {/* Header */}
      <div className="sstep-header">
        <h4 className="sstep-title">Select Narrative Style</h4>
        <p className="sstep-subtitle">
          Choose a style that defines the structure and roles for your chronicle.
        </p>
      </div>

      {/* Filters */}
      <div className="sstep-filters">
        <input
          type="text"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Search styles..."
          className="illuminator-input sstep-search"
        />
        <select
          value={formatFilter}
          onChange={(e) => setFormatFilter(e.target.value as "all" | "story" | "document")}
          className="illuminator-select"
        >
          <option value="all">All Formats</option>
          <option value="story">Stories</option>
          <option value="document">Documents</option>
        </select>

        {/* Accept Defaults Checkbox */}
        <label className="sstep-defaults-label">
          <input
            type="checkbox"
            checked={state.acceptDefaults}
            onChange={(e) => setAcceptDefaults(e.target.checked)}
          />
          Accept defaults for quick generation
        </label>
      </div>

      {/* Styles Grid */}
      <div className="sstep-scroll">
        {formatFilter === "all" || formatFilter === "story" ? (
          <>
            {storyStyles.length > 0 && formatFilter === "all" && (
              <h5 className="sstep-group-heading">
                Story Styles ({storyStyles.length})
              </h5>
            )}
            <div className="sstep-grid sstep-grid-mb">
              {storyStyles.map((style) => (
                <StyleCard
                  key={style.id}
                  style={style}
                  isSelected={state.narrativeStyleId === style.id}
                  usageCount={styleUsage.get(style.id)?.usageCount ?? 0}
                  usageLoading={usageLoading}
                  onSelect={() => selectStyle(style, state.acceptDefaults)}
                />
              ))}
            </div>
          </>
        ) : null}

        {formatFilter === "all" || formatFilter === "document" ? (
          <>
            {documentStyles.length > 0 && formatFilter === "all" && (
              <h5 className="sstep-group-heading">
                Document Styles ({documentStyles.length})
              </h5>
            )}
            <div className="sstep-grid">
              {documentStyles.map((style) => (
                <StyleCard
                  key={style.id}
                  style={style}
                  isSelected={state.narrativeStyleId === style.id}
                  usageCount={styleUsage.get(style.id)?.usageCount ?? 0}
                  usageLoading={usageLoading}
                  onSelect={() => selectStyle(style, state.acceptDefaults)}
                />
              ))}
            </div>
          </>
        ) : null}

        {filteredStyles.length === 0 && (
          <div className="ilu-empty sstep-empty">
            No styles match your search.
          </div>
        )}
      </div>

      {/* Selected Style Details */}
      {state.narrativeStyle && (
        <div className="sstep-selected-detail">
          <h5 className="sstep-selected-name">
            {state.narrativeStyle.name}
            <span
              className={`sstep-format-badge ${state.narrativeStyle.format === "story" ? "sstep-format-badge-story" : "sstep-format-badge-document"}`}
            >
              {state.narrativeStyle.format}
            </span>
          </h5>
          <p className="sstep-selected-desc">
            {state.narrativeStyle.description}
          </p>
          <div className="sstep-usage-info">
            {usageLoading
              ? "Usage in this run: …"
              : `Usage in this run: ${styleUsage.get(state.narrativeStyle.id)?.usageCount ?? 0}x`}
          </div>

          {/* Role Requirements */}
          <div>
            <span className="sstep-roles-label">
              Required Roles:
            </span>
            <div className="sstep-roles-list">
              {getRoles(state.narrativeStyle).map((role) => (
                <span
                  key={role.role}
                  className="sstep-role-chip"
                  title={role.description}
                >
                  {role.role}
                  <span className="sstep-role-count">
                    ({role.count.min}-{role.count.max})
                  </span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Style Card Component
// =============================================================================

interface StyleCardProps {
  style: NarrativeStyle;
  isSelected: boolean;
  usageCount: number;
  usageLoading: boolean;
  onSelect: () => void;
}

function StyleCard({ style, isSelected, usageCount, usageLoading, onSelect }: Readonly<StyleCardProps>) {
  const roles = getRoles(style);
  const roleCount = roles.length;
  const requiredCount = roles.filter((r) => r.count.min > 0).length;

  return (
    <div
      onClick={onSelect}
      className={`sstep-card ${isSelected ? "sstep-card-selected" : ""}`}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onSelect(e); }}
    >
      <div className="sstep-card-header">
        <span className="sstep-card-name">{style.name}</span>
        <div className="sstep-card-badges">
          <span
            className="sstep-card-usage-badge"
            style={{
              '--sstep-usage-color': usageCount > 0 ? "var(--text-secondary)" : "var(--text-muted)",
            } as React.CSSProperties}
            title="Times this style has been used in the current run"
          >
            {usageLoading ? "…" : `${usageCount}x used`}
          </span>
          <span
            className={`sstep-card-format-badge ${style.format === "story" ? "sstep-card-format-story" : "sstep-card-format-document"}`}
          >
            {style.format}
          </span>
        </div>
      </div>

      <p className="sstep-card-desc">
        {style.description}
      </p>

      <div className="sstep-card-footer">
        <span className="sstep-card-role-count">
          {roleCount} roles ({requiredCount} required)
        </span>
        {style.tags?.slice(0, 3).map((tag) => (
          <span key={tag} className="sstep-card-tag">
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * EntityDetailSidebar - Metadata sidebar for EntityDetailView.
 *
 * Extracted to reduce EntityDetailView complexity and file length.
 */

import React, { useState } from "react";
import type { NetworkDebugInfo, DescriptionChainDebug } from "../lib/enrichmentTypes";
import { useExpandBoolean } from "@canonry/shared-components";

// ─── Types ───────────────────────────────────────────────────────────────

interface TextEnrichment {
  model: string;
  generatedAt: number;
  estimatedCost?: number;
  actualCost?: number;
  inputTokens?: number;
  outputTokens?: number;
}

interface SidebarEntity {
  id: string;
  status: string;
  createdAt?: number;
  updatedAt?: number;
}

interface EntityDetailSidebarProps {
  entity: SidebarEntity;
  textEnrichment: TextEnrichment | undefined;
  chainDebug: DescriptionChainDebug | undefined;
  legacyDebug: NetworkDebugInfo | undefined;
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function formatDate(timestamp: number | undefined): string {
  if (!timestamp) return "Unknown";
  return new Date(timestamp).toLocaleString();
}

function formatCost(cost: number | undefined): string {
  if (!cost) return "N/A";
  return `$${cost.toFixed(4)}`;
}

// ─── Sub-components ──────────────────────────────────────────────────────

function MetadataRow({ label, value }: Readonly<{ label: string; value: string | undefined | null }>) {
  if (!value) return null;
  return (
    <div className="edv-meta-row">
      <div className="ilu-hint-sm edv-meta-row-label">{label}</div>
      <div className="edv-meta-row-value">{value}</div>
    </div>
  );
}

function ExpandableSection({
  title,
  content,
  charCount,
}: Readonly<{
  title: string;
  content: string | undefined;
  charCount?: number;
}>) {
  const { expanded, toggle, headerProps } = useExpandBoolean();
  if (!content) return null;

  return (
    <div className="edv-expandable">
      <button {...headerProps} className="edv-expandable-toggle">
        <span className={`edv-expandable-arrow ${expanded ? "edv-expandable-arrow-open" : ""}`}>
          &#9654;
        </span>
        <span className="edv-expandable-title">{title}</span>
        {charCount !== undefined && <span className="edv-expandable-chars">{charCount} chars</span>}
      </button>
      {expanded && <div className="edv-expandable-content">{content}</div>}
    </div>
  );
}

function ChainDebugStep({
  stepNumber,
  label,
  colorClass,
  debug,
}: Readonly<{
  stepNumber: number;
  label: string;
  colorClass: string;
  debug: { request?: string; response?: string };
}>) {
  return (
    <div className="edv-debug-step">
      <div className={`edv-debug-step-label ${colorClass}`}>
        Step {stepNumber}: {label}
      </div>
      <ExpandableSection
        title="Request"
        content={debug.request}
        charCount={debug.request?.length}
      />
      <ExpandableSection
        title="Response"
        content={debug.response}
        charCount={debug.response?.length}
      />
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────

export default function EntityDetailSidebar({
  entity,
  textEnrichment,
  chainDebug,
  legacyDebug,
}: Readonly<EntityDetailSidebarProps>) {
  return (
    <div className="edv-sidebar">
      <h4 className="edv-sidebar-title">Entity Metadata</h4>

      {/* Basic info */}
      <MetadataRow label="Entity ID" value={entity.id} />
      <MetadataRow label="Status" value={entity.status} />
      <MetadataRow label="Created" value={formatDate(entity.createdAt)} />
      <MetadataRow label="Updated" value={formatDate(entity.updatedAt)} />

      {/* Description generation info */}
      {textEnrichment && (
        <>
          <div className="edv-sidebar-divider" />
          <div className="ilu-hint-sm edv-sidebar-section-label">Description Generation</div>
          <MetadataRow label="Model" value={textEnrichment.model} />
          <MetadataRow label="Generated" value={formatDate(textEnrichment.generatedAt)} />
          <MetadataRow
            label="Estimated Cost"
            value={formatCost(textEnrichment.estimatedCost)}
          />
          <MetadataRow label="Actual Cost" value={formatCost(textEnrichment.actualCost)} />
          {textEnrichment.inputTokens !== undefined && (
            <MetadataRow
              label="Tokens"
              value={`${textEnrichment.inputTokens} in / ${textEnrichment.outputTokens || 0} out`}
            />
          )}
        </>
      )}

      {/* Debug Info */}
      {(chainDebug || legacyDebug) && (
        <>
          <div className="edv-sidebar-divider" />
          <div className="ilu-hint-sm edv-sidebar-section-label">Debug Info</div>

          {chainDebug && (
            <>
              {chainDebug.narrative && (
                <ChainDebugStep
                  stepNumber={1}
                  label="Narrative"
                  colorClass="edv-debug-step-label-narrative"
                  debug={chainDebug.narrative}
                />
              )}
              {chainDebug.thesis && (
                <ChainDebugStep
                  stepNumber={2}
                  label="Visual Thesis"
                  colorClass="edv-debug-step-label-thesis"
                  debug={chainDebug.thesis}
                />
              )}
              {chainDebug.traits && (
                <ChainDebugStep
                  stepNumber={3}
                  label="Visual Traits"
                  colorClass="edv-debug-step-label-traits"
                  debug={chainDebug.traits}
                />
              )}
            </>
          )}

          {!chainDebug && legacyDebug && (
            <>
              <ExpandableSection
                title="Request"
                content={legacyDebug.request}
                charCount={legacyDebug.request?.length}
              />
              <ExpandableSection
                title="Response"
                content={legacyDebug.response}
                charCount={legacyDebug.response?.length}
              />
            </>
          )}
        </>
      )}

      {!chainDebug && !legacyDebug && textEnrichment && (
        <div className="ilu-hint edv-no-debug">
          Debug info not available. This entity may have been enriched before debug
          persistence was added.
        </div>
      )}
    </div>
  );
}

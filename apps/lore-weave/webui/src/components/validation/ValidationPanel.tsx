/**
 * ValidationPanel - Structure Validation UI
 */

import React, { useMemo } from "react";
import { validateAllConfigs, type SchemaError, type SchemaValidationResult } from "../../../../lib/engine/configSchemaValidator";
import { ErrorMessage } from "@the-canonry/shared-components";
import "./ValidationPanel.css";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EntityKind {
  kind: string;
}

interface RelationshipKind {
  kind: string;
}

interface Culture {
  id: string;
  naming?: { profiles?: unknown[] };
}

interface Schema {
  entityKinds: EntityKind[];
  relationshipKinds: RelationshipKind[];
  cultures: Culture[];
}

interface ValidationPanelProps {
  schema: Schema;
  eras: unknown[];
  generators: unknown[];
  pressures: unknown[];
  systems: unknown[];
  actions: unknown[];
  seedEntities: unknown[];
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ErrorCard({ error }: { error: SchemaError }) {
  return (
    <div className="validation-panel-error-card">
      <ErrorMessage
        title={error.path}
        message={error.message}
        className="validation-panel-error-header"
      />
      <div className="validation-panel-error-body">
        <div className="validation-panel-error-row">
          <span className="validation-panel-error-label">Expected:</span>
          <code className="validation-panel-error-value">{error.expected}</code>
        </div>
        <div className="validation-panel-error-row">
          <span className="validation-panel-error-label">Got:</span>
          <code className="validation-panel-error-value">{JSON.stringify(error.value)}</code>
        </div>
        {error.suggestion && (
          <div className="validation-panel-suggestion">
            <div className="validation-panel-suggestion-label">Suggestion</div>
            <div className="validation-panel-suggestion-text">{error.suggestion}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function WarningCard({ warning }: { warning: SchemaError }) {
  return (
    <div className="validation-panel-warning-card">
      <div className="validation-panel-warning-header">
        <div className="validation-panel-warning-path">{warning.path}</div>
        <div className="validation-panel-error-message">{warning.message}</div>
      </div>
      {warning.suggestion && (
        <div className="validation-panel-error-body">
          <div className="validation-panel-suggestion">
            <div className="validation-panel-suggestion-label">Suggestion</div>
            <div className="validation-panel-suggestion-text">{warning.suggestion}</div>
          </div>
        </div>
      )}
    </div>
  );
}

interface StatCardProps {
  value: number;
  label: string;
}

function StatCard({ value, label }: StatCardProps) {
  return (
    <div className="validation-panel-stat-card">
      <div className="validation-panel-stat-value">{value}</div>
      <div className="validation-panel-stat-label">{label}</div>
    </div>
  );
}

function StatusBanner({ valid, errorCount, warningCount }: { valid: boolean; errorCount: number; warningCount: number }) {
  return (
    <div
      className={`validation-panel-status-banner ${
        valid ? "validation-panel-status-valid" : "validation-panel-status-invalid"
      }`}
    >
      <span className="validation-panel-status-icon">{valid ? "\u2713" : "\u2717"}</span>
      <div className="validation-panel-status-text">
        <div className="validation-panel-status-title">
          {valid ? "Configuration is valid" : "Configuration has errors"}
        </div>
        <div className="validation-panel-status-subtitle">
          {errorCount} error{errorCount !== 1 ? "s" : ""}, {warningCount} warning
          {warningCount !== 1 ? "s" : ""}
        </div>
      </div>
    </div>
  );
}

function IssueSection({ title, count, variant, items, renderItem }: {
  title: string;
  count: number;
  variant: "error" | "warning";
  items: SchemaError[];
  renderItem: (item: SchemaError, index: number) => React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <div className="validation-panel-section">
      <h2 className="validation-panel-section-title">
        {title}
        <span className={`validation-panel-section-count validation-panel-section-count-${variant}`}>
          {count}
        </span>
      </h2>
      <div className="validation-panel-list">
        {items.map(renderItem)}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ValidationPanel({
  schema,
  eras,
  generators,
  pressures,
  systems,
  actions,
  seedEntities,
}: ValidationPanelProps) {
  const validationResult: SchemaValidationResult = useMemo(() => {
    const cultures = schema?.cultures?.map((c) => c.id) || [];
    const entityKinds = schema?.entityKinds?.map((k) => k.kind) || [];
    const relationshipKinds = schema?.relationshipKinds?.map((k) => k.kind) || [];

    return validateAllConfigs({
      templates: generators,
      pressures,
      systems,
      eras,
      actions,
      seedEntities,
      schema: { cultures, entityKinds, relationshipKinds },
    });
  }, [schema, eras, generators, pressures, systems, actions, seedEntities]);

  const { valid, errors, warnings } = validationResult;

  const stats = useMemo(() => [
    { value: generators?.length || 0, label: "Generators" },
    { value: pressures?.length || 0, label: "Pressures" },
    { value: systems?.length || 0, label: "Systems" },
    { value: actions?.length || 0, label: "Actions" },
    { value: eras?.length || 0, label: "Eras" },
    { value: seedEntities?.length || 0, label: "Seed Entities" },
  ], [generators?.length, pressures?.length, systems?.length, actions?.length, eras?.length, seedEntities?.length]);

  return (
    <div className="validation-panel-container">
      <div className="validation-panel-header">
        <h1 className="validation-panel-title">Structure Validation</h1>
        <p className="validation-panel-subtitle">
          Validates JSON config structure (types, required fields, shapes). This is a hard gate
          before simulation. For semantic validation (references, balance, orphans), see the
          Coherence Engine tab.
        </p>
      </div>

      <StatusBanner valid={valid} errorCount={errors.length} warningCount={warnings.length} />

      <IssueSection
        title="Errors"
        count={errors.length}
        variant="error"
        items={errors}
        renderItem={(error, i) => <ErrorCard key={i} error={error} />}
      />

      <IssueSection
        title="Warnings"
        count={warnings.length}
        variant="warning"
        items={warnings}
        renderItem={(warning, i) => <WarningCard key={i} warning={warning} />}
      />

      {valid && warnings.length === 0 && (
        <div className="validation-panel-empty-state">
          <div className="validation-panel-empty-icon">{"\u2713"}</div>
          <div>All configuration files are valid and ready for simulation.</div>
        </div>
      )}

      <div className="validation-panel-stats">
        {stats.map((s) => (
          <StatCard key={s.label} value={s.value} label={s.label} />
        ))}
      </div>
    </div>
  );
}

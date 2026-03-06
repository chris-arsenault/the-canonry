/**
 * ConfigurationSummary - Displays a summary of all configuration for the simulation
 *
 * Shows what data has been configured in canonry and is available for the simulation.
 */

import React, { useMemo } from "react";
import "./ConfigurationSummary.css";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ValidationStats {
  entityKinds: number;
  relationshipKinds: number;
  cultures: number;
  eras: number;
  pressures: number;
  generators: number;
  seedEntities: number;
  seedRelationships: number;
}

interface ValidationResult {
  isValid: boolean;
  issues: string[];
  warnings: string[];
  stats: ValidationStats;
}

interface Era {
  id: string;
  name?: string;
  summary?: string;
}

interface Culture {
  id: string;
  name: string;
  color?: string;
}

interface EntityKind {
  id?: string;
  kind?: string;
  name?: string;
}

interface Generator {
  id: string;
  name?: string;
}

interface Pressure {
  id: string;
  name?: string;
}

interface Schema {
  cultures: Culture[];
  entityKinds: EntityKind[];
}

interface ConfigurationSummaryProps {
  schema: Schema;
  eras: Era[];
  pressures: Pressure[];
  generators: Generator[];
  validation: ValidationResult;
  onNavigateToRun: () => void;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({ label, value }: Readonly<{ label: string; value: number }>) {
  return (
    <div className="lw-stat-card">
      <div className="lw-stat-card-label">{label}</div>
      <div className={`lw-stat-card-value ${value === 0 ? "zero" : ""}`}>{value}</div>
    </div>
  );
}

function ValidationBox({ validation }: Readonly<{ validation: ValidationResult }>) {
  return (
    <div className={`lw-validation-box ${validation.isValid ? "valid" : "invalid"}`}>
      <div className={`lw-validation-title ${validation.isValid ? "valid" : "invalid"}`}>
        {validation.isValid ? "Configuration is ready" : "Configuration incomplete"}
      </div>

      {validation.issues.length > 0 && (
        <ul className="lw-validation-list">
          {validation.issues.map((issue, i) => (
            <li key={i} className="lw-validation-item error">
              {issue}
            </li>
          ))}
        </ul>
      )}

      {validation.warnings.length > 0 && (
        <ul
          className={`lw-validation-list ${validation.issues.length > 0 ? "cs-warning-gap" : ""}`}
        >
          {validation.warnings.map((warning, i) => (
            <li key={i} className="lw-validation-item warning">
              {warning}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface BadgeItem {
  key: string;
  label: string;
}

function ItemBadgeList({ title, items, emptyMessage }: Readonly<{
  title: string;
  items: BadgeItem[];
  emptyMessage: string;
}>) {
  return (
    <div className="viewer-section cs-padded-card">
      <h2 className="viewer-section-title">{title}</h2>
      {items.length === 0 ? (
        <div className="viewer-empty-state cs-compact-placeholder">
          {emptyMessage}
        </div>
      ) : (
        <div className="lw-item-list">
          {items.map((item) => (
            <span key={item.key} className="lw-item-badge">
              {item.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ErasSection({ eras }: Readonly<{ eras: Era[] }>) {
  return (
    <div className="viewer-section cs-padded-card">
      <h2 className="viewer-section-title">Eras ({eras.length})</h2>
      {eras.length === 0 ? (
        <div className="viewer-empty-state cs-compact-placeholder">
          No eras defined. Configure eras in the Coherence Engine tab.
        </div>
      ) : (
        eras.map((era) => (
          <div key={era.id} className="lw-detail-card">
            <div className="lw-detail-header">
              <span className="lw-detail-name">{era.name ?? era.id}</span>
              <span className="lw-detail-id">{era.id}</span>
            </div>
            {era.summary && <div className="lw-detail-description">{era.summary}</div>}
          </div>
        ))
      )}
    </div>
  );
}

function CulturesSection({ cultures }: Readonly<{ cultures: Culture[] }>) {
  return (
    <div className="viewer-section cs-padded-card">
      <h2 className="viewer-section-title">Cultures ({cultures.length})</h2>
      {cultures.length === 0 ? (
        <div className="viewer-empty-state cs-compact-placeholder">
          No cultures defined. Configure cultures in the Enumerist tab.
        </div>
      ) : (
        <div className="lw-item-list">
          {cultures.map((culture) => (
            <span
              key={culture.id}
              className="lw-item-badge cs-culture-badge"
              style={{
                '--cs-culture-badge-border': culture.color ?? '',
                '--cs-culture-badge-color': culture.color ?? '',
              } as React.CSSProperties}
            >
              {culture.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function StatsGrid({ stats }: Readonly<{ stats: ValidationStats }>) {
  return (
    <div className="lw-stats-grid">
      <StatCard label="Entity Kinds" value={stats.entityKinds} />
      <StatCard label="Relationship Kinds" value={stats.relationshipKinds} />
      <StatCard label="Cultures" value={stats.cultures} />
      <StatCard label="Eras" value={stats.eras} />
      <StatCard label="Pressures" value={stats.pressures} />
      <StatCard label="Generators" value={stats.generators} />
      <StatCard label="Seed Entities" value={stats.seedEntities} />
      <StatCard label="Seed Relationships" value={stats.seedRelationships} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ConfigurationSummary({
  schema,
  eras,
  pressures,
  generators,
  validation,
  onNavigateToRun,
}: Readonly<ConfigurationSummaryProps>) {
  const entityKindItems = useMemo(
    () =>
      schema.entityKinds.map((ek) => ({
        key: ek.kind ?? ek.id ?? "",
        label: ek.name ?? ek.kind ?? ek.id ?? "",
      })),
    [schema.entityKinds],
  );

  const generatorItems = useMemo(
    () =>
      generators.map((gen) => ({
        key: gen.id,
        label: gen.name ?? gen.id,
      })),
    [generators],
  );

  const pressureItems = useMemo(
    () =>
      pressures.map((p) => ({
        key: p.id,
        label: p.name ?? p.id,
      })),
    [pressures],
  );

  return (
    <div className="lw-container">
      <div className="lw-header">
        <h1 className="lw-title">Configuration Summary</h1>
        <p className="lw-subtitle">Review the world configuration before running the simulation</p>
      </div>

      <ValidationBox validation={validation} />
      <StatsGrid stats={validation.stats} />
      <ErasSection eras={eras} />
      <CulturesSection cultures={schema.cultures} />

      <ItemBadgeList
        title={`Entity Kinds (${schema.entityKinds.length})`}
        items={entityKindItems}
        emptyMessage="No entity kinds defined. Configure entity kinds in the Enumerist tab."
      />

      <ItemBadgeList
        title={`Generators (${generators.length})`}
        items={generatorItems}
        emptyMessage="No generators defined. Configure generators in the Coherence Engine tab."
      />

      <ItemBadgeList
        title={`Pressures (${pressures.length})`}
        items={pressureItems}
        emptyMessage="No pressures defined. Configure pressures in the Coherence Engine tab."
      />

      <button
        className={`lw-btn lw-btn-primary ${!validation.isValid ? "disabled" : ""}`}
        onClick={onNavigateToRun}
        disabled={!validation.isValid}
      >
        Continue to Run
      </button>
    </div>
  );
}

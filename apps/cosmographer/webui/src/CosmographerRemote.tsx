/**
 * CosmographerRemote - Module Federation entry point for Cosmographer.
 *
 * Receives schema, seed data, and callbacks from The Canonry shell.
 * Routes updates to the appropriate shell callbacks.
 */

import React, { useMemo, useCallback } from "react";
import type { Optional } from "@the-canonry/shared-components";
import SemanticPlaneEditor from "./components/SemanticPlane/index.tsx";
import CultureEditor from "./components/CultureEditor/index.tsx";
import EntityEditor from "./components/EntityEditor/index.tsx";
import RelationshipEditor from "./components/RelationshipEditor/index.tsx";
import AxisRegistryEditor from "./components/AxisRegistry/index.tsx";
import "@the-canonry/shared-components/styles";
import "./CosmographerRemote.css";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CosmographerSchema {
  entityKinds: Optional<unknown[]>;
  relationshipKinds: Optional<unknown[]>;
  cultures: Optional<unknown[]>;
  tagRegistry: Optional<unknown[]>;
}

interface InternalProject {
  entityKinds: unknown[];
  relationshipKinds: unknown[];
  cultures: unknown[];
  axisDefinitions: unknown[];
  seedEntities: unknown[];
  seedRelationships: unknown[];
  tagRegistry: unknown[];
}

interface CosmographerRemoteProps {
  schema: Optional<CosmographerSchema>;
  axisDefinitions: Optional<unknown[]>;
  seedEntities: Optional<unknown[]>;
  seedRelationships: Optional<unknown[]>;
  onEntityKindsChange: Optional<(kinds: unknown[]) => void>;
  onCulturesChange: Optional<(cultures: unknown[]) => void>;
  onAxisDefinitionsChange: Optional<(defs: unknown[]) => void>;
  onTagRegistryChange: Optional<(registry: unknown[]) => void>;
  onSeedEntitiesChange: Optional<(entities: unknown[]) => void>;
  onSeedRelationshipsChange: Optional<(rels: unknown[]) => void>;
  onAddTag: Optional<(tag: unknown) => void>;
  activeSection: Optional<string>;
  onSectionChange: Optional<(section: string) => void>;
  schemaUsage: Optional<Record<string, unknown>>;
}

// ---------------------------------------------------------------------------
// Constants & helpers
// ---------------------------------------------------------------------------

const TABS = [
  { id: "axes", label: "Axis Registry" },
  { id: "planes", label: "Semantic Planes" },
  { id: "cultures", label: "Culture Biases" },
  { id: "entities", label: "Entities" },
  { id: "relationships", label: "Relationships" },
];

// eslint-disable-next-line complexity -- 12 branches from || defaults normalizing Optional shell props; data normalization, not decision logic
function buildProject(
  schema: Optional<CosmographerSchema>,
  axisDefinitions: Optional<unknown[]>,
  seedEntities: Optional<unknown[]>,
  seedRelationships: Optional<unknown[]>,
): InternalProject {
  return {
    entityKinds: schema?.entityKinds || [],
    relationshipKinds: schema?.relationshipKinds || [],
    cultures: schema?.cultures || [],
    axisDefinitions: axisDefinitions || [],
    seedEntities: seedEntities || [],
    seedRelationships: seedRelationships || [],
    tagRegistry: schema?.tagRegistry || [],
  };
}

function hasSchemaContent(schema: Optional<CosmographerSchema>): boolean {
  return (schema?.entityKinds?.length ?? 0) > 0 || (schema?.cultures?.length ?? 0) > 0;
}

function dispatchUpdates(
  updates: Partial<InternalProject>,
  onEntityKindsChange: Optional<(kinds: unknown[]) => void>,
  onCulturesChange: Optional<(cultures: unknown[]) => void>,
  onSeedEntitiesChange: Optional<(entities: unknown[]) => void>,
  onSeedRelationshipsChange: Optional<(rels: unknown[]) => void>,
): void {
  if (updates.entityKinds && onEntityKindsChange) onEntityKindsChange(updates.entityKinds);
  if (updates.seedEntities && onSeedEntitiesChange) onSeedEntitiesChange(updates.seedEntities);
  if (updates.seedRelationships && onSeedRelationshipsChange) onSeedRelationshipsChange(updates.seedRelationships);
  if (updates.cultures && onCulturesChange) onCulturesChange(updates.cultures);
}

// ---------------------------------------------------------------------------
// TabContent
// ---------------------------------------------------------------------------

interface TabContentProps {
  activeTab: string;
  project: InternalProject;
  onSave: (updates: Partial<InternalProject>) => void;
  onAxisDefinitionsChange: Optional<(defs: unknown[]) => void>;
  onTagRegistryChange: Optional<(registry: unknown[]) => void>;
  onAddTag: Optional<(tag: unknown) => void>;
  schemaUsage: Optional<Record<string, unknown>>;
}

function TabContent({
  activeTab,
  project,
  onSave,
  onAxisDefinitionsChange,
  onTagRegistryChange,
  onAddTag,
  schemaUsage,
}: Readonly<TabContentProps>) {
  switch (activeTab) {
    case "axes":
      return (
        <AxisRegistryEditor
          axisDefinitions={project.axisDefinitions}
          entityKinds={project.entityKinds}
          tagRegistry={project.tagRegistry}
          onAxisDefinitionsChange={onAxisDefinitionsChange}
          onTagRegistryChange={onTagRegistryChange}
        />
      );
    case "planes":
      return (
        <SemanticPlaneEditor
          project={project}
          onSave={onSave}
          axisDefinitions={project.axisDefinitions}
        />
      );
    case "cultures":
      return <CultureEditor project={project} onSave={onSave} />;
    case "entities":
      return (
        <EntityEditor
          project={project}
          onSave={onSave}
          onAddTag={onAddTag}
          schemaUsage={schemaUsage}
        />
      );
    case "relationships":
      return <RelationshipEditor project={project} onSave={onSave} />;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// CosmographerRemote
// ---------------------------------------------------------------------------

export default function CosmographerRemote({
  schema,
  axisDefinitions,
  seedEntities,
  seedRelationships,
  onEntityKindsChange,
  onCulturesChange,
  onAxisDefinitionsChange,
  onTagRegistryChange,
  onSeedEntitiesChange,
  onSeedRelationshipsChange,
  onAddTag,
  activeSection,
  onSectionChange,
  schemaUsage,
}: Readonly<CosmographerRemoteProps>) {
  const activeTab = activeSection || "axes";
  const setActiveTab = onSectionChange || (() => {});

  const project = useMemo(
    () => buildProject(schema, axisDefinitions, seedEntities, seedRelationships),
    [schema, axisDefinitions, seedEntities, seedRelationships],
  );

  const handleSave = useCallback(
    (updates: Partial<InternalProject>) =>
      dispatchUpdates(updates, onEntityKindsChange, onCulturesChange, onSeedEntitiesChange, onSeedRelationshipsChange),
    [onEntityKindsChange, onCulturesChange, onSeedEntitiesChange, onSeedRelationshipsChange],
  );

  if (!hasSchemaContent(schema)) {
    return (
      <div className="rs-container">
        <div className="rs-no-data">
          <div className="rs-no-data-title">No Schema Defined</div>
          <div>
            Define entity kinds and cultures in the <strong>Enumerist</strong> tab first, then
            return here to place entities and manage relationships.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rs-container">
      <div className="rs-sidebar">
        <nav className="rs-nav">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`rs-nav-button ${activeTab === tab.id ? "rs-nav-button-active" : "rs-nav-button-inactive"}`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="rs-main">
        <div className="rs-content">
          <TabContent
            activeTab={activeTab}
            project={project}
            onSave={handleSave}
            onAxisDefinitionsChange={onAxisDefinitionsChange}
            onTagRegistryChange={onTagRegistryChange}
            onAddTag={onAddTag}
            schemaUsage={schemaUsage}
          />
        </div>
      </div>
    </div>
  );
}

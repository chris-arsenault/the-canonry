/**
 * CosmographerRemote - Module Federation entry point for Cosmographer
 *
 * This component is loaded by The Canonry shell and receives:
 * - schema: Read-only world schema (entityKinds, relationshipKinds, cultures)
 * - seedEntities: Array of seed entities
 * - seedRelationships: Array of seed relationships
 * - onEntityKindsChange: Callback when entity kinds change
 * - onCulturesChange: Callback when cultures change
 * - onSeedEntitiesChange: Callback when seed entities change
 * - onSeedRelationshipsChange: Callback when seed relationships change
 *
 * It focuses on visual placement and entity/relationship editing
 * without the schema management overhead (handled by Canonry).
 */

import React, { useMemo, useCallback } from "react";
import PropTypes from "prop-types";
import SemanticPlaneEditor from "./components/SemanticPlane/index.jsx";
import CultureEditor from "./components/CultureEditor/index.jsx";
import EntityEditor from "./components/EntityEditor/index.jsx";
import RelationshipEditor from "./components/RelationshipEditor/index.jsx";
import AxisRegistryEditor from "./components/AxisRegistry/index.jsx";
import "./CosmographerRemote.css";

const TABS = [
  { id: "axes", label: "Axis Registry" },
  { id: "planes", label: "Semantic Planes" },
  { id: "cultures", label: "Culture Biases" },
  { id: "entities", label: "Entities" },
  { id: "relationships", label: "Relationships" },
];

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
}) {
  // Use passed-in section or default to 'axes'
  const activeTab = activeSection || "axes";
  const setActiveTab = onSectionChange || (() => {});

  // Build internal project representation
  const project = useMemo(
    () => ({
      entityKinds: schema?.entityKinds || [],
      relationshipKinds: schema?.relationshipKinds || [],
      cultures: schema?.cultures || [],
      axisDefinitions: axisDefinitions || [],
      seedEntities: seedEntities || [],
      seedRelationships: seedRelationships || [],
      tagRegistry: schema?.tagRegistry || [],
    }),
    [schema, axisDefinitions, seedEntities, seedRelationships]
  );

  // Handle save - route updates to appropriate callbacks
  const handleSave = useCallback(
    (updates) => {
      if (updates.entityKinds && onEntityKindsChange) {
        onEntityKindsChange(updates.entityKinds);
      }

      // Handle seed entity changes
      if (updates.seedEntities && onSeedEntitiesChange) {
        onSeedEntitiesChange(updates.seedEntities);
      }

      // Handle seed relationship changes
      if (updates.seedRelationships && onSeedRelationshipsChange) {
        onSeedRelationshipsChange(updates.seedRelationships);
      }

      if (updates.cultures && onCulturesChange) {
        onCulturesChange(updates.cultures);
      }
    },
    [onEntityKindsChange, onCulturesChange, onSeedEntitiesChange, onSeedRelationshipsChange]
  );

  const hasSchema = schema?.entityKinds?.length > 0 || schema?.cultures?.length > 0;

  if (!hasSchema) {
    return (
      <div className="cosmo-container">
        <div className="cosmo-no-schema">
          <div className="cosmo-no-schema-title">No Schema Defined</div>
          <div>
            Define entity kinds and cultures in the <strong>Enumerist</strong> tab first, then
            return here to place entities and manage relationships.
          </div>
        </div>
      </div>
    );
  }

  const renderContent = () => {
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
            onSave={handleSave}
            axisDefinitions={project.axisDefinitions}
          />
        );
      case "cultures":
        return <CultureEditor project={project} onSave={handleSave} />;
      case "entities":
        return (
          <EntityEditor
            project={project}
            onSave={handleSave}
            onAddTag={onAddTag}
            schemaUsage={schemaUsage}
          />
        );
      case "relationships":
        return <RelationshipEditor project={project} onSave={handleSave} />;
      default:
        return null;
    }
  };

  return (
    <div className="cosmo-container">
      {/* Left sidebar with nav */}
      <div className="cosmo-sidebar">
        <nav className="cosmo-nav">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`cosmo-nav-button ${activeTab === tab.id ? "cosmo-nav-button-active" : "cosmo-nav-button-inactive"}`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Main content area */}
      <div className="cosmo-main">
        <div className="cosmo-content">{renderContent()}</div>
      </div>
    </div>
  );
}

CosmographerRemote.propTypes = {
  schema: PropTypes.object,
  axisDefinitions: PropTypes.array,
  seedEntities: PropTypes.array,
  seedRelationships: PropTypes.array,
  onEntityKindsChange: PropTypes.func,
  onCulturesChange: PropTypes.func,
  onAxisDefinitionsChange: PropTypes.func,
  onTagRegistryChange: PropTypes.func,
  onSeedEntitiesChange: PropTypes.func,
  onSeedRelationshipsChange: PropTypes.func,
  onAddTag: PropTypes.func,
  activeSection: PropTypes.string,
  onSectionChange: PropTypes.func,
  schemaUsage: PropTypes.object,
};

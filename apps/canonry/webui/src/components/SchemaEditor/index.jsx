/**
 * SchemaEditor - The single place to edit world schema
 *
 * This is NATIVE to The Canonry (not a micro-frontend).
 * Edits entity kinds, relationship kinds, and culture identity.
 */

import React, { useCallback, useMemo } from "react";
import PropTypes from "prop-types";
import EntityKindEditor from "./EntityKindEditor";
import RelationshipKindEditor from "./RelationshipKindEditor";
import CultureEditor from "./CultureEditor";
import TagRegistryEditor from "./TagRegistryEditor";
import RelationshipKindMatrix from "./RelationshipKindMatrix";
import { getAccentGradient } from "../../theme";
import "./SchemaEditor.css";

const SECTIONS = [
  { id: "entityKinds", label: "Entity Kinds", countKey: "entityKinds" },
  { id: "relationshipKinds", label: "Relationships", countKey: "relationshipKinds" },
  { id: "relationshipMatrix", label: "Rel. Matrix", countKey: null },
  { id: "cultures", label: "Cultures", countKey: "cultures" },
  { id: "tags", label: "Tags", countKey: "tagRegistry" },
];

export default function SchemaEditor({
  project,
  activeSection,
  onSectionChange,
  onUpdateEntityKinds,
  onUpdateRelationshipKinds,
  onUpdateCultures,
  onUpdateTagRegistry,
  tagUsage = {},
  schemaUsage = {},
  namingData = {},
}) {
  // Use passed-in activeSection, fallback to entityKinds
  const currentSection = activeSection || "entityKinds";
  const handleNavigateToRelationship = useCallback(() => {
    onSectionChange("relationshipKinds");
  }, [onSectionChange]);
  const tagRegistryOrEmpty = useMemo(() => project.tagRegistry || [], [project.tagRegistry]);

  const counts = {
    entityKinds: project.entityKinds.length,
    relationshipKinds: project.relationshipKinds.length,
    cultures: project.cultures.length,
    tagRegistry: (project.tagRegistry || []).length,
  };

  const renderEditor = () => {
    switch (currentSection) {
      case "entityKinds":
        return (
          <EntityKindEditor
            entityKinds={project.entityKinds}
            onChange={onUpdateEntityKinds}
            schemaUsage={schemaUsage}
            namingData={namingData}
          />
        );

      case "relationshipKinds":
        return (
          <RelationshipKindEditor
            relationshipKinds={project.relationshipKinds}
            entityKinds={project.entityKinds}
            onChange={onUpdateRelationshipKinds}
            schemaUsage={schemaUsage}
          />
        );

      case "relationshipMatrix":
        return (
          <RelationshipKindMatrix
            relationshipKinds={project.relationshipKinds}
            entityKinds={project.entityKinds}
            onNavigateToRelationship={handleNavigateToRelationship}
          />
        );

      case "cultures":
        return <CultureEditor cultures={project.cultures} onChange={onUpdateCultures} />;

      case "tags":
        return (
          <TagRegistryEditor
            tagRegistry={tagRegistryOrEmpty}
            entityKinds={project.entityKinds}
            onChange={onUpdateTagRegistry}
            tagUsage={tagUsage}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="se-container">
      <div className="se-sidebar">
        <div className="se-sidebar-title">Schema</div>
        {SECTIONS.map((section) => (
          <div
            key={section.id}
            className={`se-sidebar-item ${section.id === currentSection ? "se-sidebar-item-active" : "se-sidebar-item-inactive"}`}
            style={section.id === currentSection ? { '--se-sidebar-active-bg': getAccentGradient("enumerist") } : undefined}
            onClick={() => onSectionChange(section.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }}
          >
            {section.label}
            {section.countKey && (
              <span className="se-sidebar-count">{counts[section.countKey]}</span>
            )}
          </div>
        ))}
      </div>
      <div className="se-main">{renderEditor()}</div>
    </div>
  );
}

SchemaEditor.propTypes = {
  project: PropTypes.object.isRequired,
  activeSection: PropTypes.string,
  onSectionChange: PropTypes.func.isRequired,
  onUpdateEntityKinds: PropTypes.func.isRequired,
  onUpdateRelationshipKinds: PropTypes.func.isRequired,
  onUpdateCultures: PropTypes.func.isRequired,
  onUpdateTagRegistry: PropTypes.func,
  tagUsage: PropTypes.object,
  schemaUsage: PropTypes.object,
  namingData: PropTypes.object,
};

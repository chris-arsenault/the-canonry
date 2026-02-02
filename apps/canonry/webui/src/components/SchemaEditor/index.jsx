/**
 * SchemaEditor - The single place to edit world schema
 *
 * This is NATIVE to The Canonry (not a micro-frontend).
 * Edits entity kinds, relationship kinds, and culture identity.
 */

import React from 'react';
import EntityKindEditor from './EntityKindEditor';
import RelationshipKindEditor from './RelationshipKindEditor';
import CultureEditor from './CultureEditor';
import TagRegistryEditor from './TagRegistryEditor';
import RelationshipKindMatrix from '../coverage/RelationshipKindMatrix';
import { colors, typography, spacing, radius, getAccentGradient, getHoverBg } from '../../theme';

const styles = {
  container: {
    display: 'flex',
    height: '100%',
  },
  sidebar: {
    width: '200px',
    backgroundColor: colors.bgSidebar,
    borderRight: `1px solid ${colors.border}`,
    padding: spacing.lg,
  },
  sidebarTitle: {
    fontSize: typography.sizeSm,
    fontWeight: typography.weightSemibold,
    fontFamily: typography.fontFamily,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: spacing.md,
  },
  sidebarItem: {
    padding: `${spacing.sm} ${spacing.md}`,
    fontSize: typography.sizeMd,
    fontFamily: typography.fontFamily,
    fontWeight: typography.weightMedium,
    borderRadius: radius.md,
    cursor: 'pointer',
    marginBottom: spacing.xs,
    transition: 'all 0.15s',
  },
  sidebarItemActive: {
    background: getAccentGradient('enumerist'),
    color: colors.bgSidebar,
    fontWeight: typography.weightSemibold,
  },
  sidebarItemInactive: {
    backgroundColor: 'transparent',
    color: colors.textSecondary,
  },
  sidebarCount: {
    float: 'right',
    fontSize: typography.sizeXs,
    opacity: 0.8,
  },
  main: {
    flex: 1,
    padding: spacing.xxl,
    overflow: 'auto',
    backgroundColor: colors.bgPrimary,
  },
};

const SECTIONS = [
  { id: 'entityKinds', label: 'Entity Kinds', countKey: 'entityKinds' },
  { id: 'relationshipKinds', label: 'Relationships', countKey: 'relationshipKinds' },
  { id: 'relationshipMatrix', label: 'Rel. Matrix', countKey: null },
  { id: 'cultures', label: 'Cultures', countKey: 'cultures' },
  { id: 'tags', label: 'Tags', countKey: 'tagRegistry' },
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
  const currentSection = activeSection || 'entityKinds';

  const counts = {
    entityKinds: project.entityKinds.length,
    relationshipKinds: project.relationshipKinds.length,
    cultures: project.cultures.length,
    tagRegistry: (project.tagRegistry || []).length,
  };

  const renderEditor = () => {
    switch (currentSection) {
      case 'entityKinds':
        return (
          <EntityKindEditor
            entityKinds={project.entityKinds}
            onChange={onUpdateEntityKinds}
            schemaUsage={schemaUsage}
            namingData={namingData}
          />
        );

      case 'relationshipKinds':
        return (
          <RelationshipKindEditor
            relationshipKinds={project.relationshipKinds}
            entityKinds={project.entityKinds}
            onChange={onUpdateRelationshipKinds}
            schemaUsage={schemaUsage}
          />
        );

      case 'relationshipMatrix':
        return (
          <RelationshipKindMatrix
            relationshipKinds={project.relationshipKinds}
            entityKinds={project.entityKinds}
            onNavigateToRelationship={(relKind) => {
              onSectionChange('relationshipKinds');
            }}
          />
        );

      case 'cultures':
        return (
          <CultureEditor
            cultures={project.cultures}
            onChange={onUpdateCultures}
          />
        );

      case 'tags':
        return (
          <TagRegistryEditor
            tagRegistry={project.tagRegistry || []}
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
    <div style={styles.container}>
      <div style={styles.sidebar}>
        <div style={styles.sidebarTitle}>Schema</div>
        {SECTIONS.map((section) => (
          <div
            key={section.id}
            style={{
              ...styles.sidebarItem,
              ...(section.id === currentSection
                ? styles.sidebarItemActive
                : styles.sidebarItemInactive),
            }}
            onClick={() => onSectionChange(section.id)}
          >
            {section.label}
            {section.countKey && (
              <span style={styles.sidebarCount}>{counts[section.countKey]}</span>
            )}
          </div>
        ))}
      </div>
      <div style={styles.main}>{renderEditor()}</div>
    </div>
  );
}

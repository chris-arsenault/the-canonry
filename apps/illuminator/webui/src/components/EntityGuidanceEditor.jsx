/**
 * EntityGuidanceEditor
 *
 * Editor for per-kind entity guidance using EntityGuidance directly:
 * - Focus: What to emphasize when describing this entity kind
 * - Relationship Guidance: How to use relationships in descriptions
 * - Prose Hint: How to portray this kind in chronicle prose
 *
 * For image/visual settings, shows:
 * - Image Instructions
 * - Avoid Elements
 * - Visual Thesis/Traits configuration (collapsible)
 */

import { useState, useMemo, useCallback } from 'react';
import { LocalTextArea } from '@penguin-tales/shared-components';
import {
  buildDescriptionPromptFromGuidance,
  buildImagePromptFromGuidance,
  createDefaultEntityGuidance,
  createDefaultCultureIdentities,
} from '../lib/promptBuilders';
import { buildEntityIndex, buildRelationshipIndex } from '../lib/worldData';
import {
  buildProminenceScale,
  DEFAULT_PROMINENCE_DISTRIBUTION,
  prominenceLabelFromScale,
  prominenceThresholdFromScale,
} from '@canonry/world-schema';

const TASK_TYPES = [
  { id: 'description', label: 'Description', icon: '📝' },
  { id: 'image', label: 'Image', icon: '🖼️' },
];

// Description sections (maps to KindGuidance fields)
const DESCRIPTION_SECTIONS = [
  {
    key: 'focus',
    label: 'Focus',
    description: 'What to emphasize when describing this entity kind. The world tone (style guidance) is automatically included.',
    rows: 6,
  },
  {
    key: 'relationshipUse',
    label: 'Relationship Guidance',
    description: 'How to use relationships when describing this kind (e.g., "ONE [strong] relationship as anchor")',
    rows: 2,
  },
  {
    key: 'proseHint',
    label: 'Chronicle Prose Hint',
    description: 'Brief guidance for portraying this kind in chronicle prose',
    rows: 2,
  },
];

// Image sections (maps to KindGuidance fields)
const IMAGE_SECTIONS = [
  { key: 'imageInstructions', label: 'Image Instructions', description: 'How to interpret this entity type for image generation', rows: 3 },
  { key: 'imageAvoid', label: 'Avoid', description: 'What NOT to include in generated images', rows: 2 },
];

// Visual generation step overrides (maps to KindGuidance.visualThesis/visualTraits)
const VISUAL_STEP_SECTIONS = [
  { key: 'visualThesis.domain', label: 'Visual Thesis Domain', description: 'Domain context for thesis generation (e.g., "You design characters for a fighting game roster...")', rows: 3 },
  { key: 'visualThesis.focus', label: 'Visual Thesis Focus', description: 'What to focus on for thesis (e.g., "Structural gear, profile extensions")', rows: 2 },
  { key: 'visualThesis.framing', label: 'Visual Thesis Framing', description: 'Context prepended to thesis prompt (e.g., "This is a CHARACTER - describe...")', rows: 2 },
  { key: 'visualTraits.domain', label: 'Visual Traits Domain', description: 'Domain context for traits generation', rows: 3 },
  { key: 'visualTraits.focus', label: 'Visual Traits Focus', description: 'What to focus on for traits', rows: 2 },
  { key: 'visualTraits.framing', label: 'Visual Traits Framing', description: 'Context prepended to traits prompt', rows: 2 },
];

function calculateEntityAge(entity, simulationMetadata) {
  const currentTick = simulationMetadata?.currentTick || 100;
  const age = currentTick - (entity?.createdAt || 0);
  const ageRatio = age / Math.max(currentTick, 1);

  if (ageRatio > 0.8) return 'ancient';
  if (ageRatio > 0.6) return 'established';
  if (ageRatio > 0.3) return 'mature';
  if (ageRatio > 0.1) return 'recent';
  return 'new';
}

function resolveRelationships(entity, entityById, relationshipsByEntity) {
  const relationships = [];
  const links = relationshipsByEntity.get(entity?.id) || [];
  if (links.length === 0) return relationships;

  for (const link of links) {
    const targetId = link.src === entity.id ? link.dst : link.src;
    const target = entityById.get(targetId);
    if (target) {
      relationships.push({
        kind: link.kind,
        targetName: target.name,
        targetKind: target.kind,
        targetSubtype: target.subtype,
        strength: link.strength,
        mutual: link.src !== entity.id,
      });
    }
  }

  return relationships;
}

function findCulturalPeers(entity, prominentByCulture) {
  if (!entity?.culture) return [];
  const peers = prominentByCulture.get(entity.culture) || [];
  return peers
    .filter((peer) => peer.id !== entity.id)
    .slice(0, 5)
    .map((peer) => peer.name);
}

function findFactionMembers(entity, entityById, relationshipsByEntity, renownedThreshold) {
  if (entity?.kind !== 'faction') return [];
  const members = [];
  const links = relationshipsByEntity.get(entity.id) || [];
  for (const link of links) {
    if (link.kind !== 'member_of' || link.dst !== entity.id) continue;
    const member = entityById.get(link.src);
    if (member && member.prominence >= renownedThreshold) {
      members.push(member.name);
    }
  }
  return members.slice(0, 5);
}

function buildEntityContext(
  entity,
  prominentByCulture,
  entityById,
  relationshipsByEntity,
  simulationMetadata,
  renownedThreshold
) {
  const relationships = resolveRelationships(entity, entityById, relationshipsByEntity);
  const culturalPeers = findCulturalPeers(entity, prominentByCulture);
  const factionMembers = findFactionMembers(entity, entityById, relationshipsByEntity, renownedThreshold);

  return {
    entity: {
      id: entity?.id || '',
      name: entity?.name || '[Entity Name]',
      kind: entity?.kind || '[kind]',
      subtype: entity?.subtype || '[subtype]',
      prominence: entity?.prominence ?? 2.0,
      culture: entity?.culture || '',
      status: entity?.status || 'active',
      summary: entity?.summary || '',
      description: entity?.description || '',
      tags: entity?.tags || {},
      visualThesis: entity?.enrichment?.text?.visualThesis || '',
      visualTraits: entity?.enrichment?.text?.visualTraits || [],
    },
    relationships,
    era: {
      name: simulationMetadata?.currentEra?.name || '',
      description: simulationMetadata?.currentEra?.description,
    },
    entityAge: calculateEntityAge(entity, simulationMetadata),
    culturalPeers: culturalPeers.length > 0 ? culturalPeers : undefined,
    factionMembers: factionMembers.length > 0 ? factionMembers : undefined,
  };
}

// Get nested value from object using dot notation
function getNestedValue(obj, path) {
  const parts = path.split('.');
  let value = obj;
  for (const part of parts) {
    if (value == null) return undefined;
    value = value[part];
  }
  return value;
}

// Set nested value in object using dot notation
function setNestedValue(obj, path, value) {
  const parts = path.split('.');
  const result = { ...obj };
  let current = result;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    current[part] = { ...current[part] };
    current = current[part];
  }

  current[parts[parts.length - 1]] = value;
  return result;
}

function TemplateSection({ section, value, onChange, disabled }) {
  return (
    <div className="illuminator-template-section">
      <div className="illuminator-template-section-header">
        <label className="illuminator-label">{section.label}</label>
        <span className="illuminator-template-section-hint">{section.description}</span>
      </div>
      <LocalTextArea
        className="illuminator-template-textarea"
        value={value || ''}
        onChange={(v) => onChange(section.key, v)}
        disabled={disabled}
        rows={section.rows || 3}
      />
    </div>
  );
}

function KindSelector({ kinds, selectedKind, onSelectKind }) {
  return (
    <div className="illuminator-kind-selector">
      {kinds.map((kind) => (
        <button
          key={kind.kind}
          onClick={() => onSelectKind(kind.kind)}
          className={`illuminator-kind-button ${selectedKind === kind.kind ? 'active' : ''}`}
        >
          {kind.description || kind.kind}
        </button>
      ))}
    </div>
  );
}

// Default guidance for a kind that doesn't exist yet
function getDefaultKindGuidance(kind) {
  return {
    focus: `Describe this ${kind} with vivid, specific details.`,
    relationshipUse: 'Reference relevant relationships to ground the description.',
    proseHint: `Show this ${kind} through specific details.`,
    visualThesis: {
      domain: `You design ${kind}s for a fantasy world.`,
      focus: 'Focus on distinctive visual elements.',
      framing: `This is a ${kind.toUpperCase()}.`,
    },
    visualTraits: {
      domain: `You're completing a ${kind} design brief.`,
      focus: 'Add supporting visual details.',
      framing: `This is a ${kind.toUpperCase()}.`,
    },
    imageInstructions: `Create concept art for this ${kind}.`,
    imageAvoid: 'Text, labels, watermarks.',
  };
}


export default function EntityGuidanceEditor({
  entityGuidance: externalEntityGuidance,
  onEntityGuidanceChange,
  worldContext,
  worldData,
  worldSchema,
  simulationMetadata,
  prominenceScale,
}) {
  const [selectedType, setSelectedType] = useState('description');
  const [selectedKind, setSelectedKind] = useState('npc');
  const [selectedEntityId, setSelectedEntityId] = useState('');
  const [showVisualSteps, setShowVisualSteps] = useState(false);

  // Use external entity guidance or default
  const entityGuidance = useMemo(
    () => externalEntityGuidance || createDefaultEntityGuidance(),
    [externalEntityGuidance]
  );

  // Empty culture identities for preview (editing happens in VisualIdentityPanel)
  const cultureIdentities = useMemo(() => createDefaultCultureIdentities(), []);

  // Get entity kinds from schema
  const entityKinds = useMemo(() => {
    return worldSchema?.entityKinds || [];
  }, [worldSchema]);

  // Auto-select first kind if none selected
  useMemo(() => {
    if (!selectedKind && entityKinds.length > 0) {
      setSelectedKind(entityKinds[0].kind);
    }
  }, [selectedKind, entityKinds]);

  const entities = useMemo(() => worldData?.hardState || [], [worldData]);
  const effectiveProminenceScale = useMemo(() => {
    if (prominenceScale) return prominenceScale;
    const values = entities
      .map((entity) => entity.prominence)
      .filter((value) => typeof value === 'number' && Number.isFinite(value));
    return buildProminenceScale(values, { distribution: DEFAULT_PROMINENCE_DISTRIBUTION });
  }, [prominenceScale, entities]);
  const notableThreshold = useMemo(
    () => prominenceThresholdFromScale('recognized', effectiveProminenceScale),
    [effectiveProminenceScale]
  );
  const renownedThreshold = useMemo(
    () => prominenceThresholdFromScale('renowned', effectiveProminenceScale),
    [effectiveProminenceScale]
  );
  const entityById = useMemo(() => buildEntityIndex(entities), [entities]);
  const relationshipsByEntity = useMemo(
    () => buildRelationshipIndex(worldData?.relationships || []),
    [worldData?.relationships]
  );
  const prominentByCulture = useMemo(() => {
    const map = new Map();
    for (const entity of entities) {
      if (!entity.culture) continue;
      if (entity.prominence < notableThreshold) continue;
      const entry = { id: entity.id, name: entity.name };
      const existing = map.get(entity.culture);
      if (existing) {
        existing.push(entry);
      } else {
        map.set(entity.culture, [entry]);
      }
    }
    return map;
  }, [entities, notableThreshold]);

  // Get example entities for preview, filtered by selected kind
  const exampleEntities = useMemo(() => {
    if (!entities || entities.length === 0) return [];
    return entities
      .filter((e) => e.kind === selectedKind)
      .slice(0, 10);
  }, [entities, selectedKind]);

  const selectedEntity = useMemo(() => {
    if (!selectedEntityId) return exampleEntities[0] || null;
    return entities.find((e) => e.id === selectedEntityId) || null;
  }, [selectedEntityId, entities, exampleEntities]);

  const selectedRelationships = useMemo(() => {
    if (!selectedEntity) return [];
    return resolveRelationships(selectedEntity, entityById, relationshipsByEntity);
  }, [selectedEntity, entityById, relationshipsByEntity]);

  // Get current guidance for selected kind
  const currentGuidance = useMemo(() => {
    return entityGuidance[selectedKind] || getDefaultKindGuidance(selectedKind);
  }, [entityGuidance, selectedKind]);

  // Build live preview
  const preview = useMemo(() => {
    // Derive flat values from structured fields for entity description prompts
    const wc = {
      name: worldContext?.name || '[World Name]',
      description: worldContext?.description || '[World description not set]',
      toneFragments: worldContext?.toneFragments || { core: '' },
      canonFactsWithMetadata: worldContext?.canonFactsWithMetadata || [],
    };

    const entityContext = buildEntityContext(
      selectedEntity,
      prominentByCulture,
      entityById,
      relationshipsByEntity,
      simulationMetadata,
      renownedThreshold
    );

    if (selectedType === 'description') {
      return buildDescriptionPromptFromGuidance(
        entityGuidance,
        cultureIdentities,
        wc,
        entityContext
      );
    } else {
      return buildImagePromptFromGuidance(
        entityGuidance,
        cultureIdentities,
        wc,
        entityContext,
        {} // No style info for preview
      );
    }
  }, [
    entityGuidance,
    cultureIdentities,
    selectedType,
    selectedKind,
    selectedEntity,
    worldContext,
    prominentByCulture,
    entityById,
    relationshipsByEntity,
    simulationMetadata,
    renownedThreshold,
  ]);

  // Handle guidance changes
  const handleSectionChange = useCallback(
    (sectionKey, value) => {
      if (!onEntityGuidanceChange) return;

      // Get current guidance or create default
      const currentKindGuidance = entityGuidance[selectedKind] || getDefaultKindGuidance(selectedKind);

      // Update the specific field (handles nested paths like 'visualThesis.domain')
      const updatedKindGuidance = setNestedValue(currentKindGuidance, sectionKey, value);

      // Update the full entity guidance
      const newEntityGuidance = {
        ...entityGuidance,
        [selectedKind]: updatedKindGuidance,
      };

      onEntityGuidanceChange(newEntityGuidance);
    },
    [entityGuidance, selectedKind, onEntityGuidanceChange]
  );

  // Reset when switching kinds - use entity of that kind for preview
  const handleKindSelect = useCallback((kind) => {
    setSelectedKind(kind);
    setSelectedEntityId(''); // Reset to first entity of new kind
  }, []);

  return (
    <div className="illuminator-template-editor">
      {/* Header Card */}
      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">Entity Guidance</h2>
          <span className="illuminator-card-subtitle">
            Configure per-kind instructions for entity descriptions and images
          </span>
        </div>

        {/* Task Type Tabs */}
        <div className="illuminator-prompt-tabs">
          {TASK_TYPES.map((type) => (
            <button
              key={type.id}
              onClick={() => setSelectedType(type.id)}
              className={`illuminator-prompt-tab ${selectedType === type.id ? 'active' : ''}`}
            >
              <span>{type.icon}</span>
              <span>{type.label}</span>
            </button>
          ))}
        </div>

        {/* Kind Selector */}
        {entityKinds.length > 0 && (
          <div className="illuminator-template-kind-section">
            <div className="illuminator-template-kind-header">
              <label className="illuminator-label">Entity Kind</label>
            </div>
            <KindSelector
              kinds={entityKinds}
              selectedKind={selectedKind}
              onSelectKind={handleKindSelect}
            />
          </div>
        )}
      </div>

      {/* Editor Card */}
      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">
            {selectedKind} {selectedType === 'description' ? 'Description' : 'Image'} Settings
          </h2>
        </div>

        {selectedType === 'description' ? (
          // Description editing - Focus + Relationship Guidance + Prose Hint
          <div className="illuminator-template-sections">
            {DESCRIPTION_SECTIONS.map((section) => (
              <TemplateSection
                key={section.key}
                section={section}
                value={getNestedValue(currentGuidance, section.key)}
                onChange={handleSectionChange}
              />
            ))}

            {/* Info about world tone */}
            <div className="illuminator-template-info-box">
              <strong>Note:</strong> The world's tone and style guidance from the Context tab is automatically included in all description prompts.
              The Focus field above should contain only entity-specific instructions.
            </div>
          </div>
        ) : (
          // Image editing
          <div className="illuminator-template-sections">
            {IMAGE_SECTIONS.map((section) => (
              <TemplateSection
                key={section.key}
                section={section}
                value={getNestedValue(currentGuidance, section.key)}
                onChange={handleSectionChange}
              />
            ))}

            {/* Visual Step Overrides */}
            <div className="illuminator-template-visual-steps">
              <button
                className="illuminator-template-visual-steps-toggle"
                onClick={() => setShowVisualSteps(!showVisualSteps)}
              >
                <span>{showVisualSteps ? '▼' : '▶'}</span>
                <span>Visual Generation Steps</span>
                <span className="illuminator-template-visual-steps-hint">
                  Configure thesis/traits prompts for this kind
                </span>
              </button>
              {showVisualSteps && (
                <div className="illuminator-template-visual-steps-content">
                  {VISUAL_STEP_SECTIONS.map((section) => (
                    <TemplateSection
                      key={section.key}
                      section={section}
                      value={getNestedValue(currentGuidance, section.key)}
                      onChange={handleSectionChange}
                    />
                  ))}
                  <div className="illuminator-template-visual-steps-info">
                    These prompts control the 3-step visual generation chain:
                    Description → Visual Thesis → Visual Traits.
                    The thesis provides the primary silhouette feature; traits add supporting details.
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Live Preview Card */}
      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">Live Preview</h2>
          {exampleEntities.length > 0 && (
            <select
              value={selectedEntityId}
              onChange={(e) => setSelectedEntityId(e.target.value)}
              className="illuminator-select"
              style={{ width: 'auto', minWidth: '200px' }}
            >
              <option value="">
                {exampleEntities[0]?.name || 'Example'} ({exampleEntities[0]?.subtype})
              </option>
              {exampleEntities.slice(1).map((entity) => (
                <option key={entity.id} value={entity.id}>
                  {entity.name} ({entity.subtype})
                </option>
              ))}
            </select>
          )}
        </div>

        <pre className="illuminator-prompt-preview illuminator-prompt-preview-large">
          {preview}
        </pre>

        {selectedEntity && (
          <>
            <div className="illuminator-preview-entity-info">
              <span className="illuminator-preview-entity-badge">{selectedEntity.kind}/{selectedEntity.subtype}</span>
              <span className="illuminator-preview-entity-badge">
                {prominenceLabelFromScale(selectedEntity.prominence, effectiveProminenceScale)}
              </span>
              <span className="illuminator-preview-entity-badge">{selectedEntity.culture || 'no culture'}</span>
              <span className="illuminator-preview-entity-badge">{calculateEntityAge(selectedEntity, simulationMetadata)}</span>
            </div>

            {selectedRelationships.length > 0 && (
              <div style={{
                marginTop: '12px',
                padding: '10px',
                background: 'var(--bg-tertiary)',
                borderRadius: '4px',
                fontSize: '11px',
              }}>
                <div style={{ fontWeight: 500, marginBottom: '6px', color: 'var(--text-muted)' }}>
                  Auto-detected relationships ({selectedRelationships.length}):
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {selectedRelationships.slice(0, 6).map((rel, i) => (
                    <span
                      key={i}
                      style={{
                        padding: '2px 6px',
                        background: 'var(--bg-secondary)',
                        borderRadius: '3px',
                      }}
                    >
                      {rel.kind}: {rel.targetName}
                    </span>
                  ))}
                  {selectedRelationships.length > 6 && (
                    <span style={{ opacity: 0.6 }}>+{selectedRelationships.length - 6} more</span>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

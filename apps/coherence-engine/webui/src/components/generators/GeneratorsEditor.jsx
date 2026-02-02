/**
 * GeneratorsEditor - Main component for editing generators
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { CategorySection, AddCard } from '../shared';
import { GeneratorModal } from './GeneratorModal';
import { GeneratorListCard } from './cards';
import { buildStorageKey, clearStoredValue, loadStoredValue, saveStoredValue } from '../../utils/persistence';

// Default icons for entity kinds (used when schema doesn't provide one)
const DEFAULT_KIND_ICONS = {
  npc: '👤',
  location: '📍',
  faction: '🏛️',
  ability: '✨',
  rule: '📜',
  era: '🕰️',
  occurrence: '⚡',
};

/**
 * @param {Object} props
 * @param {Array} props.generators - Array of generator configurations
 * @param {Function} props.onChange - Callback when generators change
 * @param {Object} props.schema - Domain schema
 * @param {Array} props.pressures - Available pressure definitions
 * @param {Array} props.eras - Available era definitions
 * @param {Object} props.usageMap - Schema usage map for validation
 */
export default function GeneratorsEditor({ projectId, generators = [], onChange, schema, pressures = [], eras = [], usageMap }) {
  const selectionKey = buildStorageKey(projectId, 'generators:selected');
  const [selectedId, setSelectedId] = useState(() => {
    const stored = loadStoredValue(selectionKey);
    return typeof stored === 'string' ? stored : null;
  });
  const [expandedCategories, setExpandedCategories] = useState({});

  // Derive selected generator from index - this ensures we always have the latest data
  const resolvedIndex = selectedId ? generators.findIndex((g) => g.id === selectedId) : -1;
  const selectedIndex = resolvedIndex >= 0 ? resolvedIndex : null;
  const selectedGenerator = selectedIndex !== null ? generators[selectedIndex] : null;

  // Build entity kind info map for icons and labels
  const entityKindInfo = useMemo(() => {
    const info = {};
    (schema?.entityKinds || []).forEach((ek) => {
      info[ek.kind] = {
        label: ek.description || ek.name || ek.kind,
        icon: ek.icon || DEFAULT_KIND_ICONS[ek.kind] || '📦',
      };
    });
    return info;
  }, [schema]);

  // Group generators by the primary entity kind they create
  const groupedGenerators = useMemo(() => {
    const groups = {};

    generators.forEach((generator) => {
      // Get primary creation kind (first entity created, or target kind if no creation)
      const createdKinds = (generator.creation || []).map(c => c.kind).filter(Boolean);
      const primaryKind = createdKinds[0] || generator.selection?.kind || 'uncategorized';

      if (!groups[primaryKind]) {
        groups[primaryKind] = [];
      }
      groups[primaryKind].push(generator);
    });

    return groups;
  }, [generators]);

  // Get ordered list of categories
  const categories = useMemo(() => {
    // Order by schema entity kinds first, then any uncategorized
    const schemaKinds = (schema?.entityKinds || []).map(ek => ek.kind);
    const usedKinds = Object.keys(groupedGenerators);

    // Sort: schema kinds in order, then others alphabetically
    return usedKinds.sort((a, b) => {
      const aIdx = schemaKinds.indexOf(a);
      const bIdx = schemaKinds.indexOf(b);
      if (aIdx >= 0 && bIdx >= 0) return aIdx - bIdx;
      if (aIdx >= 0) return -1;
      if (bIdx >= 0) return 1;
      return a.localeCompare(b);
    });
  }, [groupedGenerators, schema]);

  // Initialize expanded state for new categories
  useEffect(() => {
    setExpandedCategories(prev => {
      const updated = { ...prev };
      categories.forEach(cat => {
        if (updated[cat] === undefined) {
          updated[cat] = true; // Start expanded
        }
      });
      return updated;
    });
  }, [categories]);

  useEffect(() => {
    const stored = loadStoredValue(selectionKey);
    setSelectedId(typeof stored === 'string' ? stored : null);
  }, [selectionKey]);

  useEffect(() => {
    if (!selectionKey) return;
    if (selectedId) {
      saveStoredValue(selectionKey, selectedId);
    } else {
      clearStoredValue(selectionKey);
    }
  }, [selectionKey, selectedId]);

  useEffect(() => {
    if (selectedId && selectedIndex === null) {
      setSelectedId(null);
      clearStoredValue(selectionKey);
    }
  }, [selectedId, selectedIndex, selectionKey]);

  const handleGeneratorChange = useCallback((updated) => {
    if (selectedIndex !== null && selectedIndex < generators.length) {
      const newGenerators = [...generators];
      newGenerators[selectedIndex] = updated;
      onChange(newGenerators);
    }
  }, [generators, onChange, selectedIndex]);

  const handleToggle = useCallback((generator) => {
    const index = generators.findIndex((g) => g.id === generator.id);
    if (index >= 0) {
      const newGenerators = [...generators];
      newGenerators[index] = { ...generator, enabled: generator.enabled === false ? true : false };
      onChange(newGenerators);
    }
  }, [generators, onChange]);

  const handleDelete = useCallback(() => {
    if (selectedIndex !== null && selectedGenerator && confirm(`Delete generator "${selectedGenerator.name || selectedGenerator.id}"?`)) {
      const newGenerators = [...generators];
      newGenerators.splice(selectedIndex, 1);
      onChange(newGenerators);
      setSelectedId(null);
    }
  }, [generators, onChange, selectedIndex, selectedGenerator]);

  const handleAdd = useCallback(() => {
    const newGenerator = {
      id: `generator_${Date.now()}`,
      name: 'New Generator',
      applicability: [],
      selection: { strategy: 'by_kind', kind: 'location', pickStrategy: 'random' },
      creation: [],
      relationships: [],
      stateUpdates: [],
      variables: {},
    };
    onChange([...generators, newGenerator]);
    setSelectedId(newGenerator.id);
  }, [generators, onChange]);

  const handleDuplicate = useCallback(() => {
    if (!selectedGenerator) return;
    const duplicated = {
      ...JSON.parse(JSON.stringify(selectedGenerator)), // Deep clone
      id: `${selectedGenerator.id}_copy_${Date.now()}`,
      name: `${selectedGenerator.name || selectedGenerator.id} (Copy)`,
    };
    onChange([...generators, duplicated]);
    setSelectedId(duplicated.id);
  }, [generators, onChange, selectedGenerator]);

  const toggleCategoryExpand = useCallback((kind) => {
    setExpandedCategories(prev => ({
      ...prev,
      [kind]: !prev[kind],
    }));
  }, []);

  const toggleAllInCategory = useCallback((kind) => {
    const categoryItems = groupedGenerators[kind] || [];
    const allEnabled = categoryItems.every(g => g.enabled !== false);
    const newEnabled = !allEnabled;

    // Get IDs of generators in this category
    const categoryIds = new Set(categoryItems.map(g => g.id));

    const newGenerators = generators.map(g => {
      if (categoryIds.has(g.id)) {
        return { ...g, enabled: newEnabled };
      }
      return g;
    });
    onChange(newGenerators);
  }, [generators, groupedGenerators, onChange]);

  return (
    <div className="editor-container">
      <div className="header">
        <h1 className="title">Generators</h1>
        <p className="subtitle">Configure entity generators that populate your world. Click a generator to edit.</p>
      </div>

      {/* Category sections */}
      {categories.map((kind) => {
        const kindInfo = entityKindInfo[kind] || {
          label: kind.charAt(0).toUpperCase() + kind.slice(1),
          icon: DEFAULT_KIND_ICONS[kind] || '📦',
        };
        const categoryItems = groupedGenerators[kind] || [];
        const allEnabled = categoryItems.every(g => g.enabled !== false);

        return (
          <CategorySection
            key={kind}
            id={kind}
            icon={kindInfo.icon}
            label={`${kindInfo.label} Generators`}
            items={categoryItems}
            expanded={expandedCategories[kind] !== false}
            onToggleExpand={() => toggleCategoryExpand(kind)}
            allEnabled={allEnabled}
            onToggleAll={() => toggleAllInCategory(kind)}
            renderItem={(generator) => (
              <GeneratorListCard
                key={generator.id}
                generator={generator}
                onClick={() => setSelectedId(generator.id)}
                onToggle={() => handleToggle(generator)}
                usageMap={usageMap}
              />
            )}
          />
        );
      })}

      {/* Add Generator button */}
      <div className="mt-lg">
        <AddCard onClick={handleAdd} label="Add Generator" />
      </div>

      {selectedGenerator && (
          <GeneratorModal
            generator={selectedGenerator}
            onChange={handleGeneratorChange}
            onClose={() => setSelectedId(null)}
            onDelete={handleDelete}
            onDuplicate={handleDuplicate}
            schema={schema}
            pressures={pressures}
            eras={eras}
            usageMap={usageMap}
            tagRegistry={schema.tagRegistry || []}
          />
        )}
    </div>
  );
}

// Named export for flexibility
export { GeneratorsEditor };

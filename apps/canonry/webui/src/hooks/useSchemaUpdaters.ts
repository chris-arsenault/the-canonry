/**
 * useSchemaUpdaters - Schema update callbacks for the Canonry shell.
 *
 * Handles: entity kinds, relationship kinds, cultures, tags, axes,
 * seed entities, seed relationships, distribution targets, naming,
 * and property removal for validation quick-fix.
 */

import { useCallback } from "react";
import {
  FRAMEWORK_ENTITY_KIND_VALUES,
  FRAMEWORK_RELATIONSHIP_KIND_VALUES,
  FRAMEWORK_CULTURES,
  FRAMEWORK_CULTURE_DEFINITIONS,
  FRAMEWORK_TAG_VALUES,
} from "@canonry/world-schema";

interface UseSchemaUpdatersParams {
  currentProject: unknown;
  save: (data: Record<string, unknown>) => void | Promise<void>;
}

type ItemWithKey = Record<string, unknown>;

function parsePropertyPath(path: string): { itemId: string; pathSegments: string[] } | null {
  const nestedMatch = path.match(/^"([^"]+)"\/(.+)$/);
  if (nestedMatch) {
    return { itemId: nestedMatch[1], pathSegments: nestedMatch[2].split("/") };
  }
  const topLevelMatch = path.match(/^"([^"]+)"(?:\/)?$/);
  if (topLevelMatch) {
    return { itemId: topLevelMatch[1], pathSegments: [] };
  }
  return null;
}

function deleteNestedProperty(item: Record<string, unknown>, pathSegments: string[], propName: string): boolean {
  if (pathSegments.length === 0) {
    delete item[propName];
    return true;
  }
  let obj = item as Record<string, unknown>;
  for (let i = 0; i < pathSegments.length; i++) {
    const seg = pathSegments[i];
    if (obj[seg] === undefined) return false;
    if (i === pathSegments.length - 1) {
      delete (obj[seg] as Record<string, unknown>)[propName];
    } else {
      obj = obj[seg] as Record<string, unknown>;
    }
  }
  return true;
}

function mergeFrameworkOverrides(
  items: ItemWithKey[] | undefined,
  existingItems: ItemWithKey[] | undefined,
  frameworkKeys: Set<string>,
  keyField: string,
): ItemWithKey[] {
  const filtered = (items || []).filter((item) => !(item as Record<string, unknown>)?.isFramework);
  const existingOverrides = (existingItems || []).filter((item) =>
    frameworkKeys.has(item?.[keyField] as string),
  );
  const existingKeys = new Set(filtered.map((item) => item?.[keyField] as string));
  return [
    ...filtered,
    ...existingOverrides.filter((item) => !existingKeys.has(item?.[keyField] as string)),
  ];
}

export function useSchemaUpdaters({ currentProject, save }: UseSchemaUpdatersParams) {
  const p = currentProject as Record<string, unknown> | null;

  const updateEntityKinds = useCallback(
    (entityKinds: unknown[]) => {
      if (!p) return;
      const frameworkKeys = new Set(FRAMEWORK_ENTITY_KIND_VALUES);
      const merged = mergeFrameworkOverrides(
        entityKinds as ItemWithKey[],
        p.entityKinds as ItemWithKey[],
        frameworkKeys,
        "kind",
      );
      save({ entityKinds: merged });
    },
    [p, save],
  );

  const updateRelationshipKinds = useCallback(
    (relationshipKinds: unknown[]) => {
      if (!p) return;
      const frameworkKeys = new Set(FRAMEWORK_RELATIONSHIP_KIND_VALUES);
      const merged = mergeFrameworkOverrides(
        relationshipKinds as ItemWithKey[],
        p.relationshipKinds as ItemWithKey[],
        frameworkKeys,
        "kind",
      );
      save({ relationshipKinds: merged });
    },
    [p, save],
  );

  const updateCultures = useCallback(
    (cultures: unknown[]) => {
      if (!p) return;
      const frameworkKeys = new Set(Object.values(FRAMEWORK_CULTURES));
      const merged = mergeFrameworkOverrides(
        cultures as ItemWithKey[],
        p.cultures as ItemWithKey[],
        frameworkKeys,
        "id",
      );
      save({ cultures: merged });
    },
    [p, save],
  );

  const updateTagRegistry = useCallback(
    (tagRegistry: unknown[]) => {
      if (!p) return;
      const frameworkKeys = new Set(FRAMEWORK_TAG_VALUES);
      const merged = mergeFrameworkOverrides(
        tagRegistry as ItemWithKey[],
        p.tagRegistry as ItemWithKey[],
        frameworkKeys,
        "tag",
      );
      save({ tagRegistry: merged });
    },
    [p, save],
  );

  const updateSeedEntities = useCallback(
    (seedEntities: unknown) => save({ seedEntities }),
    [save],
  );
  const updateSeedRelationships = useCallback(
    (seedRelationships: unknown) => save({ seedRelationships }),
    [save],
  );
  const updateEras = useCallback((eras: unknown) => save({ eras }), [save]);
  const updatePressures = useCallback((pressures: unknown) => save({ pressures }), [save]);
  const updateGenerators = useCallback((generators: unknown) => save({ generators }), [save]);
  const updateSystems = useCallback((systems: unknown) => save({ systems }), [save]);
  const updateActions = useCallback((actions: unknown) => save({ actions }), [save]);
  const updateAxisDefinitions = useCallback(
    (axisDefinitions: unknown) => save({ axisDefinitions }),
    [save],
  );
  const updateDistributionTargets = useCallback(
    (distributionTargets: unknown) => save({ distributionTargets }),
    [save],
  );

  const addTag = useCallback(
    (newTag: unknown) => {
      if (!p) return;
      const existingRegistry = (p.tagRegistry as Array<{ tag: string }>) || [];
      if (existingRegistry.some((t) => t.tag === (newTag as { tag: string }).tag)) return;
      save({ tagRegistry: [...existingRegistry, newTag] });
    },
    [p, save],
  );

  const updateCultureNaming = useCallback(
    (cultureId: string, namingData: unknown) => {
      if (!p) return;
      const cultures = p.cultures as Array<{ id: string; name?: string; naming?: unknown }>;
      const existing = cultures.find((c) => c.id === cultureId);
      if (existing) {
        save({
          cultures: cultures.map((c) =>
            c.id === cultureId ? { ...c, naming: namingData } : c,
          ),
        });
        return;
      }
      const baseCulture = FRAMEWORK_CULTURE_DEFINITIONS.find(
        (c: { id: string }) => c.id === cultureId,
      );
      if (!baseCulture) return;
      save({
        cultures: [
          ...cultures,
          { id: baseCulture.id, name: baseCulture.name, naming: namingData },
        ],
      });
    },
    [p, save],
  );

  const handleRemoveProperty = useCallback(
    (path: string, propName: string) => {
      if (!p || !path || !propName) return;
      const parsed = parsePropertyPath(path);
      if (!parsed) return;
      const { itemId, pathSegments } = parsed;
      const configArrays = [
        { data: p.generators as ItemWithKey[], update: updateGenerators },
        { data: p.systems as ItemWithKey[], update: updateSystems },
        { data: p.pressures as ItemWithKey[], update: updatePressures },
        { data: p.eras as ItemWithKey[], update: updateEras },
        { data: p.actions as ItemWithKey[], update: updateActions },
      ];
      for (const { data, update } of configArrays) {
        if (!data) continue;
        const itemIndex = data.findIndex((item) => (item as { id: string }).id === itemId);
        if (itemIndex === -1) continue;
        const item = JSON.parse(JSON.stringify(data[itemIndex]));
        if (!deleteNestedProperty(item, pathSegments, propName)) return;
        const newData = [...data];
        newData[itemIndex] = item;
        update(newData);
        return;
      }
    },
    [p, updateGenerators, updateSystems, updatePressures, updateEras, updateActions],
  );

  return {
    updateEntityKinds,
    updateRelationshipKinds,
    updateCultures,
    updateTagRegistry,
    updateSeedEntities,
    updateSeedRelationships,
    updateEras,
    updatePressures,
    updateGenerators,
    updateSystems,
    updateActions,
    updateAxisDefinitions,
    updateDistributionTargets,
    addTag,
    updateCultureNaming,
    handleRemoveProperty,
  };
}

import type { WorldEntity, WorldOutput, WorldRelationship } from '@canonry/world-schema';
import { FRAMEWORK_ENTITY_KINDS } from '@canonry/world-schema';

export type RelationshipIndex = Map<string, WorldRelationship[]>;

export function buildEntityIndex(entities: WorldEntity[] = []): Map<string, WorldEntity> {
  return new Map(entities.map((entity) => [entity.id, entity]));
}

export function buildRelationshipIndex(
  relationships: WorldRelationship[] = []
): RelationshipIndex {
  const index: RelationshipIndex = new Map();

  for (const rel of relationships) {
    const add = (id: string) => {
      const existing = index.get(id);
      if (existing) {
        existing.push(rel);
      } else {
        index.set(id, [rel]);
      }
    };

    if (rel.src) add(rel.src);
    if (rel.dst && rel.dst !== rel.src) add(rel.dst);
  }

  return index;
}

export function resolveEraInfo(
  metadata?: WorldOutput['metadata'],
  entities: WorldEntity[] = []
): { name: string; description?: string } | null {
  const eraKey = metadata?.era;
  if (!eraKey) return null;

  const eraEntity = entities.find(
    (entity) =>
      entity.kind === FRAMEWORK_ENTITY_KINDS.ERA &&
      (entity.id === eraKey || entity.name === eraKey)
  );

  if (eraEntity) {
    return {
      name: eraEntity.name,
      description: eraEntity.description,
    };
  }

  return { name: eraKey };
}

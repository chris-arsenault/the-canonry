/**
 * Selection Filters
 *
 * Single source of truth for all filter evaluation logic.
 * Used by template interpreter, action interpreter, and systems.
 */

import { HardState } from '../../core/worldTypes';
import type {
  SelectionFilter, HasRelationshipFilter, LacksRelationshipFilter, SharesRelatedFilter, ComponentSizeFilter,
  ExcludeEntitiesFilter, HasTagSelectionFilter, HasTagsSelectionFilter, HasAnyTagSelectionFilter,
  LacksTagSelectionFilter, LacksAnyTagSelectionFilter,
  HasCultureFilter, NotHasCultureFilter,
  MatchesCultureFilter, NotMatchesCultureFilter,
  HasStatusFilter, HasProminenceFilter,
  GraphPathSelectionFilter,
} from './types';
import { hasTag, getTagValue } from '../../utils';
import { EntityResolver } from '../resolver';
import { evaluateGraphPath, GraphPathOptions } from '../graphPath';
import { prominenceThreshold } from '../types';

type RelLink = { kind: string; strength: number; src: string; dst: string };

/** Build an undirected adjacency map from matching relationship links. */
function buildRelationshipAdjacency(
  rels: RelLink[],
  relationshipKinds: string[],
  minStrength: number
): Map<string, Set<string>> {
  const adjacency = new Map<string, Set<string>>();
  for (const link of rels) {
    if (!relationshipKinds.includes(link.kind)) continue;
    if (link.strength < minStrength) continue;
    if (!adjacency.has(link.src)) adjacency.set(link.src, new Set());
    if (!adjacency.has(link.dst)) adjacency.set(link.dst, new Set());
    adjacency.get(link.src)!.add(link.dst);
    adjacency.get(link.dst)!.add(link.src);
  }
  return adjacency;
}

/** Count connected-component size via BFS from startId. */
function computeComponentSize(adjacency: Map<string, Set<string>>, startId: string): number {
  const visited = new Set<string>([startId]);
  const stack = [startId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    const neighbors = adjacency.get(current);
    if (neighbors) {
      for (const neighborId of neighbors) {
        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          stack.push(neighborId);
        }
      }
    }
  }
  return visited.size;
}

/** Check if a relationship link matches direction and optional withEntity constraints. */
function linkMatchesConstraints(
  link: RelLink,
  entityId: string,
  direction: string,
  withEntityId: string
): boolean {
  if (direction === 'src' && link.src !== entityId) return false;
  if (direction === 'dst' && link.dst !== entityId) return false;
  const otherId = link.src === entityId ? link.dst : link.src;
  return withEntityId ? otherId === withEntityId : true;
}

const DEFAULT_GRAPH_PATH_OPTIONS: GraphPathOptions = {
  filterEvaluator: (entities, filters, resolver, options) =>
    applySelectionFilters(entities, filters, resolver, options),
};

function resolveGraphPathOptions(graphPathOptions: GraphPathOptions): GraphPathOptions {
  return graphPathOptions;
}

/**
 * Apply a list of selection filters to entities.
 * Filters are applied in sequence (AND logic).
 */
export function applySelectionFilters(
  entities: HardState[],
  filters: SelectionFilter[] | undefined,
  resolver: EntityResolver,
  graphPathOptions: GraphPathOptions = DEFAULT_GRAPH_PATH_OPTIONS
): HardState[] {
  if (!filters || filters.length === 0) return entities;

  let result = entities;
  const options = resolveGraphPathOptions(graphPathOptions);

  for (const filter of filters) {
    result = applySelectionFilter(result, filter, resolver, options);
  }

  return result;
}

function filterByRelationship(
  entities: HardState[],
  filter: HasRelationshipFilter | LacksRelationshipFilter,
  resolver: EntityResolver,
  negate: boolean
): HardState[] {
  const graphView = resolver.getGraphView();
  const withEntityId = filter.with ? (resolver.resolveEntity(filter.with)?.id ?? '') : '';
  const direction = filter.type === 'has_relationship' ? filter.direction : 'both';
  return entities.filter(entity => {
    const relationships = graphView.getRelationships(entity.id, filter.kind, { includeHistorical: false });
    const hasMatch = relationships.some(link =>
      linkMatchesConstraints(link, entity.id, direction, withEntityId)
    );
    return negate ? !hasMatch : hasMatch;
  });
}

function filterBySharesRelated(
  entities: HardState[],
  filter: SharesRelatedFilter,
  resolver: EntityResolver
): HardState[] {
  const graphView = resolver.getGraphView();
  const refEntity = resolver.resolveEntity(filter.with);
  if (!refEntity) return entities;
  const refRelated = graphView
    .getConnectedEntities(refEntity.id, filter.relationshipKind, 'both', { includeHistorical: false })
    .map(entity => entity.id);
  if (refRelated.length === 0) return [];
  const refRelatedSet = new Set(refRelated);
  return entities.filter(entity => {
    const entityRelated = graphView
      .getConnectedEntities(entity.id, filter.relationshipKind, 'both', { includeHistorical: false })
      .map(related => related.id);
    return entityRelated.some(id => refRelatedSet.has(id));
  });
}

function filterByComponentSize(
  entities: HardState[],
  filter: ComponentSizeFilter,
  resolver: EntityResolver
): HardState[] {
  const graphView = resolver.getGraphView();
  const adjacency = buildRelationshipAdjacency(
    graphView.getAllRelationships({ includeHistorical: false }),
    filter.relationshipKinds,
    filter.minStrength
  );
  return entities.filter(entity => {
    const size = computeComponentSize(adjacency, entity.id);
    return (size >= filter.min)
      && (size <= filter.max);
  });
}

/**
 * Apply a single selection filter to a list of entities.
 */
function filterByExclude(entities: HardState[], filter: ExcludeEntitiesFilter, resolver: EntityResolver): HardState[] {
  const ids = new Set(filter.entities.map(ref => resolver.resolveEntity(ref)?.id).filter((id): id is string => id !== undefined));
  return entities.filter(e => !ids.has(e.id));
}

function filterByTag(entities: HardState[], filter: HasTagSelectionFilter): HardState[] {
  return entities.filter(e => hasTag(e.tags, filter.tag) && getTagValue(e.tags, filter.tag, filter.value) === filter.value);
}

function filterByLacksTag(entities: HardState[], filter: LacksTagSelectionFilter): HardState[] {
  return entities.filter(e => !hasTag(e.tags, filter.tag) || getTagValue(e.tags, filter.tag, filter.value) !== filter.value);
}

function filterByCultureMatch(entities: HardState[], filter: MatchesCultureFilter | NotMatchesCultureFilter, resolver: EntityResolver, negate: boolean): HardState[] {
  const ref = resolver.resolveEntity(filter.with);
  if (!ref) return entities;
  return negate ? entities.filter(e => e.culture !== ref.culture) : entities.filter(e => e.culture === ref.culture);
}

type FilterHandler = (
  entities: HardState[],
  filter: SelectionFilter,
  resolver: EntityResolver,
  graphPathOptions: GraphPathOptions
) => HardState[];

const FILTER_DISPATCH: Record<SelectionFilter['type'], FilterHandler> = {
  exclude: (entities, filter, resolver) =>
    filterByExclude(entities, filter as ExcludeEntitiesFilter, resolver),
  has_relationship: (entities, filter, resolver) =>
    filterByRelationship(entities, filter as HasRelationshipFilter, resolver, false),
  lacks_relationship: (entities, filter, resolver) =>
    filterByRelationship(entities, filter as LacksRelationshipFilter, resolver, true),
  has_tag: (entities, filter) =>
    filterByTag(entities, filter as HasTagSelectionFilter),
  has_tags: (entities, filter) => {
    const f = filter as HasTagsSelectionFilter;
    return f.tags.length === 0 ? entities : entities.filter(e => f.tags.every(t => hasTag(e.tags, t)));
  },
  has_any_tag: (entities, filter) => {
    const f = filter as HasAnyTagSelectionFilter;
    return f.tags.length === 0 ? entities : entities.filter(e => f.tags.some(t => hasTag(e.tags, t)));
  },
  lacks_tag: (entities, filter) =>
    filterByLacksTag(entities, filter as LacksTagSelectionFilter),
  lacks_any_tag: (entities, filter) => {
    const f = filter as LacksAnyTagSelectionFilter;
    return f.tags.length === 0 ? entities : entities.filter(e => !f.tags.some(t => hasTag(e.tags, t)));
  },
  has_culture: (entities, filter) =>
    entities.filter(e => e.culture === (filter as HasCultureFilter).culture),
  not_has_culture: (entities, filter) =>
    entities.filter(e => e.culture !== (filter as NotHasCultureFilter).culture),
  matches_culture: (entities, filter, resolver) =>
    filterByCultureMatch(entities, filter as MatchesCultureFilter, resolver, false),
  not_matches_culture: (entities, filter, resolver) =>
    filterByCultureMatch(entities, filter as NotMatchesCultureFilter, resolver, true),
  has_status: (entities, filter) =>
    entities.filter(e => e.status === (filter as HasStatusFilter).status),
  has_prominence: (entities, filter) =>
    entities.filter(e => e.prominence >= prominenceThreshold((filter as HasProminenceFilter).minProminence)),
  shares_related: (entities, filter, resolver) =>
    filterBySharesRelated(entities, filter as SharesRelatedFilter, resolver),
  graph_path: (entities, filter, resolver, graphPathOptions) =>
    entities.filter(e => evaluateGraphPath(e, (filter as GraphPathSelectionFilter).assert, resolver, resolveGraphPathOptions(graphPathOptions))),
  component_size: (entities, filter, resolver) =>
    filterByComponentSize(entities, filter as ComponentSizeFilter, resolver),
};

export function applySelectionFilter(
  entities: HardState[],
  filter: SelectionFilter,
  resolver: EntityResolver,
  graphPathOptions: GraphPathOptions = DEFAULT_GRAPH_PATH_OPTIONS
): HardState[] {
  return FILTER_DISPATCH[filter.type](entities, filter, resolver, graphPathOptions);
}

/**
 * Check if an entity passes a single filter.
 * Useful for checking individual entities without creating a list.
 */
export function entityPassesFilter(
  entity: HardState,
  filter: SelectionFilter,
  resolver: EntityResolver,
  graphPathOptions: GraphPathOptions = DEFAULT_GRAPH_PATH_OPTIONS
): boolean {
  const result = applySelectionFilter([entity], filter, resolver, graphPathOptions);
  return result.length > 0;
}

/**
 * Check if an entity passes all filters.
 */
export function entityPassesAllFilters(
  entity: HardState,
  filters: SelectionFilter[] | undefined,
  resolver: EntityResolver,
  graphPathOptions: GraphPathOptions = DEFAULT_GRAPH_PATH_OPTIONS
): boolean {
  if (!filters || filters.length === 0) return true;

  for (const filter of filters) {
    if (!entityPassesFilter(entity, filter, resolver, graphPathOptions)) {
      return false;
    }
  }
  return true;
}

// Re-export types
export * from './types';

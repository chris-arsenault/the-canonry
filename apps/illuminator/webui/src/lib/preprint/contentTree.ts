/**
 * Content Tree Operations
 *
 * Pure functions for manipulating the content ordering tree.
 * All operations return a new ContentTreeState (immutable updates).
 */

import type { ContentTreeNode, ContentTreeState, ContentNodeType } from "./prePrintTypes";

let nextId = 1;
function generateId(): string {
  return `node_${Date.now()}_${nextId++}`;
}

// =============================================================================
// Scaffold
// =============================================================================

export function createScaffold(projectId: string, simulationRunId: string): ContentTreeState {
  return {
    projectId,
    simulationRunId,
    nodes: [
      {
        id: generateId(),
        name: "Front Matter",
        type: "folder",
        children: [
          { id: generateId(), name: "Title Page", type: "folder", children: [] },
          { id: generateId(), name: "Copyright", type: "folder", children: [] },
          { id: generateId(), name: "Table of Contents", type: "folder", children: [] },
        ],
      },
      {
        id: generateId(),
        name: "Body",
        type: "folder",
        children: [],
      },
      {
        id: generateId(),
        name: "Back Matter",
        type: "folder",
        children: [
          { id: generateId(), name: "Appendix", type: "folder", children: [] },
          { id: generateId(), name: "Glossary", type: "folder", children: [] },
          { id: generateId(), name: "Index", type: "folder", children: [] },
          { id: generateId(), name: "Colophon", type: "folder", children: [] },
        ],
      },
    ],
    updatedAt: Date.now(),
  };
}

// =============================================================================
// Tree Traversal Helpers
// =============================================================================

function findInNodes(nodes: ContentTreeNode[], nodeId: string): ContentTreeNode | null {
  for (const node of nodes) {
    if (node.id === nodeId) return node;
    if (node.children) {
      const found = findInNodes(node.children, nodeId);
      if (found) return found;
    }
  }
  return null;
}

export function findNode(state: ContentTreeState, nodeId: string): ContentTreeNode | null {
  return findInNodes(state.nodes, nodeId);
}

function mapNodes(
  nodes: ContentTreeNode[],
  fn: (node: ContentTreeNode) => ContentTreeNode | null
): ContentTreeNode[] {
  const result: ContentTreeNode[] = [];
  for (const node of nodes) {
    const mapped = fn(node);
    if (mapped === null) continue; // deleted
    if (mapped.children) {
      mapped.children = mapNodes(mapped.children, fn);
    }
    result.push(mapped);
  }
  return result;
}

function removeNode(nodes: ContentTreeNode[], nodeId: string): ContentTreeNode[] {
  return mapNodes(nodes, (node) => (node.id === nodeId ? null : { ...node }));
}

function insertIntoParent(
  nodes: ContentTreeNode[],
  parentId: string,
  item: ContentTreeNode,
  index: number
): ContentTreeNode[] {
  return nodes.map((node) => {
    if (node.id === parentId && node.children !== undefined) {
      const children = [...node.children];
      children.splice(index, 0, item);
      return { ...node, children };
    }
    if (node.children) {
      return { ...node, children: insertIntoParent(node.children, parentId, item, index) };
    }
    return node;
  });
}

// =============================================================================
// Mutations
// =============================================================================

export function addFolder(
  state: ContentTreeState,
  parentId: string,
  name: string
): ContentTreeState {
  const newFolder: ContentTreeNode = {
    id: generateId(),
    name,
    type: "folder",
    children: [],
  };

  return {
    ...state,
    nodes: insertIntoParent(state.nodes, parentId, newFolder, Infinity),
    updatedAt: Date.now(),
  };
}

export function renameNode(
  state: ContentTreeState,
  nodeId: string,
  name: string
): ContentTreeState {
  return {
    ...state,
    nodes: mapNodes(state.nodes, (node) => (node.id === nodeId ? { ...node, name } : { ...node })),
    updatedAt: Date.now(),
  };
}

export function deleteNode(state: ContentTreeState, nodeId: string): ContentTreeState {
  return {
    ...state,
    nodes: removeNode(state.nodes, nodeId),
    updatedAt: Date.now(),
  };
}

export function moveNode(
  state: ContentTreeState,
  nodeId: string,
  targetParentId: string,
  index: number
): ContentTreeState {
  const node = findInNodes(state.nodes, nodeId);
  if (!node) return state;

  const withRemoved = removeNode(state.nodes, nodeId);
  const withInserted = insertIntoParent(withRemoved, targetParentId, { ...node }, index);

  return {
    ...state,
    nodes: withInserted,
    updatedAt: Date.now(),
  };
}

export function addContentItem(
  state: ContentTreeState,
  parentId: string,
  item: { type: ContentNodeType; contentId: string; name: string }
): ContentTreeState {
  const newNode: ContentTreeNode = {
    id: generateId(),
    name: item.name,
    type: item.type,
    contentId: item.contentId,
  };

  return {
    ...state,
    nodes: insertIntoParent(state.nodes, parentId, newNode, Infinity),
    updatedAt: Date.now(),
  };
}

// =============================================================================
// Export Helper
// =============================================================================

export interface FlattenedNode {
  path: string;
  node: ContentTreeNode;
  depth: number;
  index: number;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function flattenForExport(state: ContentTreeState): FlattenedNode[] {
  const result: FlattenedNode[] = [];

  function walk(nodes: ContentTreeNode[], parentPath: string, depth: number) {
    nodes.forEach((node, index) => {
      const prefix = String(index + 1).padStart(2, "0");
      const segment = `${prefix}-${slugify(node.name)}`;
      const path = parentPath ? `${parentPath}/${segment}` : segment;
      result.push({ path, node, depth, index });
      if (node.children) {
        walk(node.children, path, depth + 1);
      }
    });
  }

  walk(state.nodes, "", 0);
  return result;
}

// =============================================================================
// Content ID Lookup
// =============================================================================

export function getAllContentIds(state: ContentTreeState): Set<string> {
  const ids = new Set<string>();
  function walk(nodes: ContentTreeNode[]) {
    for (const node of nodes) {
      if (node.contentId) ids.add(node.contentId);
      if (node.children) walk(node.children);
    }
  }
  walk(state.nodes);
  return ids;
}

/**
 * Convert tree data to react-arborist format.
 * react-arborist expects { id, name, children } with children as arrays.
 */
export function toArboristData(nodes: ContentTreeNode[]): ContentTreeNode[] {
  return nodes.map((node) => ({
    ...node,
    children: node.type === "folder" ? toArboristData(node.children || []) : undefined,
  }));
}

/**
 * Rebuild ContentTreeNode[] from react-arborist's output after a move/reorder.
 */
export function fromArboristData(data: ContentTreeNode[]): ContentTreeNode[] {
  return data.map((node) => ({
    ...node,
    children: node.children ? fromArboristData(node.children) : undefined,
  }));
}

// =============================================================================
// Auto-Populate
// =============================================================================

export interface AutoPopulateInput {
  chronicles: Array<{
    chronicleId: string;
    title: string;
    status: string;
    focalEraId?: string;
    focalEraName?: string;
    eraYear?: number;
  }>;
  eraNarratives: Array<{
    narrativeId: string;
    eraId: string;
    eraName: string;
    status: string;
  }>;
  entities: Array<{
    id: string;
    name: string;
    kind: string;
    subtype?: string;
    culture?: string;
    description?: string;
  }>;
  staticPages: Array<{
    pageId: string;
    title: string;
    status: string;
  }>;
  eraOrder: Map<string, number>;
}

/**
 * Parse namespace prefix from a static page title.
 * e.g. "Cultures:Aurora Stack" → { namespace: "Cultures", baseName: "Aurora Stack" }
 */
function parseNamespace(title: string): { namespace?: string; baseName: string } {
  const colonIndex = title.indexOf(":");
  if (colonIndex > 0 && colonIndex < title.length - 1) {
    return {
      namespace: title.slice(0, colonIndex),
      baseName: title.slice(colonIndex + 1),
    };
  }
  return { baseName: title };
}

/**
 * Auto-populate the tree with content in Chronicler's natural book order.
 *
 * Body: eras in chronological order, each containing its narrative + chronicles.
 * Back Matter → Encyclopedia: entities grouped by culture then kind,
 *   each culture preceded by its static page.
 * Back Matter: remaining non-culture static pages.
 */
/** Group entities by kind and build folder nodes. */
function buildKindFolders(
  entities: Array<{ id: string; name: string; kind: string; description?: string }>
): ContentTreeNode[] {
  const byKind = new Map<string, typeof entities>();
  for (const e of entities) {
    const list = byKind.get(e.kind) || [];
    list.push(e);
    byKind.set(e.kind, list);
  }

  return [...byKind.keys()].sort((a, b) => a.localeCompare(b)).map((kind) => ({
    id: generateId(),
    name: kind.charAt(0).toUpperCase() + kind.slice(1) + "s",
    type: "folder" as const,
    children: byKind.get(kind).sort((a, b) => a.name.localeCompare(b.name)).map((e) => ({
      id: generateId(),
      name: e.name,
      type: "entity" as const,
      contentId: e.id,
    })),
  }));
}

/** Build body children: era folders with narratives + chronicles. */
function buildBodyChildren(
  input: AutoPopulateInput,
  existingIds: Set<string>
): ContentTreeNode[] {
  const publishedChronicles = input.chronicles.filter(
    (c) => (c.status === "complete" || c.status === "assembly_ready") && !existingIds.has(c.chronicleId)
  );
  const completedNarratives = input.eraNarratives.filter(
    (n) => (n.status === "complete" || n.status === "step_complete") && !existingIds.has(n.narrativeId)
  );

  const allEraIds = new Set<string>();
  for (const c of publishedChronicles) { if (c.focalEraId) allEraIds.add(c.focalEraId); }
  for (const n of completedNarratives) { allEraIds.add(n.eraId); }

  const sortedEraIds = [...allEraIds].sort((a, b) =>
    (input.eraOrder.get(a) ?? Infinity) - (input.eraOrder.get(b) ?? Infinity)
  );

  const bodyChildren: ContentTreeNode[] = [];
  for (const eraId of sortedEraIds) {
    const eraName =
      completedNarratives.find((n) => n.eraId === eraId)?.eraName ||
      publishedChronicles.find((c) => c.focalEraId === eraId)?.focalEraName ||
      eraId;

    const eraFolder: ContentTreeNode = { id: generateId(), name: eraName, type: "folder", children: [] };

    const narrative = completedNarratives
      .filter((n) => n.eraId === eraId)
      .sort((a, b) => b.updatedAt - a.updatedAt)[0];
    if (narrative) {
      eraFolder.children.push({ id: generateId(), name: `${eraName} — Era Narrative`, type: "era_narrative", contentId: narrative.narrativeId });
    }

    const eraChronicles = publishedChronicles
      .filter((c) => c.focalEraId === eraId)
      .sort((a, b) => (a.eraYear ?? Infinity) !== (b.eraYear ?? Infinity) ? (a.eraYear ?? Infinity) - (b.eraYear ?? Infinity) : a.title.localeCompare(b.title));
    for (const c of eraChronicles) {
      eraFolder.children.push({ id: generateId(), name: c.title || "Untitled Chronicle", type: "chronicle", contentId: c.chronicleId });
    }
    if (eraFolder.children.length > 0) bodyChildren.push(eraFolder);
  }

  const unassigned = publishedChronicles.filter((c) => !c.focalEraId).sort((a, b) => a.title.localeCompare(b.title));
  if (unassigned.length > 0) {
    bodyChildren.push({
      id: generateId(), name: "Unassigned Era", type: "folder",
      children: unassigned.map((c) => ({ id: generateId(), name: c.title || "Untitled Chronicle", type: "chronicle" as const, contentId: c.chronicleId })),
    });
  }

  return bodyChildren;
}

type StaticPage = { pageId: string; title: string; status: string };

/** Partition published static pages into culture pages (keyed by lowercased culture name) and other pages. */
function categorizeStaticPages(
  pages: StaticPage[],
  existingIds: Set<string>
): { culturePageMap: Map<string, StaticPage>; nonCulturePages: StaticPage[] } {
  const published = pages.filter((p) => p.status === "published" && !existingIds.has(p.pageId));
  const culturePageMap = new Map<string, StaticPage>();
  const nonCulturePages: StaticPage[] = [];
  for (const p of published) {
    const { namespace, baseName } = parseNamespace(p.title);
    if (namespace === "Cultures") { culturePageMap.set(baseName.toLowerCase(), p); }
    else { nonCulturePages.push(p); }
  }
  return { culturePageMap, nonCulturePages };
}

/** Build encyclopedia children: entities grouped by culture then kind. */
function buildEncyclopediaChildren(
  input: AutoPopulateInput,
  existingIds: Set<string>
): { encyclopediaChildren: ContentTreeNode[]; usedPageIds: Set<string>; nonCulturePages: Array<{ pageId: string; title: string; status: string }> } {
  const eligibleEntities = input.entities.filter((e) => e.description && e.kind !== "era" && !existingIds.has(e.id));

  const byCulture = new Map<string, typeof eligibleEntities>();
  const uncultured: typeof eligibleEntities = [];
  for (const e of eligibleEntities) {
    if (e.culture) {
      const list = byCulture.get(e.culture) || [];
      list.push(e);
      byCulture.set(e.culture, list);
    } else {
      uncultured.push(e);
    }
  }

  const { culturePageMap, nonCulturePages } = categorizeStaticPages(input.staticPages, existingIds);

  const encyclopediaChildren: ContentTreeNode[] = [];
  const usedPageIds = new Set<string>();

  for (const cultureName of [...byCulture.keys()].sort((a, b) => a.localeCompare(b))) {
    const cultureFolder: ContentTreeNode = { id: generateId(), name: cultureName, type: "folder", children: [] };

    const culturePage = culturePageMap.get(cultureName.toLowerCase());
    if (culturePage) {
      cultureFolder.children.push({ id: generateId(), name: culturePage.title, type: "static_page", contentId: culturePage.pageId });
      usedPageIds.add(culturePage.pageId);
    }

    cultureFolder.children.push(...buildKindFolders(byCulture.get(cultureName)));
    if (cultureFolder.children.length > 0) encyclopediaChildren.push(cultureFolder);
  }

  if (uncultured.length > 0) {
    const kindFolders = buildKindFolders(uncultured);
    if (kindFolders.length > 0) {
      encyclopediaChildren.push({ id: generateId(), name: "Uncategorized", type: "folder", children: kindFolders });
    }
  }

  return { encyclopediaChildren, usedPageIds, nonCulturePages };
}

export function autoPopulateBody(
  state: ContentTreeState,
  input: AutoPopulateInput
): ContentTreeState {
  const bodyIndex = state.nodes.findIndex((n) => n.name === "Body" && n.type === "folder");
  if (bodyIndex < 0) return state;

  const backMatterIndex = state.nodes.findIndex((n) => n.name === "Back Matter" && n.type === "folder");
  const existingIds = getAllContentIds(state);

  const bodyChildren = buildBodyChildren(input, existingIds);
  const { encyclopediaChildren, usedPageIds, nonCulturePages } = buildEncyclopediaChildren(input, existingIds);

  const newNodes = [...state.nodes];
  newNodes[bodyIndex] = { ...newNodes[bodyIndex], children: bodyChildren };

  if (backMatterIndex >= 0) {
    const existingBackMatterChildren = [...(newNodes[backMatterIndex].children || [])];

    if (encyclopediaChildren.length > 0) {
      existingBackMatterChildren.unshift({ id: generateId(), name: "Encyclopedia", type: "folder", children: encyclopediaChildren });
    }

    for (const p of nonCulturePages.filter((p) => !usedPageIds.has(p.pageId))) {
      existingBackMatterChildren.push({ id: generateId(), name: p.title, type: "static_page", contentId: p.pageId });
    }

    newNodes[backMatterIndex] = { ...newNodes[backMatterIndex], children: existingBackMatterChildren };
  }

  return { ...state, nodes: newNodes, updatedAt: Date.now() };
}

/**
 * Content Tree Operations
 *
 * Pure functions for manipulating the content ordering tree.
 * All operations return a new ContentTreeState (immutable updates).
 */

import type { ContentTreeNode, ContentTreeState, ContentNodeType } from './prePrintTypes';

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
        name: 'Front Matter',
        type: 'folder',
        children: [
          { id: generateId(), name: 'Title Page', type: 'folder', children: [] },
          { id: generateId(), name: 'Copyright', type: 'folder', children: [] },
          { id: generateId(), name: 'Table of Contents', type: 'folder', children: [] },
        ],
      },
      {
        id: generateId(),
        name: 'Body',
        type: 'folder',
        children: [],
      },
      {
        id: generateId(),
        name: 'Back Matter',
        type: 'folder',
        children: [
          { id: generateId(), name: 'Appendix', type: 'folder', children: [] },
          { id: generateId(), name: 'Glossary', type: 'folder', children: [] },
          { id: generateId(), name: 'Index', type: 'folder', children: [] },
          { id: generateId(), name: 'Colophon', type: 'folder', children: [] },
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
    type: 'folder',
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
    nodes: mapNodes(state.nodes, (node) =>
      node.id === nodeId ? { ...node, name } : { ...node }
    ),
    updatedAt: Date.now(),
  };
}

export function deleteNode(
  state: ContentTreeState,
  nodeId: string
): ContentTreeState {
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
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function flattenForExport(state: ContentTreeState): FlattenedNode[] {
  const result: FlattenedNode[] = [];

  function walk(nodes: ContentTreeNode[], parentPath: string, depth: number) {
    nodes.forEach((node, index) => {
      const prefix = String(index + 1).padStart(2, '0');
      const segment = `${prefix}-${slugify(node.name)}`;
      const path = parentPath ? `${parentPath}/${segment}` : segment;
      result.push({ path, node, depth, index });
      if (node.children) {
        walk(node.children, path, depth + 1);
      }
    });
  }

  walk(state.nodes, '', 0);
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
    children: node.type === 'folder' ? toArboristData(node.children || []) : undefined,
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
  const colonIndex = title.indexOf(':');
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
export function autoPopulateBody(
  state: ContentTreeState,
  input: AutoPopulateInput
): ContentTreeState {
  const bodyIndex = state.nodes.findIndex((n) => n.name === 'Body' && n.type === 'folder');
  if (bodyIndex < 0) return state;

  const backMatterIndex = state.nodes.findIndex((n) => n.name === 'Back Matter' && n.type === 'folder');

  // Collect existing content IDs to avoid duplicates
  const existingIds = getAllContentIds(state);

  // =========================================================================
  // Body: Era folders with narratives + chronicles
  // =========================================================================

  const publishedChronicles = input.chronicles.filter(
    (c) => (c.status === 'complete' || c.status === 'assembly_ready') && !existingIds.has(c.chronicleId)
  );

  const completedNarratives = input.eraNarratives.filter(
    (n) => (n.status === 'complete' || n.status === 'step_complete') && !existingIds.has(n.narrativeId)
  );

  // Collect all era IDs from chronicles and narratives
  const allEraIds = new Set<string>();
  for (const c of publishedChronicles) {
    if (c.focalEraId) allEraIds.add(c.focalEraId);
  }
  for (const n of completedNarratives) {
    allEraIds.add(n.eraId);
  }

  const sortedEraIds = [...allEraIds].sort((a, b) => {
    const orderA = input.eraOrder.get(a) ?? Infinity;
    const orderB = input.eraOrder.get(b) ?? Infinity;
    return orderA - orderB;
  });

  const bodyChildren: ContentTreeNode[] = [];

  for (const eraId of sortedEraIds) {
    const eraName =
      completedNarratives.find((n) => n.eraId === eraId)?.eraName
      || publishedChronicles.find((c) => c.focalEraId === eraId)?.focalEraName
      || eraId;

    const eraFolder: ContentTreeNode = {
      id: generateId(),
      name: eraName,
      type: 'folder',
      children: [],
    };

    // Era narrative at top of folder (pick most recent if multiple)
    const narrative = completedNarratives
      .filter((n) => n.eraId === eraId)
      .sort((a, b) => (b as any).updatedAt - (a as any).updatedAt)[0];
    if (narrative) {
      eraFolder.children!.push({
        id: generateId(),
        name: `${eraName} — Era Narrative`,
        type: 'era_narrative',
        contentId: narrative.narrativeId,
      });
    }

    // Chronicles sorted by eraYear then name
    const eraChronicles = publishedChronicles
      .filter((c) => c.focalEraId === eraId)
      .sort((a, b) => {
        const yearA = a.eraYear ?? Infinity;
        const yearB = b.eraYear ?? Infinity;
        if (yearA !== yearB) return yearA - yearB;
        return a.title.localeCompare(b.title);
      });

    for (const c of eraChronicles) {
      eraFolder.children!.push({
        id: generateId(),
        name: c.title || 'Untitled Chronicle',
        type: 'chronicle',
        contentId: c.chronicleId,
      });
    }

    if (eraFolder.children!.length > 0) {
      bodyChildren.push(eraFolder);
    }
  }

  // Unassigned chronicles (no focalEra)
  const unassigned = publishedChronicles
    .filter((c) => !c.focalEraId)
    .sort((a, b) => a.title.localeCompare(b.title));
  if (unassigned.length > 0) {
    const unassignedFolder: ContentTreeNode = {
      id: generateId(),
      name: 'Unassigned Era',
      type: 'folder',
      children: unassigned.map((c) => ({
        id: generateId(),
        name: c.title || 'Untitled Chronicle',
        type: 'chronicle' as const,
        contentId: c.chronicleId,
      })),
    };
    bodyChildren.push(unassignedFolder);
  }

  // =========================================================================
  // Back Matter → Encyclopedia: entities by culture then kind
  // =========================================================================

  const eligibleEntities = input.entities.filter(
    (e) => e.description && e.kind !== 'era' && !existingIds.has(e.id)
  );

  // Build culture → entity grouping
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

  // Build culture name → static page mapping
  const publishedPages = input.staticPages.filter(
    (p) => p.status === 'published' && !existingIds.has(p.pageId)
  );
  const culturePageMap = new Map<string, typeof publishedPages[number]>();
  const nonCulturePages: typeof publishedPages = [];
  for (const p of publishedPages) {
    const { namespace, baseName } = parseNamespace(p.title);
    if (namespace === 'Cultures') {
      culturePageMap.set(baseName.toLowerCase(), p);
    } else {
      nonCulturePages.push(p);
    }
  }

  const encyclopediaChildren: ContentTreeNode[] = [];
  const usedPageIds = new Set<string>();

  const sortedCultures = [...byCulture.keys()].sort();
  for (const cultureName of sortedCultures) {
    const cultureFolder: ContentTreeNode = {
      id: generateId(),
      name: cultureName,
      type: 'folder',
      children: [],
    };

    // Culture static page at top
    const culturePage = culturePageMap.get(cultureName.toLowerCase());
    if (culturePage) {
      cultureFolder.children!.push({
        id: generateId(),
        name: culturePage.title,
        type: 'static_page',
        contentId: culturePage.pageId,
      });
      usedPageIds.add(culturePage.pageId);
    }

    // Group entities by kind
    const cultureEntities = byCulture.get(cultureName)!;
    const byKind = new Map<string, typeof cultureEntities>();
    for (const e of cultureEntities) {
      const kind = e.kind;
      const list = byKind.get(kind) || [];
      list.push(e);
      byKind.set(kind, list);
    }

    const sortedKinds = [...byKind.keys()].sort();
    for (const kind of sortedKinds) {
      const kindEntities = byKind.get(kind)!.sort((a, b) => a.name.localeCompare(b.name));
      const kindFolder: ContentTreeNode = {
        id: generateId(),
        name: kind.charAt(0).toUpperCase() + kind.slice(1) + 's',
        type: 'folder',
        children: kindEntities.map((e) => ({
          id: generateId(),
          name: e.name,
          type: 'entity' as const,
          contentId: e.id,
        })),
      };
      cultureFolder.children!.push(kindFolder);
    }

    if (cultureFolder.children!.length > 0) {
      encyclopediaChildren.push(cultureFolder);
    }
  }

  // Uncultured entities
  if (uncultured.length > 0) {
    const byKind = new Map<string, typeof uncultured>();
    for (const e of uncultured) {
      const list = byKind.get(e.kind) || [];
      list.push(e);
      byKind.set(e.kind, list);
    }

    const unculturedFolder: ContentTreeNode = {
      id: generateId(),
      name: 'Uncategorized',
      type: 'folder',
      children: [],
    };

    const sortedKinds = [...byKind.keys()].sort();
    for (const kind of sortedKinds) {
      const kindEntities = byKind.get(kind)!.sort((a, b) => a.name.localeCompare(b.name));
      const kindFolder: ContentTreeNode = {
        id: generateId(),
        name: kind.charAt(0).toUpperCase() + kind.slice(1) + 's',
        type: 'folder',
        children: kindEntities.map((e) => ({
          id: generateId(),
          name: e.name,
          type: 'entity' as const,
          contentId: e.id,
        })),
      };
      unculturedFolder.children!.push(kindFolder);
    }

    if (unculturedFolder.children!.length > 0) {
      encyclopediaChildren.push(unculturedFolder);
    }
  }

  // =========================================================================
  // Assemble final tree
  // =========================================================================

  const newNodes = [...state.nodes];

  // Replace Body children
  newNodes[bodyIndex] = {
    ...newNodes[bodyIndex],
    children: bodyChildren,
  };

  // Add Encyclopedia + remaining static pages to Back Matter
  if (backMatterIndex >= 0) {
    const existingBackMatterChildren = [...(newNodes[backMatterIndex].children || [])];

    // Insert Encyclopedia folder before existing back matter items
    if (encyclopediaChildren.length > 0) {
      const encyclopediaFolder: ContentTreeNode = {
        id: generateId(),
        name: 'Encyclopedia',
        type: 'folder',
        children: encyclopediaChildren,
      };
      existingBackMatterChildren.unshift(encyclopediaFolder);
    }

    // Add remaining non-culture static pages
    const remainingPages = nonCulturePages.filter((p) => !usedPageIds.has(p.pageId));
    for (const p of remainingPages) {
      existingBackMatterChildren.push({
        id: generateId(),
        name: p.title,
        type: 'static_page',
        contentId: p.pageId,
      });
    }

    newNodes[backMatterIndex] = {
      ...newNodes[backMatterIndex],
      children: existingBackMatterChildren,
    };
  }

  return {
    ...state,
    nodes: newNodes,
    updatedAt: Date.now(),
  };
}

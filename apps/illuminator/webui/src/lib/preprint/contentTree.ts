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

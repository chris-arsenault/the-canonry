/**
 * ContentTreeView — Hierarchical content ordering for book structure.
 *
 * Uses react-arborist for tree rendering with drag-and-drop.
 * Provides scaffold creation, folder management, and content item picker.
 */

import { useState, useMemo, useCallback, useRef } from 'react';
import { Tree } from 'react-arborist';
import type { MoveHandler, RenameHandler, CreateHandler, DeleteHandler } from 'react-arborist';
import type { PersistedEntity } from '../../lib/db/illuminatorDb';
import type { ChronicleRecord } from '../../lib/chronicleTypes';
import type { StaticPage } from '../../lib/staticPageTypes';
import type { ContentTreeState, ContentTreeNode, ContentNodeType } from '../../lib/preprint/prePrintTypes';
import type { TreeNodeData } from './TreeNodeRenderer';
import TreeNodeRenderer from './TreeNodeRenderer';
import {
  createScaffold,
  addFolder,
  deleteNode,
  renameNode,
  addContentItem,
  getAllContentIds,
  toArboristData,
  fromArboristData,
  findNode,
} from '../../lib/preprint/contentTree';
import { countWords } from '../../lib/db/staticPageRepository';

interface ContentTreeViewProps {
  entities: PersistedEntity[];
  chronicles: ChronicleRecord[];
  staticPages: StaticPage[];
  treeState: ContentTreeState | null;
  projectId: string;
  simulationRunId: string;
  onTreeChange: (tree: ContentTreeState) => void;
}

interface ContentOption {
  type: ContentNodeType;
  contentId: string;
  name: string;
  subtitle: string;
}

export default function ContentTreeView({
  entities,
  chronicles,
  staticPages,
  treeState,
  projectId,
  simulationRunId,
  onTreeChange,
}: ContentTreeViewProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerFilter, setPickerFilter] = useState('');
  const [newFolderParent, setNewFolderParent] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const treeRef = useRef<any>(null);

  // Build content options (filterable list of items to add to tree)
  const usedIds = useMemo(
    () => (treeState ? getAllContentIds(treeState) : new Set<string>()),
    [treeState]
  );

  const contentOptions = useMemo<ContentOption[]>(() => {
    const opts: ContentOption[] = [];

    for (const e of entities) {
      if (!e.description || usedIds.has(e.id)) continue;
      opts.push({
        type: 'entity',
        contentId: e.id,
        name: e.name,
        subtitle: `${e.kind}${e.subtype ? ' / ' + e.subtype : ''}`,
      });
    }

    for (const c of chronicles) {
      if (c.status !== 'complete' && c.status !== 'assembly_ready') continue;
      if (usedIds.has(c.chronicleId)) continue;
      opts.push({
        type: 'chronicle',
        contentId: c.chronicleId,
        name: c.title || 'Untitled Chronicle',
        subtitle: `${c.format} \u2022 ${c.focusType}`,
      });
    }

    for (const p of staticPages) {
      if (p.status !== 'published' || usedIds.has(p.pageId)) continue;
      opts.push({
        type: 'static_page',
        contentId: p.pageId,
        name: p.title,
        subtitle: `${p.wordCount} words`,
      });
    }

    return opts;
  }, [entities, chronicles, staticPages, usedIds]);

  // Enrich tree nodes with metadata for display
  const enrichedData = useMemo<TreeNodeData[]>(() => {
    if (!treeState) return [];

    const entityMap = new Map(entities.map((e) => [e.id, e]));
    const chronicleMap = new Map(chronicles.map((c) => [c.chronicleId, c]));
    const pageMap = new Map(staticPages.map((p) => [p.pageId, p]));

    function enrich(nodes: ContentTreeNode[]): TreeNodeData[] {
      return nodes.map((node) => {
        const enriched: TreeNodeData = { ...node };

        if (node.type === 'entity' && node.contentId) {
          const ent = entityMap.get(node.contentId);
          if (ent) {
            enriched.meta = {
              wordCount: countWords(ent.description || ''),
              imageCount: ent.enrichment?.image?.imageId ? 1 : 0,
              hasDescription: !!ent.description,
              hasImage: !!ent.enrichment?.image?.imageId,
            };
          }
        } else if (node.type === 'chronicle' && node.contentId) {
          const chr = chronicleMap.get(node.contentId);
          if (chr) {
            const content = chr.finalContent || chr.assembledContent || '';
            const imgCount = chr.imageRefs?.refs?.filter(
              (r) => r.type === 'prompt_request' && r.status === 'complete'
            ).length || 0;
            enriched.meta = {
              wordCount: countWords(content),
              imageCount: imgCount + (chr.coverImage?.generatedImageId ? 1 : 0),
              hasDescription: !!content,
              hasImage: imgCount > 0,
            };
          }
        } else if (node.type === 'static_page' && node.contentId) {
          const page = pageMap.get(node.contentId);
          if (page) {
            enriched.meta = {
              wordCount: page.wordCount,
              imageCount: 0,
              hasDescription: !!page.content,
              hasImage: true, // Pages don't require images
            };
          }
        }

        if (node.children) {
          enriched.children = enrich(node.children);
        }

        return enriched;
      });
    }

    return enrich(toArboristData(treeState.nodes));
  }, [treeState, entities, chronicles, staticPages]);

  // Handlers
  const handleCreateScaffold = useCallback(() => {
    const scaffold = createScaffold(projectId, simulationRunId);
    onTreeChange(scaffold);
  }, [projectId, simulationRunId, onTreeChange]);

  const handleMove: MoveHandler<TreeNodeData> = useCallback(
    ({ dragIds, parentId, index }) => {
      if (!treeState || dragIds.length === 0) return;
      // For moves, reconstruct the full tree from arborist state
      // react-arborist handles the reorder in its internal state,
      // so we rebuild from the tree ref
      const api = treeRef.current;
      if (!api) return;

      // Manually reconstruct: remove node, then insert at new parent+index
      let newState = treeState;
      for (const dragId of dragIds) {
        const node = findNode(newState, dragId);
        if (!node) continue;
        // Remove from current location
        const { nodes: withoutNode } = {
          ...newState,
          nodes: removeNodeFromTree(newState.nodes, dragId),
        };
        // Insert at new location
        if (parentId) {
          newState = {
            ...newState,
            nodes: insertNodeInTree(withoutNode, parentId, { ...node }, index),
            updatedAt: Date.now(),
          };
        } else {
          // Moving to root level
          const rootNodes = [...withoutNode];
          rootNodes.splice(index, 0, { ...node });
          newState = { ...newState, nodes: rootNodes, updatedAt: Date.now() };
        }
      }
      onTreeChange(newState);
    },
    [treeState, onTreeChange]
  );

  const handleRename: RenameHandler<TreeNodeData> = useCallback(
    ({ id, name }) => {
      if (!treeState) return;
      onTreeChange(renameNode(treeState, id, name));
    },
    [treeState, onTreeChange]
  );

  const handleDelete: DeleteHandler<TreeNodeData> = useCallback(
    ({ ids }) => {
      if (!treeState) return;
      let newState = treeState;
      for (const id of ids) {
        newState = deleteNode(newState, id);
      }
      onTreeChange(newState);
    },
    [treeState, onTreeChange]
  );

  const handleAddFolder = useCallback(() => {
    if (!treeState || !newFolderParent || !newFolderName.trim()) return;
    onTreeChange(addFolder(treeState, newFolderParent, newFolderName.trim()));
    setNewFolderName('');
    setNewFolderParent(null);
  }, [treeState, newFolderParent, newFolderName, onTreeChange]);

  const handleAddContent = useCallback(
    (option: ContentOption) => {
      if (!treeState || !selectedNodeId) return;
      const target = findNode(treeState, selectedNodeId);
      if (!target || target.type !== 'folder') return;
      onTreeChange(
        addContentItem(treeState, selectedNodeId, {
          type: option.type,
          contentId: option.contentId,
          name: option.name,
        })
      );
      setPickerOpen(false);
      setPickerFilter('');
    },
    [treeState, selectedNodeId, onTreeChange]
  );

  const filteredOptions = useMemo(() => {
    if (!pickerFilter) return contentOptions;
    const lower = pickerFilter.toLowerCase();
    return contentOptions.filter(
      (o) => o.name.toLowerCase().includes(lower) || o.subtitle.toLowerCase().includes(lower)
    );
  }, [contentOptions, pickerFilter]);

  // No tree yet: show scaffold button
  if (!treeState) {
    return (
      <div className="preprint-tree-empty">
        <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-md)' }}>
          Create a book structure to organize content for print. The scaffold includes standard
          Front Matter, Body, and Back Matter sections.
        </p>
        <button className="preprint-action-button" onClick={handleCreateScaffold}>
          Create Book Scaffold
        </button>
      </div>
    );
  }

  const selectedNode = selectedNodeId ? findNode(treeState, selectedNodeId) : null;
  const isSelectedFolder = selectedNode?.type === 'folder';

  return (
    <div className="preprint-tree-layout">
      <div className="preprint-tree-main">
        <div className="preprint-tree-toolbar">
          <button
            className="preprint-action-button small"
            disabled={!isSelectedFolder}
            onClick={() => {
              if (selectedNodeId) setNewFolderParent(selectedNodeId);
            }}
            title="Add folder to selected folder"
          >
            + Folder
          </button>
          <button
            className="preprint-action-button small"
            disabled={!isSelectedFolder}
            onClick={() => setPickerOpen(true)}
            title="Add content to selected folder"
          >
            + Content
          </button>
          <button
            className="preprint-action-button small danger"
            disabled={!selectedNodeId}
            onClick={() => {
              if (selectedNodeId && confirm('Delete this node and all children?')) {
                onTreeChange(deleteNode(treeState, selectedNodeId));
                setSelectedNodeId(null);
              }
            }}
            title="Delete selected node"
          >
            Delete
          </button>
          <div style={{ flex: 1 }} />
          <button
            className="preprint-action-button small"
            onClick={handleCreateScaffold}
            title="Reset to default scaffold (replaces current tree)"
          >
            Reset Scaffold
          </button>
        </div>

        <div className="preprint-tree-container">
          <Tree
            ref={treeRef}
            data={enrichedData}
            onMove={handleMove}
            onRename={handleRename}
            onDelete={handleDelete}
            onSelect={(nodes) => {
              setSelectedNodeId(nodes.length > 0 ? nodes[0]?.id ?? null : null);
            }}
            openByDefault={true}
            width="100%"
            height={600}
            indent={24}
            rowHeight={32}
            overscanCount={5}
            disableDrag={false}
            disableDrop={(args) => {
              // Only allow dropping into folders
              return args.parentNode !== null && args.parentNode.data.type !== 'folder';
            }}
          >
            {TreeNodeRenderer}
          </Tree>
        </div>
      </div>

      {/* Add Folder Dialog */}
      {newFolderParent && (
        <div className="preprint-modal-overlay" onClick={() => setNewFolderParent(null)}>
          <div className="preprint-modal" onClick={(e) => e.stopPropagation()}>
            <h3>New Folder</h3>
            <input
              type="text"
              className="preprint-input"
              placeholder="Folder name"
              value={newFolderName}
              autoFocus
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddFolder();
                if (e.key === 'Escape') setNewFolderParent(null);
              }}
            />
            <div className="preprint-modal-actions">
              <button className="preprint-action-button small" onClick={() => setNewFolderParent(null)}>
                Cancel
              </button>
              <button
                className="preprint-action-button small"
                onClick={handleAddFolder}
                disabled={!newFolderName.trim()}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content Picker */}
      {pickerOpen && (
        <div className="preprint-modal-overlay" onClick={() => setPickerOpen(false)}>
          <div className="preprint-modal picker" onClick={(e) => e.stopPropagation()}>
            <h3>Add Content</h3>
            <input
              type="text"
              className="preprint-input"
              placeholder="Search entities, chronicles, pages..."
              value={pickerFilter}
              autoFocus
              onChange={(e) => setPickerFilter(e.target.value)}
            />
            <div className="preprint-picker-list">
              {filteredOptions.length === 0 && (
                <div style={{ padding: 'var(--space-sm)', color: 'var(--text-secondary)' }}>
                  No available content. Items already in the tree or without published content are excluded.
                </div>
              )}
              {filteredOptions.slice(0, 50).map((opt) => (
                <button
                  key={`${opt.type}-${opt.contentId}`}
                  className="preprint-picker-item"
                  onClick={() => handleAddContent(opt)}
                >
                  <span className="preprint-picker-item-icon">
                    {opt.type === 'entity' ? '{}' : opt.type === 'chronicle' ? '\u2016' : '[]'}
                  </span>
                  <span className="preprint-picker-item-name">{opt.name}</span>
                  <span className="preprint-picker-item-sub">{opt.subtitle}</span>
                </button>
              ))}
            </div>
            <div className="preprint-modal-actions">
              <button className="preprint-action-button small" onClick={() => setPickerOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper functions for tree manipulation (used by move handler)
function removeNodeFromTree(nodes: ContentTreeNode[], nodeId: string): ContentTreeNode[] {
  const result: ContentTreeNode[] = [];
  for (const node of nodes) {
    if (node.id === nodeId) continue;
    const copy = { ...node };
    if (copy.children) {
      copy.children = removeNodeFromTree(copy.children, nodeId);
    }
    result.push(copy);
  }
  return result;
}

function insertNodeInTree(
  nodes: ContentTreeNode[],
  parentId: string,
  item: ContentTreeNode,
  index: number
): ContentTreeNode[] {
  return nodes.map((node) => {
    if (node.id === parentId && node.children !== undefined) {
      const children = [...node.children];
      children.splice(Math.min(index, children.length), 0, item);
      return { ...node, children };
    }
    if (node.children) {
      return { ...node, children: insertNodeInTree(node.children, parentId, item, index) };
    }
    return node;
  });
}

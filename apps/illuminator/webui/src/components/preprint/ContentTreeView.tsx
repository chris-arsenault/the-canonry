/**
 * ContentTreeView — Two-pane content ordering for book structure.
 *
 * Left pane: react-arborist tree with drag-and-drop reordering.
 * Right pane: ContentPalette — filterable/sortable list of available content.
 * Auto-populate button fills the tree in Chronicler's natural era order.
 *
 * Both panes share a single react-dnd DndProvider so palette items can be
 * dragged directly onto the tree.
 */

import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { DndProvider, useDragDropManager, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { Tree, TreeApi, NodeApi } from "react-arborist";
import type { MoveHandler, RenameHandler, DeleteHandler } from "react-arborist";
import type { PersistedEntity } from "../../lib/db/illuminatorDb";
import type { ChronicleRecord } from "../../lib/chronicleTypes";
import type { StaticPage } from "../../lib/staticPageTypes";
import type { EraNarrativeRecord } from "../../lib/eraNarrativeTypes";
import type {
  ContentTreeState,
  ContentNodeType,
} from "../../lib/preprint/prePrintTypes";
import type { TreeNodeData } from "./TreeNodeRenderer";
import TreeNodeRenderer from "./TreeNodeRenderer";
import ContentPalette, { PALETTE_ITEM_TYPE } from "./ContentPalette";
import type { PaletteItemDragPayload } from "./ContentPalette";
import PageLayoutEditor from "./PageLayoutEditor";
import {
  createScaffold,
  addFolder,
  deleteNode,
  renameNode,
  addContentItem,
  getAllContentIds,
  findNode,
  autoPopulateBody,
} from "../../lib/preprint/contentTree";
import {
  enrichTreeNodes,
  removeNodeFromTree,
  insertNodeInTree,
  buildAutoPopulateInputs,
  treeHasExistingContent,
} from "./contentTreeHelpers";
import "./ContentTreeView.css";

interface ContentTreeViewProps {
  entities: PersistedEntity[];
  chronicles: ChronicleRecord[];
  staticPages: StaticPage[];
  eraNarratives: EraNarrativeRecord[];
  eraOrderMap: Map<string, number>;
  treeState: ContentTreeState | null;
  projectId: string;
  simulationRunId: string;
  onTreeChange: (tree: ContentTreeState) => void;
}

// ── Inner tree pane ──────────────────────────────────────────────────

interface TreePaneProps {
  enrichedData: TreeNodeData[];
  treeRef: React.RefObject<TreeApi<TreeNodeData> | null>;
  isSelectedFolder: boolean;
  selectedNodeId: string | null;
  treeState: ContentTreeState;
  onTreeChange: (tree: ContentTreeState) => void;
  onMove: MoveHandler<TreeNodeData>;
  onRename: RenameHandler<TreeNodeData>;
  onDelete: DeleteHandler<TreeNodeData>;
  onSelect: (nodes: NodeApi<TreeNodeData>[]) => void;
}

function TreePane({
  enrichedData,
  treeRef,
  isSelectedFolder,
  selectedNodeId,
  treeState,
  onTreeChange,
  onMove,
  onRename,
  onDelete,
  onSelect,
}: Readonly<TreePaneProps>) {
  const manager = useDragDropManager();
  const treeContainerRef = useRef<HTMLDivElement>(null);
  const [treeHeight, setTreeHeight] = useState(400);

  useEffect(() => {
    const container = treeContainerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setTreeHeight(Math.max(200, Math.floor(entry.contentRect.height)));
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const [{ isOver }, dropRef] = useDrop<PaletteItemDragPayload, void, { isOver: boolean }>({
    accept: PALETTE_ITEM_TYPE,
    drop: (item) => {
      if (!selectedNodeId) return;
      const target = findNode(treeState, selectedNodeId);
      if (!target || target.type !== "folder") return;
      onTreeChange(addContentItem(treeState, selectedNodeId, item));
    },
    canDrop: () => isSelectedFolder,
    collect: (monitor) => ({ isOver: monitor.isOver() }),
  });

  const combinedRef = useCallback(
    (node: HTMLDivElement | null) => {
      treeContainerRef.current = node;
      dropRef(node);
    },
    [dropRef]
  );

  const handleDisableDrop = useCallback(
    (args: { parentNode: NodeApi<TreeNodeData> | null }) =>
      args.parentNode !== null && args.parentNode.data.type !== "folder",
    []
  );

  const containerClass = `preprint-tree-container${isSelectedFolder ? " drop-ready" : ""}${isOver && isSelectedFolder ? " drop-hover" : ""}`;
  const layoutProps = useMemo(() => ({ width: "100%" as const, height: treeHeight, indent: 24, rowHeight: 32, overscanCount: 5 }), [treeHeight]);

  return (
    <div className={containerClass} ref={combinedRef}>
      <Tree ref={treeRef} data={enrichedData} dndManager={manager} onMove={onMove} onRename={onRename} onDelete={onDelete} onSelect={onSelect} openByDefault disableDrop={handleDisableDrop} {...layoutProps}>
        {TreeNodeRenderer}
      </Tree>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────

export default function ContentTreeView({
  entities,
  chronicles,
  staticPages,
  eraNarratives,
  eraOrderMap,
  treeState,
  projectId,
  simulationRunId,
  onTreeChange,
}: Readonly<ContentTreeViewProps>) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [newFolderParent, setNewFolderParent] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const treeRef = useRef<TreeApi<TreeNodeData> | null>(null);

  const usedIds = useMemo(
    () => (treeState ? getAllContentIds(treeState) : new Set<string>()),
    [treeState]
  );

  const enrichedData = useMemo<TreeNodeData[]>(
    () => (treeState ? enrichTreeNodes(treeState, entities, chronicles, staticPages, eraNarratives) : []),
    [treeState, entities, chronicles, staticPages, eraNarratives]
  );

  const handleCreateScaffold = useCallback(() => {
    onTreeChange(createScaffold(projectId, simulationRunId));
  }, [projectId, simulationRunId, onTreeChange]);

  const handleMove: MoveHandler<TreeNodeData> = useCallback(
    ({ dragIds, parentId, index }) => {
      if (!treeState || dragIds.length === 0) return;
      if (!treeRef.current) return;

      let newState = treeState;
      for (const dragId of dragIds) {
        const node = findNode(newState, dragId);
        if (!node) continue;
        const withoutNode = removeNodeFromTree(newState.nodes, dragId);
        if (parentId) {
          newState = {
            ...newState,
            nodes: insertNodeInTree(withoutNode, parentId, { ...node }, index),
            updatedAt: Date.now(),
          };
        } else {
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
    setNewFolderName("");
    setNewFolderParent(null);
  }, [treeState, newFolderParent, newFolderName, onTreeChange]);

  const handleAddContent = useCallback(
    (item: { type: ContentNodeType; contentId: string; name: string }) => {
      if (!treeState || !selectedNodeId) return;
      const target = findNode(treeState, selectedNodeId);
      if (!target || target.type !== "folder") return;
      onTreeChange(addContentItem(treeState, selectedNodeId, item));
    },
    [treeState, selectedNodeId, onTreeChange]
  );

  const handleAutoPopulate = useCallback(() => {
    if (!treeState) return;
    if (treeHasExistingContent(treeState)) {
      if (!confirm("Body and Back Matter already have content. Replace with auto-populated structure?")) {
        return;
      }
    }
    const inputs = buildAutoPopulateInputs(chronicles, eraNarratives, entities, staticPages, eraOrderMap);
    onTreeChange(autoPopulateBody(treeState, inputs));
  }, [treeState, chronicles, eraNarratives, entities, staticPages, eraOrderMap, onTreeChange]);

  const handleSelect = useCallback(
    (nodes: NodeApi<TreeNodeData>[]) => {
      setSelectedNodeId(nodes.length > 0 ? (nodes[0]?.id ?? null) : null);
    },
    []
  );

  const handleOpenAddFolder = useCallback(() => {
    if (selectedNodeId) setNewFolderParent(selectedNodeId);
  }, [selectedNodeId]);

  const handleDeleteSelected = useCallback(() => {
    if (selectedNodeId && treeState && confirm("Delete this node and all children?")) {
      onTreeChange(deleteNode(treeState, selectedNodeId));
      setSelectedNodeId(null);
    }
  }, [selectedNodeId, treeState, onTreeChange]);

  const handleCloseAddFolder = useCallback(() => setNewFolderParent(null), []);

  if (!treeState) {
    return (
      <div className="preprint-tree-empty">
        <p className="ctv-empty-msg">
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
  const isSelectedFolder = selectedNode?.type === "folder";

  return (
    <div className="preprint-tree-layout">
      <div className="preprint-tree-toolbar">
        <button className="preprint-action-button small" onClick={handleAutoPopulate} title="Auto-populate Body and Encyclopedia from Chronicler's era ordering">Auto-Populate</button>
        <button className="preprint-action-button small" disabled={!isSelectedFolder} onClick={handleOpenAddFolder} title="Add folder to selected folder">+ Folder</button>
        <button className="preprint-action-button small danger" disabled={!selectedNodeId} onClick={handleDeleteSelected} title="Delete selected node">Delete</button>
        <div className="ctv-toolbar-spacer" />
        <button className="preprint-action-button small" onClick={handleCreateScaffold} title="Reset to default scaffold (replaces current tree)">Reset Scaffold</button>
      </div>

      <DndProvider backend={HTML5Backend}>
        <div className="preprint-tree-split">
          <div className="preprint-tree-left">
            <TreePane
              enrichedData={enrichedData}
              treeRef={treeRef}
              isSelectedFolder={!!isSelectedFolder}
              selectedNodeId={selectedNodeId}
              treeState={treeState}
              onTreeChange={onTreeChange}
              onMove={handleMove}
              onRename={handleRename}
              onDelete={handleDelete}
              onSelect={handleSelect}
            />
          </div>
          <div className="preprint-tree-right">
            <ContentPalette
              entities={entities}
              chronicles={chronicles}
              staticPages={staticPages}
              eraNarratives={eraNarratives}
              usedIds={usedIds}
              selectedFolderId={isSelectedFolder ? selectedNodeId : null}
              onAddContent={handleAddContent}
            />
            {selectedNode && selectedNode.type !== "folder" && selectedNode.contentId && (
              <PageLayoutEditor
                pageId={selectedNode.contentId}
                pageName={selectedNode.name}
                simulationRunId={simulationRunId}
              />
            )}
          </div>
        </div>
      </DndProvider>

      {newFolderParent && (
        <div className="preprint-modal-overlay" onClick={handleCloseAddFolder} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }} >
          <div className="preprint-modal" onClick={(e) => e.stopPropagation()} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }} >
            <h3>New Folder</h3>
            <input
              type="text"
              className="preprint-input"
              placeholder="Folder name"
              value={newFolderName}
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddFolder();
                if (e.key === "Escape") setNewFolderParent(null);
              }}
            />
            <div className="preprint-modal-actions">
              <button className="preprint-action-button small" onClick={handleCloseAddFolder}>Cancel</button>
              <button className="preprint-action-button small" onClick={handleAddFolder} disabled={!newFolderName.trim()}>Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

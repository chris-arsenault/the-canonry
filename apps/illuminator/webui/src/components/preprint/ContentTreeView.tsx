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
import { Tree } from "react-arborist";
import type { MoveHandler, RenameHandler, DeleteHandler } from "react-arborist";
import type { PersistedEntity } from "../../lib/db/illuminatorDb";
import type { ChronicleRecord } from "../../lib/chronicleTypes";
import type { StaticPage } from "../../lib/staticPageTypes";
import type { EraNarrativeRecord } from "../../lib/eraNarrativeTypes";
import type {
  ContentTreeState,
  ContentTreeNode,
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
  toArboristData,
  findNode,
  autoPopulateBody,
} from "../../lib/preprint/contentTree";
import { resolveActiveContent } from "../../lib/db/eraNarrativeRepository";
import { countWords } from "../../lib/db/staticPageRepository";
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
// Rendered inside the shared DndProvider so it can call useDragDropManager()
// and useDrop().

interface TreePaneProps {
  enrichedData: TreeNodeData[];
  treeRef: React.RefObject<any>;
  isSelectedFolder: boolean;
  selectedNodeId: string | null;
  treeState: ContentTreeState;
  onTreeChange: (tree: ContentTreeState) => void;
  onMove: MoveHandler<TreeNodeData>;
  onRename: RenameHandler<TreeNodeData>;
  onDelete: DeleteHandler<TreeNodeData>;
  onSelect: (nodes: any[]) => void;
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

  // Measure container height for react-arborist (requires numeric height)
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

  // Drop target for palette items
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

  // Combine refs: one for ResizeObserver, one for react-dnd drop target
  const combinedRef = useCallback(
    (node: HTMLDivElement | null) => {
      treeContainerRef.current = node;
      dropRef(node);
    },
    [dropRef]
  );

  return (
    <div
      className={`preprint-tree-container${isSelectedFolder ? " drop-ready" : ""}${isOver && isSelectedFolder ? " drop-hover" : ""}`}
      ref={combinedRef}
    >
      <Tree
        ref={treeRef}
        data={enrichedData}
        dndManager={manager}
        onMove={onMove}
        onRename={onRename}
        onDelete={onDelete}
        onSelect={onSelect}
        openByDefault={true}
        width="100%"
        height={treeHeight}
        indent={24}
        rowHeight={32}
        overscanCount={5}
        disableDrag={false}
        disableDrop={(args) => {
          return args.parentNode !== null && args.parentNode.data.type !== "folder";
        }}
      >
        {TreeNodeRenderer}
      </Tree>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────

/** Count completed prompt_request image refs */
function countCompletedPromptImages(refs: any[] | undefined): number {
  return refs?.filter(
    (r: any) => r.type === "prompt_request" && r.status === "complete"
  ).length || 0;
}

/** Count image refs that are chronicle refs or completed prompt requests */
function countNarrativeImageRefs(refs: any[] | undefined): number {
  return refs?.filter(
    (r: any) =>
      r.type === "chronicle_ref" ||
      (r.type === "prompt_request" && r.status === "complete")
  ).length || 0;
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
  const treeRef = useRef<any>(null);

  // Build set of used content IDs
  const usedIds = useMemo(
    () => (treeState ? getAllContentIds(treeState) : new Set<string>()),
    [treeState]
  );

  // Enrich tree nodes with metadata for display
  const enrichedData = useMemo<TreeNodeData[]>(() => {
    if (!treeState) return [];

    const entityMap = new Map(entities.map((e) => [e.id, e]));
    const chronicleMap = new Map(chronicles.map((c) => [c.chronicleId, c]));
    const pageMap = new Map(staticPages.map((p) => [p.pageId, p]));
    const narrativeMap = new Map(eraNarratives.map((n) => [n.narrativeId, n]));

    function enrich(nodes: ContentTreeNode[]): TreeNodeData[] {
      return nodes.map((node) => {
        const enriched: TreeNodeData = { ...node };

        if (node.type === "entity" && node.contentId) {
          const ent = entityMap.get(node.contentId);
          if (ent) {
            enriched.meta = {
              wordCount: countWords(ent.description || ""),
              imageCount: ent.enrichment?.image?.imageId ? 1 : 0,
              hasDescription: !!ent.description,
              hasImage: !!ent.enrichment?.image?.imageId,
            };
          }
        } else if (node.type === "chronicle" && node.contentId) {
          const chr = chronicleMap.get(node.contentId);
          if (chr) {
            const content = chr.finalContent || chr.assembledContent || "";
            const imgCount = countCompletedPromptImages(chr.imageRefs?.refs);
            enriched.meta = {
              wordCount: countWords(content),
              imageCount: imgCount + (chr.coverImage?.generatedImageId ? 1 : 0),
              hasDescription: !!content,
              hasImage: imgCount > 0,
            };
          }
        } else if (node.type === "static_page" && node.contentId) {
          const page = pageMap.get(node.contentId);
          if (page) {
            enriched.meta = {
              wordCount: page.wordCount,
              imageCount: 0,
              hasDescription: !!page.content,
              hasImage: true, // Pages don't require images
            };
          }
        } else if (node.type === "era_narrative" && node.contentId) {
          const narr = narrativeMap.get(node.contentId);
          if (narr) {
            const { content } = resolveActiveContent(narr);
            const imgCount =
              (narr.coverImage?.generatedImageId ? 1 : 0) +
              countNarrativeImageRefs(narr.imageRefs?.refs);
            enriched.meta = {
              wordCount: countWords(content || ""),
              imageCount: imgCount,
              hasDescription: !!content,
              hasImage: !!narr.coverImage?.generatedImageId,
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
  }, [treeState, entities, chronicles, staticPages, eraNarratives]);

  // Handlers
  const handleCreateScaffold = useCallback(() => {
    const scaffold = createScaffold(projectId, simulationRunId);
    onTreeChange(scaffold);
  }, [projectId, simulationRunId, onTreeChange]);

  const handleMove: MoveHandler<TreeNodeData> = useCallback(
    ({ dragIds, parentId, index }) => {
      if (!treeState || dragIds.length === 0) return;
      const api = treeRef.current;
      if (!api) return;

      let newState = treeState;
      for (const dragId of dragIds) {
        const node = findNode(newState, dragId);
        if (!node) continue;
        const { nodes: withoutNode } = {
          ...newState,
          nodes: removeNodeFromTree(newState.nodes, dragId),
        };
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

  // Auto-populate
  const handleAutoPopulate = useCallback(() => {
    if (!treeState) return;

    const bodyNode = treeState.nodes.find((n) => n.name === "Body" && n.type === "folder");
    const backMatterNode = treeState.nodes.find(
      (n) => n.name === "Back Matter" && n.type === "folder"
    );
    const hasExistingContent =
      (bodyNode?.children?.length ?? 0) > 0 ||
      (backMatterNode?.children?.some((c) => c.name === "Encyclopedia") ?? false);

    if (hasExistingContent) {
      if (
        !confirm(
          "Body and Back Matter already have content. Replace with auto-populated structure?"
        )
      )
        return;
    }

    const chronicleInput = chronicles
      .filter((c) => c.status === "complete" || c.status === "assembly_ready")
      .map((c) => ({
        chronicleId: c.chronicleId,
        title: c.title || "Untitled Chronicle",
        status: c.status,
        focalEraId: c.temporalContext?.focalEra?.id || (c as any).focalEra?.id,
        focalEraName: c.temporalContext?.focalEra?.name || (c as any).focalEra?.name,
        eraYear: c.eraYear,
      }));

    const narrativeInput = eraNarratives.map((n) => ({
      narrativeId: n.narrativeId,
      eraId: n.eraId,
      eraName: n.eraName,
      status: n.status,
    }));

    const entityInput = entities.map((e) => ({
      id: e.id,
      name: e.name,
      kind: e.kind,
      subtype: e.subtype,
      culture: e.culture,
      description: e.description,
    }));

    const pageInput = staticPages.map((p) => ({
      pageId: p.pageId,
      title: p.title,
      status: p.status,
    }));

    const newTree = autoPopulateBody(treeState, {
      chronicles: chronicleInput,
      eraNarratives: narrativeInput,
      entities: entityInput,
      staticPages: pageInput,
      eraOrder: eraOrderMap,
    });

    onTreeChange(newTree);
  }, [treeState, chronicles, eraNarratives, entities, staticPages, eraOrderMap, onTreeChange]);

  // No tree yet: show scaffold button
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
        <button
          className="preprint-action-button small"
          onClick={handleAutoPopulate}
          title="Auto-populate Body and Encyclopedia from Chronicler's era ordering"
        >
          Auto-Populate
        </button>
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
          className="preprint-action-button small danger"
          disabled={!selectedNodeId}
          onClick={() => {
            if (selectedNodeId && confirm("Delete this node and all children?")) {
              onTreeChange(deleteNode(treeState, selectedNodeId));
              setSelectedNodeId(null);
            }
          }}
          title="Delete selected node"
        >
          Delete
        </button>
        <div className="ctv-toolbar-spacer" />
        <button
          className="preprint-action-button small"
          onClick={handleCreateScaffold}
          title="Reset to default scaffold (replaces current tree)"
        >
          Reset Scaffold
        </button>
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
              onSelect={(nodes) => {
                setSelectedNodeId(nodes.length > 0 ? (nodes[0]?.id ?? null) : null);
              }}
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

      {/* Add Folder Dialog */}
      {newFolderParent && (
        <div className="preprint-modal-overlay" onClick={() => setNewFolderParent(null)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }} >
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
              <button
                className="preprint-action-button small"
                onClick={() => setNewFolderParent(null)}
              >
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

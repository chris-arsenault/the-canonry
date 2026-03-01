/**
 * Pure helper functions for ContentTreeView enrichment and tree manipulation.
 * Extracted to keep ContentTreeView.tsx under the line-count limit.
 */

import type { PersistedEntity } from "../../lib/db/illuminatorDb";
import type { ChronicleRecord, ChronicleImageRef } from "../../lib/chronicleTypes";
import type { StaticPage } from "../../lib/staticPageTypes";
import type { EraNarrativeRecord, EraNarrativeImageRef } from "../../lib/eraNarrativeTypes";
import type { ContentTreeNode, ContentTreeState } from "../../lib/preprint/prePrintTypes";
import type { TreeNodeData } from "./TreeNodeRenderer";
import { resolveActiveContent } from "../../lib/db/eraNarrativeRepository";
import { countWords } from "../../lib/db/staticPageRepository";
import { toArboristData } from "../../lib/preprint/contentTree";

// ── Image ref counting ───────────────────────────────────────────────

/** Count completed prompt_request image refs */
function countCompletedPromptImages(refs: ChronicleImageRef[] | undefined): number {
  return refs?.filter(
    (r) => r.type === "prompt_request" && r.status === "complete"
  ).length || 0;
}

/** Count image refs that are chronicle refs or completed prompt requests */
function countNarrativeImageRefs(refs: EraNarrativeImageRef[] | undefined): number {
  return refs?.filter(
    (r) =>
      r.type === "chronicle_ref" ||
      (r.type === "prompt_request" && r.status === "complete")
  ).length || 0;
}

// ── Per-type enrichment ──────────────────────────────────────────────

interface NodeMeta {
  wordCount: number;
  imageCount: number;
  hasDescription: boolean;
  hasImage: boolean;
}

function enrichEntityNode(ent: PersistedEntity): NodeMeta {
  return {
    wordCount: countWords(ent.description || ""),
    imageCount: ent.enrichment?.image?.imageId ? 1 : 0,
    hasDescription: !!ent.description,
    hasImage: !!ent.enrichment?.image?.imageId,
  };
}

function enrichChronicleNode(chr: ChronicleRecord): NodeMeta {
  const content = chr.finalContent || chr.assembledContent || "";
  const imgCount = countCompletedPromptImages(chr.imageRefs?.refs);
  return {
    wordCount: countWords(content),
    imageCount: imgCount + (chr.coverImage?.generatedImageId ? 1 : 0),
    hasDescription: !!content,
    hasImage: imgCount > 0,
  };
}

function enrichStaticPageNode(page: StaticPage): NodeMeta {
  return {
    wordCount: page.wordCount,
    imageCount: 0,
    hasDescription: !!page.content,
    hasImage: true, // Pages don't require images
  };
}

function enrichEraNarrativeNode(narr: EraNarrativeRecord): NodeMeta {
  const { content } = resolveActiveContent(narr);
  const imgCount =
    (narr.coverImage?.generatedImageId ? 1 : 0) +
    countNarrativeImageRefs(narr.imageRefs?.refs);
  return {
    wordCount: countWords(content || ""),
    imageCount: imgCount,
    hasDescription: !!content,
    hasImage: !!narr.coverImage?.generatedImageId,
  };
}

function resolveNodeMeta(
  node: ContentTreeNode,
  entityMap: Map<string, PersistedEntity>,
  chronicleMap: Map<string, ChronicleRecord>,
  pageMap: Map<string, StaticPage>,
  narrativeMap: Map<string, EraNarrativeRecord>
): NodeMeta | undefined {
  if (!node.contentId) return undefined;
  if (node.type === "entity") {
    const ent = entityMap.get(node.contentId);
    return ent ? enrichEntityNode(ent) : undefined;
  }
  if (node.type === "chronicle") {
    const chr = chronicleMap.get(node.contentId);
    return chr ? enrichChronicleNode(chr) : undefined;
  }
  if (node.type === "static_page") {
    const page = pageMap.get(node.contentId);
    return page ? enrichStaticPageNode(page) : undefined;
  }
  if (node.type === "era_narrative") {
    const narr = narrativeMap.get(node.contentId);
    return narr ? enrichEraNarrativeNode(narr) : undefined;
  }
  return undefined;
}

// ── Tree enrichment (public) ─────────────────────────────────────────

export function enrichTreeNodes(
  treeState: ContentTreeState,
  entities: PersistedEntity[],
  chronicles: ChronicleRecord[],
  staticPages: StaticPage[],
  eraNarratives: EraNarrativeRecord[]
): TreeNodeData[] {
  const entityMap = new Map(entities.map((e) => [e.id, e]));
  const chronicleMap = new Map(chronicles.map((c) => [c.chronicleId, c]));
  const pageMap = new Map(staticPages.map((p) => [p.pageId, p]));
  const narrativeMap = new Map(eraNarratives.map((n) => [n.narrativeId, n]));

  function enrich(nodes: ContentTreeNode[]): TreeNodeData[] {
    return nodes.map((node) => {
      const enriched: TreeNodeData = { ...node };
      enriched.meta = resolveNodeMeta(node, entityMap, chronicleMap, pageMap, narrativeMap);
      if (node.children) {
        enriched.children = enrich(node.children);
      }
      return enriched;
    });
  }

  return enrich(toArboristData(treeState.nodes));
}

// ── Tree manipulation (used by move handler) ─────────────────────────

export function removeNodeFromTree(nodes: ContentTreeNode[], nodeId: string): ContentTreeNode[] {
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

export function insertNodeInTree(
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

// ── Auto-populate input builders ─────────────────────────────────────

export function buildAutoPopulateInputs(
  chronicles: ChronicleRecord[],
  eraNarratives: EraNarrativeRecord[],
  entities: PersistedEntity[],
  staticPages: StaticPage[],
  eraOrderMap: Map<string, number>
) {
  const chronicleInput = chronicles
    .filter((c) => c.status === "complete" || c.status === "assembly_ready")
    .map((c) => ({
      chronicleId: c.chronicleId,
      title: c.title || "Untitled Chronicle",
      status: c.status,
      focalEraId: c.temporalContext?.focalEra?.id,
      focalEraName: c.temporalContext?.focalEra?.name,
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

  return {
    chronicles: chronicleInput,
    eraNarratives: narrativeInput,
    entities: entityInput,
    staticPages: pageInput,
    eraOrder: eraOrderMap,
  };
}

/** Check whether Body or Back Matter already has content */
export function treeHasExistingContent(treeState: ContentTreeState): boolean {
  const bodyNode = treeState.nodes.find((n) => n.name === "Body" && n.type === "folder");
  const backMatterNode = treeState.nodes.find(
    (n) => n.name === "Back Matter" && n.type === "folder"
  );
  return (
    (bodyNode?.children?.length ?? 0) > 0 ||
    (backMatterNode?.children?.some((c) => c.name === "Encyclopedia") ?? false)
  );
}

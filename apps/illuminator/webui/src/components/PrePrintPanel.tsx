/**
 * PrePrintPanel — Top-level panel for print preparation features.
 *
 * Three sub-tabs: Stats, Content Tree, Export.
 * Loads all data on mount for the sub-views to use.
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useEntityNavList } from "../lib/db/entitySelectors";
import type { PersistedEntity } from "../lib/db/illuminatorDb";
import type { ChronicleRecord } from "../lib/chronicleTypes";
import type { ImageMetadataRecord } from "../lib/preprint/prePrintStats";
import type { StaticPage } from "../lib/staticPageTypes";
import type { EraNarrativeRecord } from "../lib/eraNarrativeTypes";
import type { ContentTreeState } from "../lib/preprint/prePrintTypes";
import { getChroniclesForSimulation } from "../lib/db/chronicleRepository";
import { getAllImages } from "../lib/db/imageRepository";
import { getStaticPagesForProject } from "../lib/db/staticPageRepository";
import { loadTree, saveTree } from "../lib/db/contentTreeRepository";
import { getEntitiesForRun } from "../lib/db/entityRepository";
import { getEraNarrativesForSimulation } from "../lib/db/eraNarrativeRepository";
import StatsView from "./preprint/StatsView";
import ContentTreeView from "./preprint/ContentTreeView";
import ExportView from "./preprint/ExportView";
import "./PrePrintPanel.css";

type SubTab = "stats" | "tree" | "export";

function collectChronicleImageIds(
  chronicles: ChronicleRecord[],
  ids: Set<string>
): void {
  const publishable = chronicles.filter(
    (c) => c.status === "complete" || c.status === "assembly_ready"
  );
  for (const chronicle of publishable) {
    const coverId = chronicle.coverImage?.generatedImageId;
    if (coverId && chronicle.coverImage?.status === "complete") {
      ids.add(coverId);
    }
    if (!chronicle.imageRefs?.refs) continue;
    for (const ref of chronicle.imageRefs.refs) {
      if (ref.type === "prompt_request" && ref.status === "complete" && ref.generatedImageId) {
        ids.add(ref.generatedImageId);
      }
    }
  }
}

function collectEraNarrativeImageIds(
  eraNarratives: EraNarrativeRecord[],
  ids: Set<string>
): void {
  for (const narr of eraNarratives) {
    if (narr.coverImage?.status === "complete" && narr.coverImage.generatedImageId) {
      ids.add(narr.coverImage.generatedImageId);
    }
    if (!narr.imageRefs?.refs) continue;
    for (const ref of narr.imageRefs.refs) {
      if (ref.type === "chronicle_ref") {
        ids.add(ref.imageId);
      } else if (ref.type === "prompt_request" && ref.status === "complete" && ref.generatedImageId) {
        ids.add(ref.generatedImageId);
      }
    }
  }
}

function collectReferencedImageIds(
  navEntities: Array<{ imageId?: string }>,
  chronicles: ChronicleRecord[],
  eraNarratives: EraNarrativeRecord[]
): Set<string> {
  const ids = new Set<string>();
  for (const entity of navEntities) {
    if (entity.imageId) ids.add(entity.imageId);
  }
  collectChronicleImageIds(chronicles, ids);
  collectEraNarrativeImageIds(eraNarratives, ids);
  return ids;
}

interface PrePrintPanelProps {
  projectId: string;
  simulationRunId: string;
}

export default function PrePrintPanel({ projectId, simulationRunId }: Readonly<PrePrintPanelProps>) {
  const navEntities = useEntityNavList();
  const [activeSubTab, setActiveSubTab] = useState<SubTab>("stats");
  const [fullEntities, setFullEntities] = useState<PersistedEntity[]>([]);
  const [chronicles, setChronicles] = useState<ChronicleRecord[]>([]);
  const [allImages, setAllImages] = useState<ImageMetadataRecord[]>([]);
  const [staticPages, setStaticPages] = useState<StaticPage[]>([]);
  const [eraNarratives, setEraNarratives] = useState<EraNarrativeRecord[]>([]);
  const [treeState, setTreeState] = useState<ContentTreeState | null>(null);
  const hasIds = !!projectId && !!simulationRunId;
  const [loading, setLoading] = useState(hasIds);

  useEffect(() => {
    if (!projectId || !simulationRunId) return;

    let cancelled = false;

    void Promise.all([
      getChroniclesForSimulation(simulationRunId),
      getAllImages(),
      getStaticPagesForProject(projectId),
      loadTree(projectId, simulationRunId),
      getEntitiesForRun(simulationRunId),
      getEraNarrativesForSimulation(simulationRunId),
    ]).then(([chrons, allImgs, pages, tree, ents, narrs]) => {
      if (cancelled) return;
      setChronicles(chrons);
      // Keep project-scoped images; further filtering happens in memo below.
      setAllImages(allImgs.filter((img) => img.projectId === projectId));
      setStaticPages(pages);
      setTreeState(tree);
      setFullEntities(ents);
      setEraNarratives(narrs);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [projectId, simulationRunId]);

  const handleTreeChange = useCallback((newTree: ContentTreeState) => {
    setTreeState(newTree);
    void saveTree(newTree);
  }, []);

  // Era order map: eraId → sort index (by startTick)
  const eraOrderMap = useMemo(() => {
    const eraEntities = fullEntities.filter((e) => e.kind === "era" && e.temporal);
    const sorted = [...eraEntities].sort(
      (a, b) => (a.temporal?.startTick || 0) - (b.temporal?.startTick || 0)
    );
    const map = new Map<string, number>();
    sorted.forEach((era, index) => {
      const eraId = era.eraId || era.id;
      map.set(eraId, index);
    });
    return map;
  }, [fullEntities]);

  const images = useMemo(() => {
    if (allImages.length === 0) return [];
    const referencedIds = collectReferencedImageIds(navEntities, chronicles, eraNarratives);
    if (referencedIds.size === 0) return [];
    return allImages.filter((img) => referencedIds.has(img.imageId));
  }, [allImages, navEntities, chronicles, eraNarratives]);

  if (loading) {
    return (
      <div className="ppp-empty-state">
        Loading pre-print data...
      </div>
    );
  }

  if (!projectId || !simulationRunId) {
    return (
      <div className="ppp-empty-state">
        No active project. Load a simulation run to use pre-print features.
      </div>
    );
  }

  const subTabs: { id: SubTab; label: string }[] = [
    { id: "stats", label: "Stats" },
    { id: "tree", label: "Content Tree" },
    { id: "export", label: "Export" },
  ];

  return (
    <div className="preprint-panel">
      <div className="preprint-subtabs">
        {subTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`preprint-subtab ${activeSubTab === tab.id ? "active" : ""}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="preprint-content">
        {activeSubTab === "stats" && (
          <StatsView
            entities={fullEntities}
            chronicles={chronicles}
            images={images}
            staticPages={staticPages}
            eraNarratives={eraNarratives}
          />
        )}

        {activeSubTab === "tree" && (
          <ContentTreeView
            entities={fullEntities}
            chronicles={chronicles}
            staticPages={staticPages}
            eraNarratives={eraNarratives}
            eraOrderMap={eraOrderMap}
            treeState={treeState}
            projectId={projectId}
            simulationRunId={simulationRunId}
            onTreeChange={handleTreeChange}
          />
        )}

        {activeSubTab === "export" && (
          <ExportView
            entities={fullEntities}
            chronicles={chronicles}
            images={images}
            staticPages={staticPages}
            eraNarratives={eraNarratives}
            treeState={treeState}
            projectId={projectId}
            simulationRunId={simulationRunId}
          />
        )}
      </div>
    </div>
  );
}

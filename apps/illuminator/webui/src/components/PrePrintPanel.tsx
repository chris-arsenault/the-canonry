/**
 * PrePrintPanel — Top-level panel for print preparation features.
 *
 * Three sub-tabs: Stats, Content Tree, Export.
 * Loads all data on mount for the sub-views to use.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useEntityNavList } from '../lib/db/entitySelectors';
import type { PersistedEntity } from '../lib/db/illuminatorDb';
import type { ChronicleRecord } from '../lib/chronicleTypes';
import type { ImageMetadataRecord } from '../lib/preprint/prePrintStats';
import type { StaticPage } from '../lib/staticPageTypes';
import type { ContentTreeState } from '../lib/preprint/prePrintTypes';
import { getChroniclesForSimulation } from '../lib/db/chronicleRepository';
import { getAllImages } from '../lib/db/imageRepository';
import { getStaticPagesForProject } from '../lib/db/staticPageRepository';
import { loadTree, saveTree } from '../lib/db/contentTreeRepository';
import { getEntitiesForRun } from '../lib/db/entityRepository';
import StatsView from './preprint/StatsView';
import ContentTreeView from './preprint/ContentTreeView';
import ExportView from './preprint/ExportView';

type SubTab = 'stats' | 'tree' | 'export';

interface PrePrintPanelProps {
  projectId: string;
  simulationRunId: string;
}

export default function PrePrintPanel({ projectId, simulationRunId }: PrePrintPanelProps) {
  const navEntities = useEntityNavList();
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('stats');
  const [fullEntities, setFullEntities] = useState<PersistedEntity[]>([]);
  const [chronicles, setChronicles] = useState<ChronicleRecord[]>([]);
  const [allImages, setAllImages] = useState<ImageMetadataRecord[]>([]);
  const [staticPages, setStaticPages] = useState<StaticPage[]>([]);
  const [treeState, setTreeState] = useState<ContentTreeState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId || !simulationRunId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    Promise.all([
      getChroniclesForSimulation(simulationRunId),
      getAllImages(),
      getStaticPagesForProject(projectId),
      loadTree(projectId, simulationRunId),
      getEntitiesForRun(simulationRunId),
    ]).then(([chrons, allImgs, pages, tree, ents]) => {
      if (cancelled) return;
      setChronicles(chrons);
      // Keep project-scoped images; further filtering happens in memo below.
      setAllImages(allImgs.filter((img) => img.projectId === projectId));
      setStaticPages(pages);
      setTreeState(tree);
      setFullEntities(ents);
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [projectId, simulationRunId]);

  const handleTreeChange = useCallback(
    (newTree: ContentTreeState) => {
      setTreeState(newTree);
      saveTree(newTree);
    },
    []
  );

  const images = useMemo(() => {
    if (allImages.length === 0) return [];

    const referencedIds = new Set<string>();

    for (const entity of navEntities) {
      if (entity.imageId) referencedIds.add(entity.imageId);
    }

    const publishableChronicles = chronicles.filter(
      (c) => c.status === 'complete' || c.status === 'assembly_ready'
    );

    for (const chronicle of publishableChronicles) {
      const coverId = chronicle.coverImage?.generatedImageId;
      if (coverId && chronicle.coverImage?.status === 'complete') {
        referencedIds.add(coverId);
      }

      if (chronicle.imageRefs?.refs) {
        for (const ref of chronicle.imageRefs.refs) {
          if (ref.type === 'prompt_request' && ref.status === 'complete' && ref.generatedImageId) {
            referencedIds.add(ref.generatedImageId);
          }
        }
      }
    }

    if (referencedIds.size === 0) return [];
    return allImages.filter((img) => referencedIds.has(img.imageId));
  }, [allImages, navEntities, chronicles]);

  if (loading) {
    return (
      <div style={{ padding: 'var(--space-lg)', color: 'var(--text-secondary)' }}>
        Loading pre-print data...
      </div>
    );
  }

  if (!projectId || !simulationRunId) {
    return (
      <div style={{ padding: 'var(--space-lg)', color: 'var(--text-secondary)' }}>
        No active project. Load a simulation run to use pre-print features.
      </div>
    );
  }

  const subTabs: { id: SubTab; label: string }[] = [
    { id: 'stats', label: 'Stats' },
    { id: 'tree', label: 'Content Tree' },
    { id: 'export', label: 'Export' },
  ];

  return (
    <div className="preprint-panel">
      <div className="preprint-subtabs">
        {subTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`preprint-subtab ${activeSubTab === tab.id ? 'active' : ''}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="preprint-content">
        {activeSubTab === 'stats' && (
          <StatsView
            entities={fullEntities}
            chronicles={chronicles}
            images={images}
            staticPages={staticPages}
          />
        )}

        {activeSubTab === 'tree' && (
          <ContentTreeView
            entities={fullEntities}
            chronicles={chronicles}
            staticPages={staticPages}
            treeState={treeState}
            projectId={projectId}
            simulationRunId={simulationRunId}
            onTreeChange={handleTreeChange}
          />
        )}

        {activeSubTab === 'export' && (
          <ExportView
            entities={fullEntities}
            chronicles={chronicles}
            images={images}
            staticPages={staticPages}
            treeState={treeState}
            projectId={projectId}
            simulationRunId={simulationRunId}
          />
        )}
      </div>
    </div>
  );
}

/**
 * PrePrintPanel — Top-level panel for print preparation features.
 *
 * Three sub-tabs: Stats, Content Tree, Export.
 * Loads all data on mount for the sub-views to use.
 */

import { useState, useEffect, useCallback } from 'react';
import type { PersistedEntity } from '../lib/db/illuminatorDb';
import type { ChronicleRecord } from '../lib/chronicleTypes';
import type { ImageMetadataRecord } from '../lib/preprint/prePrintStats';
import type { StaticPage } from '../lib/staticPageTypes';
import type { ContentTreeState } from '../lib/preprint/prePrintTypes';
import { getChroniclesForSimulation } from '../lib/db/chronicleRepository';
import { getAllImages } from '../lib/db/imageRepository';
import { getStaticPagesForProject } from '../lib/db/staticPageRepository';
import { loadTree, saveTree } from '../lib/db/contentTreeRepository';
import StatsView from './preprint/StatsView';
import ContentTreeView from './preprint/ContentTreeView';
import ExportView from './preprint/ExportView';

type SubTab = 'stats' | 'tree' | 'export';

interface PrePrintPanelProps {
  entities: PersistedEntity[];
  projectId: string;
  simulationRunId: string;
}

export default function PrePrintPanel({ entities, projectId, simulationRunId }: PrePrintPanelProps) {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('stats');
  const [chronicles, setChronicles] = useState<ChronicleRecord[]>([]);
  const [images, setImages] = useState<ImageMetadataRecord[]>([]);
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
    ]).then(([chrons, allImgs, pages, tree]) => {
      if (cancelled) return;
      setChronicles(chrons);
      // Filter images to current project only
      setImages(allImgs.filter((img) => img.projectId === projectId));
      setStaticPages(pages);
      setTreeState(tree);
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
            entities={entities}
            chronicles={chronicles}
            images={images}
            staticPages={staticPages}
          />
        )}

        {activeSubTab === 'tree' && (
          <ContentTreeView
            entities={entities}
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
            entities={entities}
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

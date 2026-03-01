/**
 * useEntityBrowserDownloads - Download/export operations extracted from EntityBrowser
 */

import { useCallback } from "react";
import { useEntityStore } from "../../lib/db/entityStore";
import { prominenceLabelFromScale } from "@canonry/world-schema";
import type { ProminenceScale } from "@canonry/world-schema";
import type { QueueItem } from "../../lib/enrichmentTypes";

function downloadJson(data: unknown, filename: string): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function useEntityBrowserDownloads(
  selectedIds: Set<string>,
  queue: QueueItem[],
  prominenceScale: ProminenceScale
) {
  const downloadSelectedDebug = useCallback(async () => {
    const ids = Array.from(selectedIds);
    const fullEntities = await useEntityStore.getState().loadEntities(ids);
    const debugData: Record<string, unknown>[] = [];

    for (const entity of fullEntities) {
      const textEnrichment = entity.enrichment?.text;
      const chainDebug = textEnrichment?.chainDebug;
      let legacyDebug = textEnrichment?.debug;

      if (!chainDebug && !legacyDebug) {
        const qItem = queue.find(
          (item) => item.entityId === entity.id && item.type === "description" && item.debug
        );
        if (qItem?.debug) legacyDebug = qItem.debug;
      }

      if (chainDebug || legacyDebug) {
        const entry: Record<string, unknown> = {
          entityId: entity.id,
          entityName: entity.name,
          entityKind: entity.kind,
          timestamp: textEnrichment?.generatedAt,
          model: textEnrichment?.model,
          summary: entity.summary,
          description: entity.description,
          visualThesis: textEnrichment?.visualThesis,
          visualTraits: textEnrichment?.visualTraits,
          aliases: textEnrichment?.aliases,
        };
        if (chainDebug) entry.chainDebug = chainDebug;
        if (legacyDebug && !chainDebug) entry.legacyDebug = legacyDebug;
        debugData.push(entry);
      }
    }

    if (debugData.length === 0) {
      alert("No debug data available for selected entities.");
      return;
    }

    downloadJson(debugData, `entity-debug-${new Date().toISOString().split("T")[0]}.json`);
  }, [selectedIds, queue]);

  const downloadSelectedEditions = useCallback(async () => {
    const ids = Array.from(selectedIds);
    const fullEntities = await useEntityStore.getState().loadEntities(ids);
    const editionSources = new Set(["historian-edition", "legacy-copy-edit"]);
    const exportEntries: Record<string, unknown>[] = [];

    for (const entity of fullEntities) {
      const history = entity.enrichment?.descriptionHistory;
      if (!history || !entity.description) continue;

      const historianEntries = (history as Array<{ source?: string; description?: string }>)
        .map((entry, index) => ({ ...entry, historyIndex: index }))
        .filter((entry) => editionSources.has(entry.source || ""));

      if (historianEntries.length === 0) continue;

      const entry: Record<string, unknown> = {
        entityId: entity.id,
        entityName: entity.name,
        entityKind: entity.kind,
        prominence: entity.prominence,
        updatedAt: entity.updatedAt,
        preHistorian: historianEntries[0].description,
        legacyCopyEdit:
          historianEntries.length > 1
            ? historianEntries[historianEntries.length - 1].description
            : null,
        active: entity.description,
      };

      const activeNotes = (entity.enrichment?.historianNotes as Array<{
        display?: string;
        type?: string;
        anchorPhrase?: string;
        text?: string;
      }> | undefined)?.filter((n) => n.display !== "disabled");

      if (activeNotes && activeNotes.length > 0) {
        entry.annotations = activeNotes.map((n) => ({
          type: n.type,
          display: n.display || "full",
          anchorPhrase: n.anchorPhrase,
          text: n.text,
        }));
      }

      exportEntries.push(entry);
    }

    if (exportEntries.length === 0) {
      alert("No edition history available for selected entities.");
      return;
    }

    downloadJson(
      exportEntries,
      `edition-export-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.json`
    );
  }, [selectedIds]);

  const downloadSelectedAnnotations = useCallback(async () => {
    const ids = Array.from(selectedIds);
    const fullEntities = await useEntityStore.getState().loadEntities(ids);
    const rows: Record<string, unknown>[] = [];

    for (const entity of fullEntities) {
      const activeNotes = (entity.enrichment?.historianNotes as Array<{
        display?: string;
        type?: string;
        anchorPhrase?: string;
        text?: string;
      }> | undefined)?.filter((n) => n.display !== "disabled");

      if (!activeNotes || activeNotes.length === 0) continue;

      rows.push({
        entityName: entity.name,
        entityKind: entity.kind,
        entitySubtype: entity.subtype || null,
        prominence: prominenceLabelFromScale(entity.prominence, prominenceScale),
        noteCount: activeNotes.length,
        annotations: activeNotes.map((n) => ({
          type: n.type,
          display: n.display || "full",
          anchorPhrase: n.anchorPhrase,
          text: n.text,
        })),
      });
    }

    if (rows.length === 0) {
      alert("No annotations found for selected entities.");
      return;
    }

    const exportData = {
      exportedAt: new Date().toISOString(),
      totalEntities: rows.length,
      totalAnnotations: rows.reduce((sum, r) => sum + (r.noteCount as number), 0),
      entities: rows,
    };

    downloadJson(exportData, `entity-annotation-review-${Date.now()}.json`);
  }, [selectedIds, prominenceScale]);

  return {
    downloadSelectedDebug,
    downloadSelectedEditions,
    downloadSelectedAnnotations,
  };
}

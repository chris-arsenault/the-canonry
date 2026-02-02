/**
 * Illuminator Database — Dexie schema
 *
 * Single canonical store for ALL Illuminator persistence.
 * v1: entities + narrativeEvents (entity enrichment DAL)
 * v2: chronicles, images, costs, traits, run stores, static pages, styles
 */

import Dexie, { type Table } from 'dexie';
import type { WorldEntity, NarrativeEvent } from '@canonry/world-schema';
import type { EntityEnrichment } from '../enrichmentTypes';
import type { ChronicleRecord } from '../chronicleTypes';
import type { ImageRecord, ImageType, ImageAspect, ImageBlobRecord } from '../imageTypes';
import type { CostRecord, CostType, CostRecordInput, CostSummary } from '../costTypes';
import type { TraitPalette, UsedTraitRecord, PaletteItem, TraitGuidance } from '../traitTypes';
import type { HistorianRun } from '../historianTypes';
import type { SummaryRevisionRun } from '../summaryRevisionTypes';
import type { DynamicsRun } from '../dynamicsGenerationTypes';
import type { StaticPage, StaticPageStatus } from '../staticPageTypes';
import type { StyleLibrary } from '@canonry/world-schema';
import type { ContentTreeState } from '../preprint/prePrintTypes';

// ---------------------------------------------------------------------------
// Types — entities + events (v1)
// ---------------------------------------------------------------------------

/**
 * Full entity record stored in Dexie.
 * Extends WorldEntity with the enrichment sub-object that Illuminator manages.
 */
export interface PersistedEntity extends WorldEntity {
  /** Scoped to simulation run — entities are meaningless across runs */
  simulationRunId: string;
  /** Illuminator-managed enrichment data */
  enrichment?: EntityEnrichment;
}

/**
 * Full narrative event record stored in Dexie.
 * Extends NarrativeEvent with simulationRunId for scoping.
 */
export interface PersistedNarrativeEvent extends NarrativeEvent {
  simulationRunId: string;
}

// ---------------------------------------------------------------------------
// Types — style library (v2)
// ---------------------------------------------------------------------------

export interface StyleLibraryRecord {
  id: string;
  library: StyleLibrary;
  savedAt: number;
}

// ---------------------------------------------------------------------------
// Re-exports for repository consumers
// ---------------------------------------------------------------------------

export type {
  ChronicleRecord,
  ImageRecord, ImageType, ImageAspect, ImageBlobRecord,
  CostRecord, CostType, CostRecordInput, CostSummary,
  TraitPalette, UsedTraitRecord, PaletteItem, TraitGuidance,
  HistorianRun,
  SummaryRevisionRun,
  DynamicsRun,
  StaticPage, StaticPageStatus,
  StyleLibrary,
  StyleLibraryRecord,
  ContentTreeState,
};

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------

class IlluminatorDatabase extends Dexie {
  entities!: Table<PersistedEntity, string>;
  narrativeEvents!: Table<PersistedNarrativeEvent, string>;
  chronicles!: Table<ChronicleRecord, string>;
  images!: Table<ImageRecord, string>;
  imageBlobs!: Table<ImageBlobRecord, string>;
  costs!: Table<CostRecord, string>;
  traitPalettes!: Table<TraitPalette, string>;
  usedTraits!: Table<UsedTraitRecord, string>;
  historianRuns!: Table<HistorianRun, string>;
  summaryRevisionRuns!: Table<SummaryRevisionRun, string>;
  dynamicsRuns!: Table<DynamicsRun, string>;
  staticPages!: Table<StaticPage, string>;
  styleLibrary!: Table<StyleLibraryRecord, string>;
  contentTrees!: Table<ContentTreeState, [string, string]>;

  constructor() {
    super('illuminator');

    // v1 — entity enrichment DAL
    this.version(1).stores({
      entities: 'id, simulationRunId, kind, [simulationRunId+kind]',
      narrativeEvents: 'id, simulationRunId',
    });

    // v2 — consolidate all remaining IndexedDB stores
    this.version(2).stores({
      // Existing (unchanged — Dexie requires re-declaring them)
      entities: 'id, simulationRunId, kind, [simulationRunId+kind]',
      narrativeEvents: 'id, simulationRunId',

      // Chronicles (from canonry-chronicles)
      chronicles: 'chronicleId, simulationRunId, projectId',

      // Images (from canonry-images)
      images: 'imageId, projectId, entityId, chronicleId, entityKind, entityCulture, model, imageType, generatedAt',

      // Costs (from canonry-costs)
      costs: 'id, projectId, simulationRunId, entityId, chronicleId, type, model, timestamp',

      // Trait palettes + usage (from canonry-traits)
      traitPalettes: 'id, projectId, entityKind',
      usedTraits: 'id, projectId, simulationRunId, entityKind, entityId',

      // Run stores (from canonry-historian, canonry-summary-revision, canonry-dynamics-generation)
      historianRuns: 'runId, projectId, status, createdAt',
      summaryRevisionRuns: 'runId, projectId, status, createdAt',
      dynamicsRuns: 'runId, projectId, status, createdAt',

      // Static pages (from canonry-static-pages)
      staticPages: 'pageId, projectId, slug, status, updatedAt',

      // Style library (from illuminator-styles)
      styleLibrary: 'id',
    });

    // v3 — split image blobs into separate table for fast metadata queries
    this.version(3)
      .stores({
        // All existing tables (must redeclare)
        entities: 'id, simulationRunId, kind, [simulationRunId+kind]',
        narrativeEvents: 'id, simulationRunId',
        chronicles: 'chronicleId, simulationRunId, projectId',
        images: 'imageId, projectId, entityId, chronicleId, entityKind, entityCulture, model, imageType, generatedAt',
        costs: 'id, projectId, simulationRunId, entityId, chronicleId, type, model, timestamp',
        traitPalettes: 'id, projectId, entityKind',
        usedTraits: 'id, projectId, simulationRunId, entityKind, entityId',
        historianRuns: 'runId, projectId, status, createdAt',
        summaryRevisionRuns: 'runId, projectId, status, createdAt',
        dynamicsRuns: 'runId, projectId, status, createdAt',
        staticPages: 'pageId, projectId, slug, status, updatedAt',
        styleLibrary: 'id',

        // New: blob-only table for image binary data
        imageBlobs: 'imageId',
      })
      .upgrade(async (tx) => {
        console.log('[IlluminatorDB] v3 upgrade: splitting image blobs into separate table...');
        const imagesTable = tx.table('images');
        const blobsTable = tx.table('imageBlobs');

        const allImages = await imagesTable.toArray();
        let migrated = 0;

        for (const record of allImages) {
          if (record.blob) {
            await blobsTable.put({ imageId: record.imageId, blob: record.blob });
            migrated++;
          }
        }

        // Clear blobs from images table
        await imagesTable.toCollection().modify((record: any) => {
          delete record.blob;
        });

        console.log(`[IlluminatorDB] v3 upgrade complete: ${migrated}/${allImages.length} blobs migrated`);
      });

    // v4 — content tree for pre-print ordering
    this.version(4).stores({
      // All existing tables (must redeclare)
      entities: 'id, simulationRunId, kind, [simulationRunId+kind]',
      narrativeEvents: 'id, simulationRunId',
      chronicles: 'chronicleId, simulationRunId, projectId',
      images: 'imageId, projectId, entityId, chronicleId, entityKind, entityCulture, model, imageType, generatedAt',
      costs: 'id, projectId, simulationRunId, entityId, chronicleId, type, model, timestamp',
      traitPalettes: 'id, projectId, entityKind',
      usedTraits: 'id, projectId, simulationRunId, entityKind, entityId',
      historianRuns: 'runId, projectId, status, createdAt',
      summaryRevisionRuns: 'runId, projectId, status, createdAt',
      dynamicsRuns: 'runId, projectId, status, createdAt',
      staticPages: 'pageId, projectId, slug, status, updatedAt',
      styleLibrary: 'id',
      imageBlobs: 'imageId',

      // New: content tree for pre-print book structure
      contentTrees: '[projectId+simulationRunId]',
    });
  }
}

export const db = new IlluminatorDatabase();

// When another connection (e.g. a new page load) needs to upgrade the schema,
// close THIS connection so the upgrade isn't blocked. This is critical in
// workers (service worker, shared worker) which persist across page navigations
// and would otherwise block schema upgrades indefinitely.
db.on('versionchange', () => {
  console.log('[IlluminatorDB] Version change detected, closing connection for upgrade');
  db.close();
});

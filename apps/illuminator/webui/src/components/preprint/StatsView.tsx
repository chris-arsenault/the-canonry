/**
 * StatsView — Pre-print statistics dashboard
 *
 * Displays word counts, image inventory, completeness checks, and historian
 * note statistics. Calculated on-demand via button click.
 */

import { useState, useCallback } from 'react';
import type { PrePrintStats } from '../../lib/preprint/prePrintTypes';
import type { PersistedEntity } from '../../lib/db/illuminatorDb';
import type { ChronicleRecord } from '../../lib/chronicleTypes';
import type { StaticPage } from '../../lib/staticPageTypes';
import { computePrePrintStats, type ImageMetadataRecord } from '../../lib/preprint/prePrintStats';

interface StatsViewProps {
  entities: PersistedEntity[];
  chronicles: ChronicleRecord[];
  images: ImageMetadataRecord[];
  staticPages: StaticPage[];
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function pct(part: number, total: number): string {
  if (total === 0) return '—';
  return `${Math.round((part / total) * 100)}%`;
}

export default function StatsView({ entities, chronicles, images, staticPages }: StatsViewProps) {
  const [stats, setStats] = useState<PrePrintStats | null>(null);
  const [calculating, setCalculating] = useState(false);

  const handleCalculate = useCallback(() => {
    setCalculating(true);
    // Use setTimeout to allow UI to show spinner before computation blocks
    setTimeout(() => {
      const result = computePrePrintStats(entities, chronicles, images, staticPages);
      setStats(result);
      setCalculating(false);
    }, 50);
  }, [entities, chronicles, images, staticPages]);

  if (!stats) {
    return (
      <div className="preprint-stats-empty">
        <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-md)' }}>
          Calculate statistics for print preparation. This scans all entities, chronicles,
          images, and static pages to produce word counts, image inventory, and completeness checks.
        </p>
        <button
          className="preprint-action-button"
          onClick={handleCalculate}
          disabled={calculating}
        >
          {calculating ? 'Calculating...' : 'Calculate Stats'}
        </button>
      </div>
    );
  }

  const wb = stats.wordBreakdown;
  const cb = stats.charBreakdown;
  const img = stats.images;
  const comp = stats.completeness;
  const hn = stats.historianNotes;

  return (
    <div className="preprint-stats">
      <div className="preprint-stats-header">
        <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
          Calculated {new Date(stats.calculatedAt).toLocaleString()}
        </span>
        <button
          className="preprint-action-button small"
          onClick={handleCalculate}
          disabled={calculating}
        >
          {calculating ? 'Recalculating...' : 'Recalculate'}
        </button>
      </div>

      {/* Page Estimate */}
      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">Page Estimate</h2>
        </div>
        <div className="preprint-stats-hero">
          <div className="preprint-stats-hero-number">{stats.estimatedPages.toLocaleString()}</div>
          <div className="preprint-stats-hero-label">estimated pages (250 words/page)</div>
        </div>
        <div className="preprint-stats-row total">
          <span>Total words</span>
          <span className="preprint-stats-value">{stats.totalWords.toLocaleString()}</span>
        </div>
        <div className="preprint-stats-row total">
          <span>Total characters</span>
          <span className="preprint-stats-value">{stats.totalChars.toLocaleString()}</span>
        </div>
      </div>

      {/* Word Count Breakdown */}
      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">Word & Character Counts</h2>
        </div>
        <div className="preprint-stats-table">
          <div className="preprint-stats-table-header">
            <span>Content Type</span>
            <span>Words</span>
            <span>Chars</span>
            <span>% of Total</span>
          </div>
          <WordRow label="Chronicle body text" words={wb.chronicleBody} chars={cb.chronicleBody} total={stats.totalWords} />
          <WordRow label="Chronicle summaries" words={wb.chronicleSummaries} chars={cb.chronicleSummaries} total={stats.totalWords} />
          <WordRow label="Entity descriptions" words={wb.entityDescriptions} chars={cb.entityDescriptions} total={stats.totalWords} />
          <WordRow label="Entity summaries" words={wb.entitySummaries} chars={cb.entitySummaries} total={stats.totalWords} />
          <WordRow label="Image captions" words={wb.imageCaptions} chars={cb.imageCaptions} total={stats.totalWords} />
          <WordRow label="Historian notes" words={wb.historianNotes} chars={cb.historianNotes} total={stats.totalWords} />
          <WordRow label="Static page content" words={wb.staticPageContent} chars={cb.staticPageContent} total={stats.totalWords} />
        </div>
      </div>

      {/* Image Inventory */}
      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">Image Inventory</h2>
        </div>
        <div className="preprint-stats-row total">
          <span>Total images</span>
          <span className="preprint-stats-value">{img.total}</span>
        </div>
        <div className="preprint-stats-row">
          <span>Total storage</span>
          <span className="preprint-stats-value">{formatBytes(img.totalStorageBytes)}</span>
        </div>

        <div className="preprint-stats-subsection">By Orientation</div>
        <div className="preprint-stats-row">
          <span>Portrait</span>
          <span className="preprint-stats-value">{img.byAspect.portrait} ({pct(img.byAspect.portrait, img.total)})</span>
        </div>
        <div className="preprint-stats-row">
          <span>Landscape</span>
          <span className="preprint-stats-value">{img.byAspect.landscape} ({pct(img.byAspect.landscape, img.total)})</span>
        </div>
        <div className="preprint-stats-row">
          <span>Square</span>
          <span className="preprint-stats-value">{img.byAspect.square} ({pct(img.byAspect.square, img.total)})</span>
        </div>

        <div className="preprint-stats-subsection">By Type</div>
        <div className="preprint-stats-row">
          <span>Entity portraits</span>
          <span className="preprint-stats-value">{img.byType.entity}</span>
        </div>
        <div className="preprint-stats-row">
          <span>Chronicle scenes</span>
          <span className="preprint-stats-value">{img.byType.chronicle}</span>
        </div>
        <div className="preprint-stats-row">
          <span>Cover images</span>
          <span className="preprint-stats-value">{img.byType.cover}</span>
        </div>

        <div className="preprint-stats-subsection">By Size Designation</div>
        <div className="preprint-stats-row">
          <span>Small (inline)</span>
          <span className="preprint-stats-value">{img.bySize.small}</span>
        </div>
        <div className="preprint-stats-row">
          <span>Medium (half-page)</span>
          <span className="preprint-stats-value">{img.bySize.medium}</span>
        </div>
        <div className="preprint-stats-row">
          <span>Large (3/4 page)</span>
          <span className="preprint-stats-value">{img.bySize.large}</span>
        </div>
        <div className="preprint-stats-row">
          <span>Full-width</span>
          <span className="preprint-stats-value">{img.bySize['full-width']}</span>
        </div>

        {img.dimensionRange && (
          <>
            <div className="preprint-stats-subsection">Dimensions (pixels)</div>
            <div className="preprint-stats-row">
              <span>Width range</span>
              <span className="preprint-stats-value">{img.dimensionRange.minWidth} – {img.dimensionRange.maxWidth}px</span>
            </div>
            <div className="preprint-stats-row">
              <span>Height range</span>
              <span className="preprint-stats-value">{img.dimensionRange.minHeight} – {img.dimensionRange.maxHeight}px</span>
            </div>
          </>
        )}
      </div>

      {/* Completeness */}
      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">Completeness</h2>
        </div>
        <CompletenessRow label="Entities with description" count={comp.entitiesWithDescription} total={comp.entitiesTotal} />
        <CompletenessRow label="Entities with image" count={comp.entitiesWithImage} total={comp.entitiesTotal} />
        <CompletenessRow label="Entities with summary" count={comp.entitiesWithSummary} total={comp.entitiesTotal} />
        <CompletenessRow label="Chronicles published" count={comp.chroniclesPublished} total={comp.chroniclesTotal} />
        <CompletenessRow label="Chronicles with historian notes" count={comp.chroniclesWithHistorianNotes} total={comp.chroniclesTotal} />
        <CompletenessRow label="Chronicles with scene images" count={comp.chroniclesWithSceneImages} total={comp.chroniclesTotal} />
        <CompletenessRow label="Static pages published" count={comp.staticPagesPublished} total={comp.staticPagesTotal} />
      </div>

      {/* Historian Notes */}
      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">Historian Notes</h2>
        </div>
        <div className="preprint-stats-row total">
          <span>Total notes</span>
          <span className="preprint-stats-value">{hn.total}</span>
        </div>
        <div className="preprint-stats-row">
          <span>On entities</span>
          <span className="preprint-stats-value">{hn.onEntities}</span>
        </div>
        <div className="preprint-stats-row">
          <span>On chronicles</span>
          <span className="preprint-stats-value">{hn.onChronicles}</span>
        </div>

        <div className="preprint-stats-subsection">By Type</div>
        <div className="preprint-stats-row">
          <span>Commentary</span>
          <span className="preprint-stats-value">{hn.byType.commentary}</span>
        </div>
        <div className="preprint-stats-row">
          <span>Correction</span>
          <span className="preprint-stats-value">{hn.byType.correction}</span>
        </div>
        <div className="preprint-stats-row">
          <span>Tangent</span>
          <span className="preprint-stats-value">{hn.byType.tangent}</span>
        </div>
        <div className="preprint-stats-row">
          <span>Skepticism</span>
          <span className="preprint-stats-value">{hn.byType.skepticism}</span>
        </div>
        <div className="preprint-stats-row">
          <span>Pedantic</span>
          <span className="preprint-stats-value">{hn.byType.pedantic}</span>
        </div>
      </div>
    </div>
  );
}

function WordRow({ label, words, chars, total }: { label: string; words: number; chars: number; total: number }) {
  return (
    <div className="preprint-stats-table-row">
      <span>{label}</span>
      <span className="preprint-stats-value">{words.toLocaleString()}</span>
      <span className="preprint-stats-value">{chars.toLocaleString()}</span>
      <span className="preprint-stats-value">{pct(words, total)}</span>
    </div>
  );
}

function CompletenessRow({ label, count, total }: { label: string; count: number; total: number }) {
  const complete = total > 0 && count === total;
  const partial = total > 0 && count > 0 && count < total;
  const missing = total > 0 && count === 0;

  return (
    <div className="preprint-stats-row">
      <span>
        <span
          className="preprint-completeness-dot"
          style={{ color: complete ? '#22c55e' : partial ? '#f59e0b' : missing ? '#ef4444' : 'var(--text-secondary)' }}
          title={complete ? 'Complete' : partial ? 'Partial' : 'Missing'}
        >
          {complete ? '\u25CF' : partial ? '\u25D2' : '\u25CB'}
        </span>
        {' '}{label}
      </span>
      <span className="preprint-stats-value">{count}/{total}</span>
    </div>
  );
}

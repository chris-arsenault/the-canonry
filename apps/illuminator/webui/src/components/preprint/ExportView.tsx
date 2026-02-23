/**
 * ExportView — Export for print preparation.
 *
 * Supports two formats:
 * - Markdown ZIP: folder hierarchy of .md files with YAML frontmatter
 * - InDesign IDML: native InDesign document package with pages,
 *   paragraph/character styles, and Smart Text Reflow
 */

import { useState, useCallback, useMemo } from 'react';
import type { PersistedEntity } from '../../lib/db/illuminatorDb';
import type { ChronicleRecord } from '../../lib/chronicleTypes';
import type { ImageMetadataRecord } from '../../lib/preprint/prePrintStats';
import type { StaticPage } from '../../lib/staticPageTypes';
import type { EraNarrativeRecord } from '../../lib/eraNarrativeTypes';
import type { ContentTreeState, S3ExportConfig, ExportFormat } from '../../lib/preprint/prePrintTypes';
import { buildExportZip, buildInDesignExportZip, buildIdmlImageScript } from '../../lib/preprint/markdownExport';

interface ExportViewProps {
  entities: PersistedEntity[];
  chronicles: ChronicleRecord[];
  images: ImageMetadataRecord[];
  staticPages: StaticPage[];
  eraNarratives: EraNarrativeRecord[];
  treeState: ContentTreeState | null;
  projectId: string;
  simulationRunId: string;
}

const FORMAT_DESCRIPTIONS: Record<ExportFormat, string> = {
  markdown:
    'Exports the content tree as a ZIP file containing markdown files in the folder hierarchy ' +
    'you defined. Each entity, chronicle, era narrative, and static page becomes a markdown file with YAML ' +
    'frontmatter. Includes a manifest.json with full metadata and a download-images.sh script ' +
    'for pulling images from S3.',
  indesign:
    'Exports a single .idml file \u2014 InDesign\u2019s native interchange format. Double-click or File \u2192 Open ' +
    'to get a complete 6\u00d79\u2033 document with one story per entry, 4 master spreads, inline footnotes, ' +
    'callout boxes, and linked image placeholders. Paragraph and character styles come pre-loaded ' +
    'with typographic defaults (Junicode) \u2014 override them in your Styles panels to match your design.',
};

const FORMAT_CONTENTS: Record<ExportFormat, { label: string; description: string }[]> = {
  markdown: [
    { label: 'manifest.json', description: 'Full metadata: stats, tree structure, image inventory' },
    { label: 'Folder hierarchy', description: 'Matching your content tree structure' },
    { label: 'Markdown files', description: 'YAML frontmatter + formatted content + historian notes' },
  ],
  indesign: [
    { label: 'One Story per entry', description: 'Each entity, chronicle, era narrative gets its own Story \u2014 reorder or delete entries independently' },
    { label: '4 master spreads', description: 'A-Story, B-Document, C-Narrative, D-Encyclopedia \u2014 override per content type' },
    { label: 'Inline footnotes', description: 'Minor historian notes as footnotes at anchor positions' },
    { label: 'Callout boxes', description: 'Major historian notes as separate text frames' },
    { label: 'Linked images', description: 'Image placeholders linked to images/ \u2014 use the Download Image Script button to pull from S3' },
  ],
};

export default function ExportView({
  entities,
  chronicles,
  images,
  staticPages,
  eraNarratives,
  treeState,
  projectId,
  simulationRunId,
}: ExportViewProps) {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('markdown');

  // Read S3 config from localStorage (set by Canonry AWS panel)
  const s3Config = useMemo<S3ExportConfig | null>(() => {
    try {
      const raw = localStorage.getItem('canonry.aws.config');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed.bucket || !parsed.basePrefix) return null;
      return {
        bucket: parsed.bucket,
        basePrefix: parsed.basePrefix,
        rawPrefix: parsed.rawPrefix || 'raw',
        region: parsed.region || 'us-east-1',
      };
    } catch {
      return null;
    }
  }, []);

  const handleExport = useCallback(async () => {
    if (!treeState) return;

    setExporting(true);
    setError(null);

    try {
      const exportOptions = {
        treeState,
        entities,
        chronicles,
        images,
        staticPages,
        eraNarratives,
        projectId,
        simulationRunId,
        s3Config,
      };

      const blob = exportFormat === 'indesign'
        ? await buildInDesignExportZip(exportOptions)
        : await buildExportZip(exportOptions);

      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = exportFormat === 'indesign'
        ? `preprint-${timestamp}.idml`
        : `preprint-markdown-${timestamp}.zip`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  }, [treeState, entities, chronicles, images, staticPages, eraNarratives, projectId, simulationRunId, s3Config, exportFormat]);

  const handleDownloadScript = useCallback(() => {
    const script = buildIdmlImageScript({
      treeState: treeState!,
      entities,
      chronicles,
      images,
      staticPages,
      eraNarratives,
      projectId,
      simulationRunId,
      s3Config,
    });
    if (!script) return;

    const blob = new Blob([script], { type: 'text/x-shellscript' });
    const timestamp = new Date().toISOString().slice(0, 10);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `download-images-${timestamp}.sh`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [treeState, entities, chronicles, images, staticPages, eraNarratives, projectId, simulationRunId, s3Config]);

  if (!treeState) {
    return (
      <div style={{ padding: 'var(--space-lg)', color: 'var(--text-secondary)' }}>
        Create a content tree first (Content Tree tab) before exporting.
      </div>
    );
  }

  const s3Contents = s3Config
    ? [
        { label: 's3-config.json', description: 'S3 bucket and prefix configuration' },
        { label: 'download-images.sh', description: 'Bash script to pull images from S3 (requires aws CLI + jq)' },
      ]
    : [];

  return (
    <div className="preprint-export">
      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">Export Format</h2>
        </div>

        <div className="preprint-export-format-selector">
          <label
            className={`preprint-export-format-option${exportFormat === 'markdown' ? ' active' : ''}`}
          >
            <input
              type="radio"
              name="exportFormat"
              value="markdown"
              checked={exportFormat === 'markdown'}
              onChange={() => setExportFormat('markdown')}
            />
            <div className="preprint-export-format-label">
              <strong>Markdown ZIP</strong>
              <span>Folder hierarchy of .md files with YAML frontmatter</span>
            </div>
          </label>
          <label
            className={`preprint-export-format-option${exportFormat === 'indesign' ? ' active' : ''}`}
          >
            <input
              type="radio"
              name="exportFormat"
              value="indesign"
              checked={exportFormat === 'indesign'}
              onChange={() => setExportFormat('indesign')}
            />
            <div className="preprint-export-format-label">
              <strong>InDesign IDML</strong>
              <span>Native InDesign document with pages and styles</span>
            </div>
          </label>
        </div>

        <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-md)', lineHeight: 1.5, marginTop: 'var(--space-md)' }}>
          {FORMAT_DESCRIPTIONS[exportFormat]}
        </p>

        <div className="preprint-export-config">
          <div className="preprint-stats-subsection">S3 Configuration</div>
          {s3Config ? (
            <>
              <div className="preprint-stats-row">
                <span>Bucket</span>
                <span className="preprint-stats-value">{s3Config.bucket}</span>
              </div>
              <div className="preprint-stats-row">
                <span>Base prefix</span>
                <span className="preprint-stats-value">{s3Config.basePrefix}</span>
              </div>
              <div className="preprint-stats-row">
                <span>Region</span>
                <span className="preprint-stats-value">{s3Config.region}</span>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', marginTop: 'var(--space-xs)' }}>
                The download script will use these settings. Configure via the AWS button in the sidebar.
              </p>
            </>
          ) : (
            <p style={{ color: '#f59e0b', marginBottom: 'var(--space-sm)' }}>
              S3 not configured. Export will still work but {exportFormat === 'indesign'
                ? 'the image download script will be unavailable'
                : 'the download-images.sh script will be omitted'}.
              Configure S3 via the AWS button in the Canonry sidebar.
            </p>
          )}
        </div>

        {error && (
          <div style={{ color: '#ef4444', marginBottom: 'var(--space-md)', padding: 'var(--space-sm)', background: 'rgba(239,68,68,0.1)', borderRadius: '4px' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
          <button
            className="preprint-action-button"
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting
              ? 'Exporting...'
              : exportFormat === 'indesign'
                ? 'Export IDML'
                : 'Export Markdown ZIP'}
          </button>
          {exportFormat === 'indesign' && s3Config && (
            <button
              className="preprint-action-button"
              onClick={handleDownloadScript}
              disabled={exporting}
              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
            >
              Download Image Script
            </button>
          )}
        </div>
      </div>

      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">Export Contents</h2>
        </div>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          {exportFormat === 'indesign' ? 'The IDML file includes:' : 'The ZIP will contain:'}
        </p>
        <ul style={{ color: 'var(--text-secondary)', lineHeight: 1.8, paddingLeft: 'var(--space-lg)' }}>
          {FORMAT_CONTENTS[exportFormat].map((item) => (
            <li key={item.label}><strong>{item.label}</strong> — {item.description}</li>
          ))}
          {exportFormat === 'markdown' && s3Contents.map((item) => (
            <li key={item.label}><strong>{item.label}</strong> — {item.description}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

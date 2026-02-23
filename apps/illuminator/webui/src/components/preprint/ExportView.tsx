/**
 * ExportView — Export for print preparation.
 *
 * Supports two formats:
 * - Markdown ZIP: folder hierarchy of .md files with YAML frontmatter
 * - InDesign ICML: single .icml file with all content in tree order,
 *   carrying paragraph and character styles with typographic properties
 */

import { useState, useCallback, useMemo } from 'react';
import type { PersistedEntity } from '../../lib/db/illuminatorDb';
import type { ChronicleRecord } from '../../lib/chronicleTypes';
import type { ImageMetadataRecord } from '../../lib/preprint/prePrintStats';
import type { StaticPage } from '../../lib/staticPageTypes';
import type { EraNarrativeRecord } from '../../lib/eraNarrativeTypes';
import type { ContentTreeState, S3ExportConfig, ExportFormat } from '../../lib/preprint/prePrintTypes';
import { buildExportZip, buildInDesignExportZip } from '../../lib/preprint/markdownExport';

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
    'Exports an ICML file with the full book content plus a setup-book.jsx script. ' +
    'Unzip, then run the script from InDesign (File \u2192 Scripts \u2192 Browse). ' +
    'It creates a 6\u00d79\u2033 document with Smart Text Reflow, places the ICML, and auto-generates ' +
    'all pages. Paragraph and character styles import with typographic defaults (Minion Pro) \u2014 ' +
    'override them to match your design.',
};

const FORMAT_CONTENTS: Record<ExportFormat, { label: string; description: string }[]> = {
  markdown: [
    { label: 'manifest.json', description: 'Full metadata: stats, tree structure, image inventory' },
    { label: 'Folder hierarchy', description: 'Matching your content tree structure' },
    { label: 'Markdown files', description: 'YAML frontmatter + formatted content + historian notes' },
  ],
  indesign: [
    { label: 'setup-book.jsx', description: 'InDesign script \u2014 run this to create the document and auto-place content with pages' },
    { label: 'book.icml', description: 'Single ICML with all content, styled paragraph/character ranges' },
    { label: 'manifest.json', description: 'Full metadata: stats, tree structure, image inventory' },
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

      const suffix = exportFormat === 'indesign' ? 'indesign' : 'markdown';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `preprint-${suffix}-${new Date().toISOString().slice(0, 10)}.zip`;
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
              <strong>InDesign ICML</strong>
              <span>Single styled file for Adobe InDesign</span>
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
              S3 not configured. Export will still work but the download-images.sh script will be omitted.
              Configure S3 via the AWS button in the Canonry sidebar.
            </p>
          )}
        </div>

        {error && (
          <div style={{ color: '#ef4444', marginBottom: 'var(--space-md)', padding: 'var(--space-sm)', background: 'rgba(239,68,68,0.1)', borderRadius: '4px' }}>
            {error}
          </div>
        )}

        <button
          className="preprint-action-button"
          onClick={handleExport}
          disabled={exporting}
        >
          {exporting
            ? 'Exporting...'
            : exportFormat === 'indesign'
              ? 'Export ICML Package'
              : 'Export Markdown ZIP'}
        </button>
      </div>

      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">Export Contents</h2>
        </div>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          The ZIP will contain:
        </p>
        <ul style={{ color: 'var(--text-secondary)', lineHeight: 1.8, paddingLeft: 'var(--space-lg)' }}>
          {FORMAT_CONTENTS[exportFormat].map((item) => (
            <li key={item.label}><strong>{item.label}</strong> — {item.description}</li>
          ))}
          {s3Contents.map((item) => (
            <li key={item.label}><strong>{item.label}</strong> — {item.description}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/**
 * ExportView — Markdown ZIP export for print preparation.
 *
 * Exports the content tree as a folder hierarchy of markdown files,
 * plus a manifest.json and download-images.sh script.
 */

import { useState, useCallback, useMemo } from 'react';
import type { PersistedEntity } from '../../lib/db/illuminatorDb';
import type { ChronicleRecord } from '../../lib/chronicleTypes';
import type { ImageMetadataRecord } from '../../lib/preprint/prePrintStats';
import type { StaticPage } from '../../lib/staticPageTypes';
import type { ContentTreeState, S3ExportConfig } from '../../lib/preprint/prePrintTypes';
import { buildExportZip } from '../../lib/preprint/markdownExport';

interface ExportViewProps {
  entities: PersistedEntity[];
  chronicles: ChronicleRecord[];
  images: ImageMetadataRecord[];
  staticPages: StaticPage[];
  treeState: ContentTreeState | null;
  projectId: string;
  simulationRunId: string;
}

export default function ExportView({
  entities,
  chronicles,
  images,
  staticPages,
  treeState,
  projectId,
  simulationRunId,
}: ExportViewProps) {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      const blob = await buildExportZip({
        treeState,
        entities,
        chronicles,
        images,
        staticPages,
        projectId,
        simulationRunId,
        s3Config,
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `preprint-export-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  }, [treeState, entities, chronicles, images, staticPages, projectId, simulationRunId, s3Config]);

  if (!treeState) {
    return (
      <div style={{ padding: 'var(--space-lg)', color: 'var(--text-secondary)' }}>
        Create a content tree first (Content Tree tab) before exporting.
      </div>
    );
  }

  return (
    <div className="preprint-export">
      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">Export to Markdown</h2>
        </div>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-md)', lineHeight: 1.5 }}>
          Exports the content tree as a ZIP file containing markdown files in the folder hierarchy
          you defined. Each entity, chronicle, and static page becomes a markdown file with YAML
          frontmatter. Includes a manifest.json with full metadata and a download-images.sh script
          for pulling images from S3.
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
          {exporting ? 'Exporting...' : 'Export ZIP'}
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
          <li><strong>manifest.json</strong> — Full metadata: stats, tree structure, image inventory</li>
          {s3Config && <li><strong>s3-config.json</strong> — S3 bucket and prefix configuration</li>}
          {s3Config && <li><strong>download-images.sh</strong> — Bash script to pull images from S3 (requires aws CLI + jq)</li>}
          <li><strong>Folder hierarchy</strong> — Matching your content tree structure</li>
          <li><strong>Markdown files</strong> — YAML frontmatter + formatted content + historian notes</li>
        </ul>
      </div>
    </div>
  );
}

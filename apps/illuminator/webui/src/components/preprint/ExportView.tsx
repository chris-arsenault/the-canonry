/**
 * ExportView — Export for print preparation.
 *
 * Supports two formats:
 * - Markdown ZIP: folder hierarchy of .md files with YAML frontmatter
 * - InDesign IDML: native InDesign document package with pages,
 *   paragraph/character styles, and Smart Text Reflow
 */

import React, { useState, useCallback, useMemo } from "react";
import { useAsyncAction } from "../../hooks/useAsyncAction";
import type { PersistedEntity } from "../../lib/db/illuminatorDb";
import type { ChronicleRecord } from "../../lib/chronicleTypes";
import type { ImageMetadataRecord } from "../../lib/preprint/prePrintStats";
import type { StaticPage } from "../../lib/staticPageTypes";
import type { EraNarrativeRecord } from "../../lib/eraNarrativeTypes";
import type {
  ContentTreeState,
  S3ExportConfig,
  ExportFormat,
  IdmlLayoutOptions,
} from "../../lib/preprint/prePrintTypes";
import {
  IDML_PAGE_PRESETS,
  IDML_FONT_PRESETS,
  DEFAULT_IDML_LAYOUT,
} from "../../lib/preprint/prePrintTypes";
import {
  buildExportZip,
  buildInDesignExportZip,
  buildIdmlImageScript,
} from "../../lib/preprint/markdownExport";
import { ErrorMessage } from "@the-canonry/shared-components";
import {
  readS3ExportInfo,
  triggerBlobDownload,
  isFontPreset,
  extractErrorMessage,
} from "./exportViewHelpers";
import "./ExportView.css";

// ── Constants ────────────────────────────────────────────────────────

const FORMAT_DESCRIPTIONS: Record<ExportFormat, string> = {
  markdown:
    "Exports the content tree as a ZIP file containing markdown files in the folder hierarchy " +
    "you defined. Each entity, chronicle, era narrative, and static page becomes a markdown file with YAML " +
    "frontmatter. Includes a manifest.json with full metadata and a download-images.sh script " +
    "for pulling images from S3.",
  indesign:
    "Exports a single .idml file \u2014 InDesign\u2019s native interchange format. Double-click or File \u2192 Open " +
    "to get a complete document with one story per entry, 4 master spreads, inline footnotes, " +
    "callout boxes, and linked image placeholders. Configure page size, font, and spacing below.",
};

const FORMAT_CONTENTS: Record<ExportFormat, { label: string; description: string }[]> = {
  markdown: [
    { label: "manifest.json", description: "Full metadata: stats, tree structure, image inventory" },
    { label: "Folder hierarchy", description: "Matching your content tree structure" },
    { label: "Markdown files", description: "YAML frontmatter + formatted content + historian notes" },
  ],
  indesign: [
    { label: "One Story per entry", description: "Each entity, chronicle, era narrative gets its own Story \u2014 reorder or delete entries independently" },
    { label: "4 master spreads", description: "A-Story, B-Document, C-Narrative, D-Encyclopedia \u2014 override per content type" },
    { label: "Inline footnotes", description: "Minor historian notes as footnotes at anchor positions" },
    { label: "Callout boxes", description: "Major historian notes as separate text frames" },
    { label: "Linked images", description: "Image placeholders linked to images/ \u2014 use the Download Image Script button to pull from S3" },
  ],
};

const S3_CONTENTS = [
  { label: "s3-config.json", description: "S3 bucket and prefix configuration" },
  { label: "download-images.sh", description: "Bash script to pull images from S3 (requires aws CLI + jq)" },
];

// ── Sub-components ───────────────────────────────────────────────────

interface IdmlLayoutPanelProps {
  idmlLayout: IdmlLayoutOptions;
  setIdmlLayout: React.Dispatch<React.SetStateAction<IdmlLayoutOptions>>;
  customFont: string;
  setCustomFont: React.Dispatch<React.SetStateAction<string>>;
}

function IdmlLayoutPanel({
  idmlLayout,
  setIdmlLayout,
  customFont,
  setCustomFont,
}: Readonly<IdmlLayoutPanelProps>) {
  const isPresetFont = isFontPreset(idmlLayout.fontFamily, IDML_FONT_PRESETS);

  return (
    <div className="preprint-export-config">
      <div className="preprint-stats-subsection">Layout Options</div>

      <div className="preprint-stats-row">
        <span>Page Size</span>
        <select className="preprint-export-select" value={idmlLayout.pagePreset} onChange={(e) => setIdmlLayout((prev) => ({ ...prev, pagePreset: e.target.value }))}>
          {Object.entries(IDML_PAGE_PRESETS).map(([key, preset]) => (
            <option key={key} value={key}>{preset.label}</option>
          ))}
        </select>
      </div>

      <div className="preprint-stats-row">
        <span>Font</span>
        <select
          className="preprint-export-select"
          value={isPresetFont ? idmlLayout.fontFamily : "__custom__"}
          onChange={(e) => {
            if (e.target.value === "__custom__") {
              setIdmlLayout((prev) => ({ ...prev, fontFamily: customFont || "Junicode" }));
            } else {
              setIdmlLayout((prev) => ({ ...prev, fontFamily: e.target.value }));
            }
          }}
        >
          {IDML_FONT_PRESETS.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
          <option value="__custom__">Custom...</option>
        </select>
      </div>

      {!isPresetFont && (
        <div className="preprint-stats-row">
          <span>Custom Font</span>
          <input
            type="text"
            className="preprint-export-input"
            value={customFont}
            placeholder="Font family name"
            onChange={(e) => {
              setCustomFont(e.target.value);
              if (e.target.value) {
                setIdmlLayout((prev) => ({ ...prev, fontFamily: e.target.value }));
              }
            }}
          />
        </div>
      )}

      <div className="preprint-stats-row">
        <span>Body Size</span>
        <select className="preprint-export-select" value={idmlLayout.bodySize} onChange={(e) => setIdmlLayout((prev) => ({ ...prev, bodySize: Number(e.target.value) }))}>
          {[9, 10, 11, 12, 13, 14].map((s) => (
            <option key={s} value={s}>{s}pt</option>
          ))}
        </select>
      </div>

      <div className="preprint-stats-row">
        <span>Leading</span>
        <select className="preprint-export-select" value={idmlLayout.bodyLeading} onChange={(e) => setIdmlLayout((prev) => ({ ...prev, bodyLeading: Number(e.target.value) }))}>
          {[11, 12, 13, 14, 15, 16, 18].map((l) => (
            <option key={l} value={l}>{l}pt</option>
          ))}
        </select>
      </div>

      <div className="preprint-stats-row">
        <span>Columns</span>
        <select className="preprint-export-select" value={idmlLayout.columnCount} onChange={(e) => setIdmlLayout((prev) => ({ ...prev, columnCount: Number(e.target.value) }))}>
          <option value={1}>1</option>
          <option value={2}>2</option>
        </select>
      </div>

      {idmlLayout.columnCount === 2 && (
        <div className="preprint-stats-row">
          <span>Column Gutter</span>
          <select className="preprint-export-select" value={idmlLayout.columnGutter} onChange={(e) => setIdmlLayout((prev) => ({ ...prev, columnGutter: Number(e.target.value) }))}>
            {[12, 18, 24].map((g) => (
              <option key={g} value={g}>{g}pt</option>
            ))}
          </select>
        </div>
      )}

      <div className="preprint-stats-row">
        <span>Paragraph Spacing</span>
        <select className="preprint-export-select" value={idmlLayout.paragraphSpacing} onChange={(e) => setIdmlLayout((prev) => ({ ...prev, paragraphSpacing: Number(e.target.value) }))}>
          <option value={0.75}>Tight</option>
          <option value={1.0}>Normal</option>
          <option value={1.25}>Relaxed</option>
          <option value={1.5}>Spacious</option>
        </select>
      </div>
    </div>
  );
}

interface S3InfoPanelProps {
  s3: S3ExportConfig | null;
  exportFormat: ExportFormat;
}

function S3InfoPanel({ s3, exportFormat }: Readonly<S3InfoPanelProps>) {
  return (
    <div className="preprint-export-config">
      <div className="preprint-stats-subsection">S3 Configuration</div>
      {s3 ? (
        <>
          <div className="preprint-stats-row"><span>Bucket</span><span className="preprint-stats-value">{s3.bucket}</span></div>
          <div className="preprint-stats-row"><span>Base prefix</span><span className="preprint-stats-value">{s3.basePrefix}</span></div>
          <div className="preprint-stats-row"><span>Region</span><span className="preprint-stats-value">{s3.region}</span></div>
          <p className="ev-s3-hint">The download script will use these settings. Configure via the AWS button in the sidebar.</p>
        </>
      ) : (
        <p className="ev-s3-warning">
          S3 not configured. Export will still work but{" "}
          {exportFormat === "indesign" ? "the image download script will be unavailable" : "the download-images.sh script will be omitted"}.
          {" "}Configure S3 via the AWS button in the Canonry sidebar.
        </p>
      )}
    </div>
  );
}

// ── Props ────────────────────────────────────────────────────────────

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

// ── Main component ───────────────────────────────────────────────────

export default function ExportView({
  entities,
  chronicles,
  images,
  staticPages,
  eraNarratives,
  treeState,
  projectId,
  simulationRunId,
}: Readonly<ExportViewProps>) {
  const [exporting, setExporting] = useState(false);
  const { error: exportError, setError: setExportError } = useAsyncAction();
  const [exportFormat, setExportFormat] = useState<ExportFormat>("markdown");
  const [idmlLayout, setIdmlLayout] = useState<IdmlLayoutOptions>({ ...DEFAULT_IDML_LAYOUT });
  const [customFont, setCustomFont] = useState("");

  const s3 = useMemo<S3ExportConfig | null>(readS3ExportInfo, []);

  const handleExport = useCallback(async () => {
    if (!treeState) return;
    setExporting(true);
    setExportError(null);

    try {
      const exportOpts = { treeState, entities, chronicles, images, staticPages, eraNarratives, projectId, simulationRunId, s3Config: s3, idmlLayout };
      const blob = exportFormat === "indesign"
        ? await buildInDesignExportZip(exportOpts)
        : await buildExportZip(exportOpts);
      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = exportFormat === "indesign" ? `preprint-${timestamp}.idml` : `preprint-markdown-${timestamp}.zip`;
      triggerBlobDownload(blob, filename);
    } catch (err: unknown) {
      setExportError(extractErrorMessage(err));
    } finally {
      setExporting(false);
    }
  }, [treeState, entities, chronicles, images, staticPages, eraNarratives, projectId, simulationRunId, s3, exportFormat, idmlLayout]);

  const handleDownloadScript = useCallback(() => {
    const script = buildIdmlImageScript({ treeState, entities, chronicles, images, staticPages, eraNarratives, projectId, simulationRunId, s3Config: s3 });
    if (!script) return;
    const timestamp = new Date().toISOString().slice(0, 10);
    triggerBlobDownload(new Blob([script], { type: "text/x-shellscript" }), `download-images-${timestamp}.sh`);
  }, [treeState, entities, chronicles, images, staticPages, eraNarratives, projectId, simulationRunId, s3]);

  if (!treeState) {
    return <div className="ev-empty-msg">Create a content tree first (Content Tree tab) before exporting.</div>;
  }

  const exportButtonLabel = exporting
    ? "Exporting..."
    : exportFormat === "indesign"
      ? "Export IDML"
      : "Export Markdown ZIP";

  return (
    <div className="preprint-export">
      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">Export Format</h2>
        </div>

        <div className="preprint-export-format-selector">
          <label className={`preprint-export-format-option${exportFormat === "markdown" ? " active" : ""}`}>
            <input type="radio" name="exportFormat" value="markdown" checked={exportFormat === "markdown"} onChange={() => setExportFormat("markdown")} />
            <div className="preprint-export-format-label"><strong>Markdown ZIP</strong><span>Folder hierarchy of .md files with YAML frontmatter</span></div>
          </label>
          <label className={`preprint-export-format-option${exportFormat === "indesign" ? " active" : ""}`}>
            <input type="radio" name="exportFormat" value="indesign" checked={exportFormat === "indesign"} onChange={() => setExportFormat("indesign")} />
            <div className="preprint-export-format-label"><strong>InDesign IDML</strong><span>Native InDesign document with pages and styles</span></div>
          </label>
        </div>

        <p className="ev-format-desc">{FORMAT_DESCRIPTIONS[exportFormat]}</p>

        {exportFormat === "indesign" && (
          <IdmlLayoutPanel idmlLayout={idmlLayout} setIdmlLayout={setIdmlLayout} customFont={customFont} setCustomFont={setCustomFont} />
        )}

        <S3InfoPanel s3={s3} exportFormat={exportFormat} />

        {exportError && <ErrorMessage message={exportError} className="ev-error" />}

        <div className="ev-actions">
          <button className="preprint-action-button" onClick={() => void handleExport()} disabled={exporting}>{exportButtonLabel}</button>
          {exportFormat === "indesign" && s3 && (
            <button className="preprint-action-button ev-script-btn" onClick={handleDownloadScript} disabled={exporting}>Download Image Script</button>
          )}
        </div>
      </div>

      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">Export Contents</h2>
        </div>
        <p className="ev-contents-desc">{exportFormat === "indesign" ? "The IDML file includes:" : "The ZIP will contain:"}</p>
        <ul className="ev-contents-list">
          {FORMAT_CONTENTS[exportFormat].map((item) => (
            <li key={item.label}><strong>{item.label}</strong> — {item.description}</li>
          ))}
          {exportFormat === "markdown" && s3 && S3_CONTENTS.map((item) => (
            <li key={item.label}><strong>{item.label}</strong> — {item.description}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

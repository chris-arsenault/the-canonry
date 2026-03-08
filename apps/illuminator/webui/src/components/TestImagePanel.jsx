/**
 * TestImagePanel — Send prompts to the image API with toggleable prompt sections.
 *
 * Lets you isolate which prompt parameter causes image degradation by
 * toggling individual sections on/off: Claude reformat, artistic style,
 * composition, color palette, visual identity.
 *
 * Supports entity selection to auto-build the full composite prompt using
 * the same buildPrompt() pipeline as the entity browser.
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import PropTypes from "prop-types";
import { getEnqueue } from "../lib/db/enrichmentQueueBridge";
import { useEnrichmentQueueStore } from "../lib/db/enrichmentQueueStore";
import { useIlluminatorConfigStore } from "../lib/db/illuminatorConfigStore";
import { loadImage, getImageBlob } from "../lib/db/imageRepository";
import { IMAGE_MODELS, IMAGE_ASPECTS } from "../lib/imageSettings";
import { useEntityNavList } from "../lib/db/entitySelectors";
import { useEntityStore } from "../lib/db/entityStore";
import ImageModal from "./ImageModal";
import "./TestImagePanel.css";

const TEST_ENTITY_PREFIX = "__test_img_";

/**
 * Look up style fragments from the style library using imageGenSettings IDs.
 */
function resolveFragments(styleLibrary, imageGenSettings) {
  if (!styleLibrary || !imageGenSettings) return {};

  const artistic = (styleLibrary.artisticStyles || []).find(
    (s) => s.id === imageGenSettings.artisticStyleId
  );
  const composition = (styleLibrary.compositionStyles || []).find(
    (s) => s.id === imageGenSettings.compositionStyleId
  );
  const palette = (styleLibrary.colorPalettes || []).find(
    (p) => p.id === imageGenSettings.colorPaletteId
  );

  return {
    artisticName: artistic?.name,
    artisticFragment: artistic?.promptFragment,
    artisticNegative: artistic?.negativePrompt,
    artistExemplar: artistic?.artistExemplar,
    compositionName: composition?.name,
    compositionFragment: composition?.promptFragment,
    paletteName: palette?.name,
    paletteFragment: palette?.promptFragment,
  };
}

/**
 * Format visual identity entries for prompt injection.
 */
function formatVisualIdentity(cultureIdentities, cultureName) {
  if (!cultureIdentities || !cultureName) return null;
  const identity = cultureIdentities[cultureName];
  if (!identity?.visualIdentity) return null;
  const entries = Object.entries(identity.visualIdentity).filter(
    ([, v]) => v && typeof v === "string"
  );
  if (entries.length === 0) return null;
  return entries.map(([k, v]) => `- ${k}: ${v}`).join("\n");
}

/**
 * Build the composite prompt from base text + toggled sections.
 */
function buildCompositePrompt(basePrompt, toggles, fragments, visualIdentityText) {
  const parts = [basePrompt.trim()];

  if (toggles.style && fragments.artisticFragment) {
    const exemplar = fragments.artistExemplar ? ` [Artist exemplar: ${fragments.artistExemplar}]` : "";
    parts.push(`\nSTYLE: ${fragments.artisticFragment}${exemplar}`);
  }
  if (toggles.palette && fragments.paletteFragment) {
    parts.push(`\nCOLOR PALETTE: ${fragments.paletteFragment}`);
  }
  if (toggles.composition && fragments.compositionFragment) {
    parts.push(`\nCOMPOSITION: ${fragments.compositionFragment}`);
  }
  if (toggles.identity && visualIdentityText) {
    parts.push(`\nCULTURAL VISUAL IDENTITY:\n${visualIdentityText}`);
  }

  // Negatives go last (only if style is toggled and has negatives)
  if (toggles.style && fragments.artisticNegative) {
    parts.push(`\nAVOID: ${fragments.artisticNegative}`);
  }

  return parts.join("\n");
}

/**
 * Build a ZIP file from completed test results and trigger download.
 * Uses JSZip-free approach: manually construct a ZIP with stored (uncompressed) entries.
 *
 * Each result becomes an image file; all prompts go into a single prompts.json.
 */
async function exportTestResults(results) {
  const completed = results.filter((r) => r.status === "complete" && r.imageId);
  if (completed.length === 0) return;

  const files = [];
  const prompts = [];

  for (let i = 0; i < completed.length; i++) {
    const r = completed[i];
    const idx = String(i + 1).padStart(2, "0");
    const label = (r.toggles && r.toggles.length > 0)
      ? r.toggles.join("_")
      : "raw";

    // Image blob
    const blob = await getImageBlob(r.imageId);
    let filename = null;
    if (blob) {
      const ext = blob.type?.includes("png") ? "png" : "jpg";
      filename = `${idx}_${label}.${ext}`;
      files.push({ name: filename, blob });
    }

    // Load image record for reformatted prompt
    const img = await loadImage(r.imageId);

    prompts.push({
      file: filename,
      inputPrompt: r.basePrompt || r.prompt,
      compositePrompt: r.prompt,
      reformattedPrompt: img?.finalPrompt || null,
      model: r.model,
      aspect: r.aspect,
      dimensions: r.width && r.height ? `${r.width}x${r.height}` : null,
      toggles: r.toggles?.length ? r.toggles : [],
      generatedAt: new Date(r.createdAt).toISOString(),
    });

    // Revoke the URL loadImage created
    if (img?.url) URL.revokeObjectURL(img.url);
  }

  // Add prompts.json
  const json = JSON.stringify(prompts, null, 2);
  files.push({ name: "prompts.json", blob: new Blob([json], { type: "application/json" }) });

  const zipBlob = await buildZip(files);

  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `test-images-${Date.now()}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Build a ZIP file from an array of { name: string, blob: Blob }.
 * Uses stored (no compression) entries — simple and fast.
 */
async function buildZip(files) {
  const entries = [];
  for (const file of files) {
    const data = new Uint8Array(await file.blob.arrayBuffer());
    entries.push({ name: file.name, data });
  }

  // Calculate sizes
  let offset = 0;
  const centralDir = [];

  const parts = [];
  for (const entry of entries) {
    const nameBytes = new TextEncoder().encode(entry.name);
    const localHeader = new ArrayBuffer(30 + nameBytes.length);
    const lv = new DataView(localHeader);

    // Local file header
    lv.setUint32(0, 0x04034b50, true); // signature
    lv.setUint16(4, 20, true); // version needed
    lv.setUint16(6, 0, true); // flags
    lv.setUint16(8, 0, true); // compression: stored
    lv.setUint16(10, 0, true); // mod time
    lv.setUint16(12, 0, true); // mod date
    lv.setUint32(14, crc32(entry.data), true); // crc32
    lv.setUint32(18, entry.data.length, true); // compressed size
    lv.setUint32(22, entry.data.length, true); // uncompressed size
    lv.setUint16(26, nameBytes.length, true); // name length
    lv.setUint16(28, 0, true); // extra length
    new Uint8Array(localHeader).set(nameBytes, 30);

    parts.push(new Uint8Array(localHeader));
    parts.push(entry.data);

    // Central directory entry
    const cdEntry = new ArrayBuffer(46 + nameBytes.length);
    const cv = new DataView(cdEntry);
    cv.setUint32(0, 0x02014b50, true); // signature
    cv.setUint16(4, 20, true); // version made by
    cv.setUint16(6, 20, true); // version needed
    cv.setUint16(8, 0, true); // flags
    cv.setUint16(10, 0, true); // compression
    cv.setUint16(12, 0, true); // mod time
    cv.setUint16(14, 0, true); // mod date
    cv.setUint32(16, crc32(entry.data), true); // crc32
    cv.setUint32(20, entry.data.length, true); // compressed size
    cv.setUint32(24, entry.data.length, true); // uncompressed size
    cv.setUint16(28, nameBytes.length, true); // name length
    cv.setUint16(30, 0, true); // extra length
    cv.setUint16(32, 0, true); // comment length
    cv.setUint16(34, 0, true); // disk number start
    cv.setUint16(36, 0, true); // internal attributes
    cv.setUint32(38, 0, true); // external attributes
    cv.setUint32(42, offset, true); // local header offset
    new Uint8Array(cdEntry).set(nameBytes, 46);

    centralDir.push(new Uint8Array(cdEntry));
    offset += 30 + nameBytes.length + entry.data.length;
  }

  const cdOffset = offset;
  let cdSize = 0;
  for (const cd of centralDir) {
    parts.push(cd);
    cdSize += cd.length;
  }

  // End of central directory
  const eocd = new ArrayBuffer(22);
  const ev = new DataView(eocd);
  ev.setUint32(0, 0x06054b50, true); // signature
  ev.setUint16(4, 0, true); // disk number
  ev.setUint16(6, 0, true); // disk with CD
  ev.setUint16(8, entries.length, true); // entries on disk
  ev.setUint16(10, entries.length, true); // total entries
  ev.setUint32(12, cdSize, true); // CD size
  ev.setUint32(16, cdOffset, true); // CD offset
  ev.setUint16(20, 0, true); // comment length
  parts.push(new Uint8Array(eocd));

  return new Blob(parts, { type: "application/zip" });
}

/**
 * CRC32 for ZIP file entries.
 */
function crc32(data) {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Entity search dropdown with type-ahead filtering.
 */
function EntitySearchDropdown({ onSelect, selectedEntity, onClear }) {
  const navList = useEntityNavList();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return navList.slice(0, 20);
    const q = query.toLowerCase();
    return navList
      .filter((e) =>
        e.name.toLowerCase().includes(q) ||
        e.kind.toLowerCase().includes(q) ||
        e.subtype.toLowerCase().includes(q) ||
        (e.aliases || []).some((a) => a.toLowerCase().includes(q))
      )
      .slice(0, 20);
  }, [navList, query]);

  const handleSelect = useCallback(
    (entity) => {
      onSelect(entity);
      setQuery("");
      setOpen(false);
    },
    [onSelect]
  );

  if (selectedEntity) {
    return (
      <div className="tip-entity-selected">
        <span className="tip-entity-name">{selectedEntity.name}</span>
        <span className="tip-entity-kind">{selectedEntity.subtype} {selectedEntity.kind}</span>
        <button className="tip-entity-clear" onClick={onClear} title="Clear entity selection">x</button>
      </div>
    );
  }

  return (
    <div className="tip-entity-search">
      <input
        ref={inputRef}
        className="tip-entity-input"
        type="text"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        placeholder="Search entity..."
      />
      {open && filtered.length > 0 && (
        <div className="tip-entity-dropdown">
          {filtered.map((e) => (
            <div
              key={e.id}
              className="tip-entity-option"
              onMouseDown={() => handleSelect(e)}
            >
              <span className="tip-entity-option-name">{e.name}</span>
              <span className="tip-entity-option-meta">{e.subtype} {e.kind} ({e.culture})</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

EntitySearchDropdown.propTypes = {
  onSelect: PropTypes.func.isRequired,
  selectedEntity: PropTypes.object,
  onClear: PropTypes.func.isRequired,
};

export default function TestImagePanel({
  globalModel,
  globalAspect,
  styleLibrary,
  imageGenSettings,
  buildPrompt,
}) {
  const [prompt, setPrompt] = useState("");
  const [results, setResults] = useState([]);
  const [imageModal, setImageModal] = useState({ open: false, imageId: "", title: "" });
  const [exporting, setExporting] = useState(false);
  const pendingEntityIdsRef = useRef(new Set());

  // Entity selection
  const [selectedNavEntity, setSelectedNavEntity] = useState(null);

  // Prompt section toggles
  const [toggles, setToggles] = useState({
    reformat: false,
    style: false,
    composition: false,
    palette: false,
    identity: false,
  });

  // Culture selection for visual identity (manual mode only)
  const [selectedCulture, setSelectedCulture] = useState("");

  // Local aspect override ("" = use global)
  const [localAspect, setLocalAspect] = useState("");

  const activeModel = globalModel || "dall-e-3";
  const activeAspect = localAspect || globalAspect || "auto";

  const cultureIdentities = useIlluminatorConfigStore((s) => s.cultureIdentities);

  const fragments = useMemo(
    () => resolveFragments(styleLibrary, imageGenSettings),
    [styleLibrary, imageGenSettings]
  );

  const availableCultures = useMemo(() => {
    if (!cultureIdentities || typeof cultureIdentities !== "object") return [];
    return Object.keys(cultureIdentities).filter(
      (k) => cultureIdentities[k]?.visualIdentity
    );
  }, [cultureIdentities]);

  const visualIdentityText = useMemo(
    () => formatVisualIdentity(cultureIdentities, selectedCulture),
    [cultureIdentities, selectedCulture]
  );

  const queue = useEnrichmentQueueStore((s) => s.queue);
  const completedCount = results.filter((r) => r.status === "complete" && r.imageId).length;

  const handleEntitySelect = useCallback((navEntity) => {
    setSelectedNavEntity(navEntity);
  }, []);

  const handleEntityClear = useCallback(() => {
    setSelectedNavEntity(null);
  }, []);

  // Watch queue for test image task updates
  useEffect(() => {
    for (const item of queue) {
      if (!item.entityId.startsWith(TEST_ENTITY_PREFIX)) continue;
      if (!pendingEntityIdsRef.current.has(item.entityId)) continue;

      if (item.status === "complete" && item.result?.imageId) {
        const entityId = item.entityId;
        pendingEntityIdsRef.current.delete(entityId);

        loadImage(item.result.imageId).then((img) => {
          setResults((prev) =>
            prev.map((r) =>
              r.entityId === entityId
                ? {
                    ...r,
                    status: "complete",
                    imageId: item.result.imageId,
                    url: img?.url || null,
                    width: item.result.width,
                    height: item.result.height,
                  }
                : r
            )
          );
        });
      } else if (item.status === "error") {
        pendingEntityIdsRef.current.delete(item.entityId);
        setResults((prev) =>
          prev.map((r) =>
            r.entityId === item.entityId
              ? { ...r, status: "error", error: item.error || "Unknown error" }
              : r
          )
        );
      } else if (item.status === "running") {
        setResults((prev) =>
          prev.map((r) =>
            r.entityId === item.entityId && r.status === "queued"
              ? { ...r, status: "running" }
              : r
          )
        );
      }
    }
  }, [queue]);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      for (const r of results) {
        if (r.url) URL.revokeObjectURL(r.url);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGenerate = useCallback(async () => {
    const isEntityMode = !!selectedNavEntity;

    if (isEntityMode) {
      // Entity mode: load full entity, build prompt via standard pipeline, enqueue
      const fullEntity = await useEntityStore.getState().loadEntity(selectedNavEntity.id);
      if (!fullEntity || !buildPrompt) return;

      const builtPrompt = buildPrompt(fullEntity, "image");
      const entityId = `${TEST_ENTITY_PREFIX}${Date.now()}`;
      pendingEntityIdsRef.current.add(entityId);

      setResults((prev) => [
        {
          entityId,
          prompt: builtPrompt,
          basePrompt: selectedNavEntity.name,
          toggles: ["entity"],
          model: activeModel,
          aspect: activeAspect,
          status: "queued",
          imageId: null,
          url: null,
          error: null,
          createdAt: Date.now(),
        },
        ...prev,
      ]);

      const enqueue = getEnqueue();
      enqueue([
        {
          entity: { ...fullEntity, id: entityId },
          type: "image",
          prompt: builtPrompt,
          imageSize: activeAspect,
          imageType: "entity",
        },
      ]);
    } else {
      // Manual mode: composite prompt from textarea + toggled sections
      if (!prompt.trim()) return;

      const compositePrompt = buildCompositePrompt(prompt, toggles, fragments, visualIdentityText);
      const entityId = `${TEST_ENTITY_PREFIX}${Date.now()}`;
      pendingEntityIdsRef.current.add(entityId);

      const activeToggles = Object.entries(toggles).filter(([, v]) => v).map(([k]) => k);

      setResults((prev) => [
        {
          entityId,
          prompt: compositePrompt,
          basePrompt: prompt.trim(),
          toggles: activeToggles,
          model: activeModel,
          aspect: activeAspect,
          status: "queued",
          imageId: null,
          url: null,
          error: null,
          createdAt: Date.now(),
        },
        ...prev,
      ]);

      const enqueue = getEnqueue();
      enqueue([
        {
          entity: {
            id: entityId,
            name: "Test Image",
            kind: "test",
            subtype: "",
            prominence: "recognized",
            culture: "",
            status: "active",
            description: "",
            tags: {},
          },
          type: "image",
          prompt: compositePrompt,
          skipPromptFormatting: !toggles.reformat,
          imageSize: activeAspect,
          imageType: "entity",
        },
      ]);
    }
  }, [selectedNavEntity, buildPrompt, prompt, toggles, fragments, visualIdentityText, activeModel, activeAspect]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      await exportTestResults(results);
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExporting(false);
    }
  }, [results]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleGenerate();
      }
    },
    [handleGenerate]
  );

  const toggleField = useCallback((field) => {
    setToggles((prev) => ({ ...prev, [field]: !prev[field] }));
  }, []);

  const modelLabel = IMAGE_MODELS.find((m) => m.value === activeModel)?.label || activeModel;
  const isEntityMode = !!selectedNavEntity;

  return (
    <div className="tip-container">
      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">Test Image</h2>
        </div>
        <p className="ilu-hint">
          Toggle prompt sections on/off to isolate which parameter degrades image quality.
          Select an entity to use the full prompt pipeline.
        </p>

        <div className="tip-controls">
          {/* Entity search */}
          <div className="tip-entity-row">
            <span className="tip-label">Entity</span>
            <EntitySearchDropdown
              onSelect={handleEntitySelect}
              selectedEntity={selectedNavEntity}
              onClear={handleEntityClear}
            />
          </div>

          {/* Manual mode: textarea + section toggles */}
          {!isEntityMode && (
            <>
              <textarea
                className="tip-prompt-area"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="A penguin holding a hammer on a bright red background"
              />

              <div className="tip-toggles">
                <label className="tip-toggle" title="Run through Claude reformatter (Flux template)">
                  <input
                    type="checkbox"
                    checked={toggles.reformat}
                    onChange={() => toggleField("reformat")}
                  />
                  <span>Reformat</span>
                </label>

                <label
                  className="tip-toggle"
                  title={fragments.artisticFragment || "No artistic style selected"}
                >
                  <input
                    type="checkbox"
                    checked={toggles.style}
                    onChange={() => toggleField("style")}
                    disabled={!fragments.artisticFragment}
                  />
                  <span>Style</span>
                  {fragments.artisticName && (
                    <span className="tip-toggle-detail">{fragments.artisticName}</span>
                  )}
                </label>

                <label
                  className="tip-toggle"
                  title={fragments.compositionFragment || "No composition selected"}
                >
                  <input
                    type="checkbox"
                    checked={toggles.composition}
                    onChange={() => toggleField("composition")}
                    disabled={!fragments.compositionFragment}
                  />
                  <span>Composition</span>
                  {fragments.compositionName && (
                    <span className="tip-toggle-detail">{fragments.compositionName}</span>
                  )}
                </label>

                <label
                  className="tip-toggle"
                  title={fragments.paletteFragment || "No palette selected"}
                >
                  <input
                    type="checkbox"
                    checked={toggles.palette}
                    onChange={() => toggleField("palette")}
                    disabled={!fragments.paletteFragment}
                  />
                  <span>Palette</span>
                  {fragments.paletteName && (
                    <span className="tip-toggle-detail">{fragments.paletteName}</span>
                  )}
                </label>

                <label
                  className="tip-toggle"
                  title="Append culture visual identity to prompt"
                >
                  <input
                    type="checkbox"
                    checked={toggles.identity}
                    onChange={() => toggleField("identity")}
                    disabled={availableCultures.length === 0}
                  />
                  <span>Visual Identity</span>
                  {toggles.identity && availableCultures.length > 0 && (
                    <select
                      className="tip-culture-select"
                      value={selectedCulture}
                      onChange={(e) => setSelectedCulture(e.target.value)}
                    >
                      <option value="">Pick culture...</option>
                      {availableCultures.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  )}
                </label>
              </div>
            </>
          )}

          {/* Entity mode: uses full prompt pipeline, no manual controls needed */}
          {isEntityMode && (
            <span className="tip-hint">
              Uses the same prompt pipeline as entity browser — style, palette, composition, identity, thesis all included.
            </span>
          )}

          <div className="tip-settings-row">
            <span className="tip-label">Model</span>
            <span className="tip-hint">{modelLabel} (change via Image Settings)</span>
          </div>

          <div className="tip-settings-row">
            <span className="tip-label">Aspect</span>
            <div className="tip-aspect-buttons">
              <button
                className="tip-aspect-btn"
                data-selected={!localAspect}
                onClick={() => setLocalAspect("")}
              >
                Global
              </button>
              {IMAGE_ASPECTS.map((a) => (
                <button
                  key={a.value}
                  className="tip-aspect-btn"
                  data-selected={localAspect === a.value}
                  onClick={() => setLocalAspect(a.value)}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          <div className="tip-generate-row">
            <button
              className="tip-generate-btn"
              onClick={handleGenerate}
              disabled={isEntityMode ? !buildPrompt : !prompt.trim()}
            >
              Generate
            </button>
            {completedCount > 0 && (
              <button
                className="tip-export-btn"
                onClick={handleExport}
                disabled={exporting}
              >
                {exporting ? "Exporting..." : `Export ${completedCount} as ZIP`}
              </button>
            )}
            <span className="tip-hint">Ctrl+Enter to send</span>
          </div>
        </div>
      </div>

      <div className="tip-results">
        {results.length === 0 && (
          <div className="tip-empty">No test images yet. Enter a prompt and hit Generate.</div>
        )}
        {results.map((r) => (
          <div key={r.entityId} className="tip-result-card" data-status={r.status}>
            <div className="tip-result-image">
              {r.status === "complete" && r.url ? (
                <img
                  src={r.url}
                  alt={r.basePrompt || r.prompt}
                  onClick={() =>
                    setImageModal({ open: true, imageId: r.imageId, title: r.basePrompt || r.prompt })
                  }
                />
              ) : r.status === "error" ? (
                <span className="tip-result-error">Failed</span>
              ) : (
                <span className="tip-spinner" />
              )}
            </div>
            <div className="tip-result-meta">
              <div className="tip-result-prompt">{r.basePrompt || r.prompt}</div>
              <div className="tip-result-info">
                {r.model} · {r.aspect}
                {r.width && r.height ? ` · ${r.width}×${r.height}` : ""}
              </div>
              {r.toggles && r.toggles.length > 0 && (
                <div className="tip-result-info">
                  + {r.toggles.join(", ")}
                </div>
              )}
              {r.status === "queued" && (
                <div className="tip-result-status">Queued...</div>
              )}
              {r.status === "running" && (
                <div className="tip-result-status">Generating...</div>
              )}
              {r.status === "error" && (
                <div className="tip-result-error">{r.error}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      <ImageModal
        isOpen={imageModal.open}
        imageId={imageModal.imageId}
        title={imageModal.title}
        onClose={() => setImageModal({ open: false, imageId: "", title: "" })}
      />
    </div>
  );
}

TestImagePanel.propTypes = {
  globalModel: PropTypes.string,
  globalAspect: PropTypes.string,
  styleLibrary: PropTypes.object,
  imageGenSettings: PropTypes.object,
  buildPrompt: PropTypes.func,
};

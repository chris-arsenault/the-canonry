/**
 * ImageSettingsDrawer - Global slide-out panel for image generation settings
 *
 * Centralizes all style, composition, palette, size, and quality controls
 * in a single drawer accessible from the sidebar. Replaces inline
 * StyleSelector dropdowns in EntityBrowser and ChronicleImagePanel.
 */

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { getSizeOptions, getQualityOptions } from "../lib/imageSettings";
import {
  DEFAULT_RANDOM_EXCLUSIONS,
  filterStylesForComposition,
  filterCompositionsForStyle,
} from "@canonry/world-schema";
import type { ImageGenSettings } from "../hooks/useImageGenSettings";
import "./ImageSettingsDrawer.css";

// ─── Types ───────────────────────────────────────────────────────────────

interface StyleLibrary {
  artisticStyles: Array<{
    id: string;
    name: string;
    description?: string;
    promptFragment?: string;
    category?: string;
  }>;
  compositionStyles: Array<{
    id: string;
    name: string;
    description?: string;
    promptFragment?: string;
    targetCategory?: string;
  }>;
  colorPalettes: Array<{
    id: string;
    name: string;
    description?: string;
    promptFragment?: string;
    swatchColors?: string[];
  }>;
}

interface Culture {
  id: string;
  name: string;
}

interface ImageSettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ImageGenSettings;
  onSettingsChange: (partial: Partial<ImageGenSettings>) => void;
  styleLibrary: StyleLibrary | null;
  cultures?: Culture[];
  imageModel: string;
}

// ─── Constants ───────────────────────────────────────────────────────────

const RANDOM_ID = "random";
const NONE_ID = "none";

const COMPOSITION_CATEGORY_LABELS: Record<string, string> = {
  character: "Character",
  pair: "Pair",
  pose: "Pose",
  collective: "Collective",
  place: "Place",
  landscape: "Landscape",
  object: "Object",
  concept: "Concept",
  event: "Event",
};

const COMPOSITION_CATEGORY_ORDER = [
  "character",
  "pair",
  "pose",
  "collective",
  "place",
  "landscape",
  "object",
  "concept",
  "event",
];

const ARTISTIC_CATEGORY_LABELS: Record<string, string> = {
  painting: "Painting",
  "ink-print": "Ink & Print",
  digital: "Digital",
  camera: "Camera",
  experimental: "Experimental",
  document: "Document",
};

const ARTISTIC_CATEGORY_ORDER = [
  "painting",
  "ink-print",
  "digital",
  "camera",
  "experimental",
  "document",
];

const PALETTE_GROUPS: Array<{ label: string; ids: string[] }> = [
  {
    label: "Hues",
    ids: [
      "crimson-dynasty",
      "amber-blaze",
      "gilded-sunlight",
      "verdant-jungle",
      "arctic-cyan",
      "midnight-sapphire",
      "electric-magenta",
      "borealis",
    ],
  },
  {
    label: "Special",
    ids: ["monochrome-noir", "volcanic-obsidian", "verdigris-patina"],
  },
  {
    label: "Natural",
    ids: ["natural-daylight", "vivid-realism", "comic-bold"],
  },
  {
    label: "Contrast Pairs",
    ids: ["blood-ivory", "ink-gold", "jade-obsidian", "azure-bone"],
  },
];

// ─── Sub-components ──────────────────────────────────────────────────────

function SpecialToggle({
  value,
  onChange,
  poolInfo,
}: {
  value: string;
  onChange: (id: string) => void;
  poolInfo?: string;
}) {
  return (
    <div className="isd-special-toggle-row">
      {[
        { id: RANDOM_ID, label: "\u2684 Random" },
        { id: NONE_ID, label: "\u2014 None" },
      ].map((opt) => (
        <button
          key={opt.id}
          onClick={() => onChange(opt.id)}
          className="isd-special-toggle-btn"
          data-selected={value === opt.id}
        >
          {opt.label}
        </button>
      ))}
      {poolInfo && value === RANDOM_ID && (
        <span className="isd-pool-info">
          {poolInfo}
        </span>
      )}
    </div>
  );
}

function CollapsibleSection({
  title,
  sectionKey,
  collapsed,
  onToggle,
  children,
  badge,
}: {
  title: string;
  sectionKey: string;
  collapsed: boolean;
  onToggle: (key: string) => void;
  children: React.ReactNode;
  badge?: string;
}) {
  return (
    <div className="isd-section">
      <button
        onClick={() => onToggle(sectionKey)}
        className="isd-section-btn"
      >
        <span
          className="isd-section-chevron"
          data-collapsed={String(collapsed)}
        >
          &#9654;
        </span>
        {title}
        {badge && (
          <span className="isd-section-badge">
            {badge}
          </span>
        )}
      </button>
      {!collapsed && <div className="isd-section-content">{children}</div>}
    </div>
  );
}

function SwatchStrip({ colors }: { colors: string[] }) {
  return (
    <div className="isd-swatch-strip">
      {colors.map((color, i) => (
        <div
          key={i}
          className="isd-swatch"
          // eslint-disable-next-line local/no-inline-styles
          style={{ '--swatch-bg': color, background: 'var(--swatch-bg)' } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────

export default function ImageSettingsDrawer({
  isOpen,
  onClose,
  settings: externalSettings,
  onSettingsChange: externalOnChange,
  styleLibrary,
  cultures,
  imageModel,
}: ImageSettingsDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);

  // Local copy of settings for instant UI feedback.
  // Changes render immediately here, then propagate to parent via rAF.
  const [settings, setLocalSettings] = useState(externalSettings);
  const pendingFlush = useRef<number | null>(null);

  // Sync local state when external settings change (e.g. on mount or external update)
  useEffect(() => {
    setLocalSettings(externalSettings);
  }, [externalSettings]);

  // Debounced push to parent — renders locally first, then flushes
  const onSettingsChange = useCallback(
    (partial: Partial<ImageGenSettings>) => {
      setLocalSettings((prev) => ({ ...prev, ...partial }));
      if (pendingFlush.current !== null) cancelAnimationFrame(pendingFlush.current);
      pendingFlush.current = requestAnimationFrame(() => {
        pendingFlush.current = null;
        externalOnChange(partial);
      });
    },
    [externalOnChange]
  );

  // Cleanup on unmount
  useEffect(
    () => () => {
      if (pendingFlush.current !== null) cancelAnimationFrame(pendingFlush.current);
    },
    []
  );

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Section collapse state
  const collapsedSet = useMemo(
    () => new Set(settings.collapsedSections),
    [settings.collapsedSections]
  );
  const toggleSection = useCallback(
    (key: string) => {
      const next = new Set(collapsedSet);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      onSettingsChange({ collapsedSections: Array.from(next) });
    },
    [collapsedSet, onSettingsChange]
  );

  // Group compositions by category
  const groupedCompositions = useMemo(() => {
    if (!styleLibrary) return new Map<string, typeof styleLibrary.compositionStyles>();
    const map = new Map<string, typeof styleLibrary.compositionStyles>();
    for (const style of styleLibrary.compositionStyles) {
      const cat = style.targetCategory || "other";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(style);
    }
    return map;
  }, [styleLibrary]);

  // Group artistic styles by category
  const groupedArtisticStyles = useMemo(() => {
    if (!styleLibrary) return new Map<string, typeof styleLibrary.artisticStyles>();
    const map = new Map<string, typeof styleLibrary.artisticStyles>();
    for (const style of styleLibrary.artisticStyles) {
      const cat = style.category || "other";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(style);
    }
    return map;
  }, [styleLibrary]);

  // Derive initial category tab from current selection
  const selectedCompositionCategory = useMemo(() => {
    if (!styleLibrary) return COMPOSITION_CATEGORY_ORDER[0];
    const selected = styleLibrary.compositionStyles.find(
      (s) => s.id === settings.compositionStyleId
    );
    return selected?.targetCategory || COMPOSITION_CATEGORY_ORDER[0];
  }, [styleLibrary, settings.compositionStyleId]);

  const selectedArtisticCategory = useMemo(() => {
    if (!styleLibrary) return ARTISTIC_CATEGORY_ORDER[0];
    const selected = styleLibrary.artisticStyles.find((s) => s.id === settings.artisticStyleId);
    return selected?.category || ARTISTIC_CATEGORY_ORDER[0];
  }, [styleLibrary, settings.artisticStyleId]);

  // Active category tabs — initialized from selection, then user-controllable
  const [activeCompositionCategory, setActiveCompositionCategory] = useState(
    selectedCompositionCategory
  );
  const [activeArtisticCategory, setActiveArtisticCategory] = useState(selectedArtisticCategory);

  // Sync tab when selection changes to a different category (e.g. picking from a different tab)
  useEffect(() => {
    setActiveCompositionCategory(selectedCompositionCategory);
  }, [selectedCompositionCategory]);
  useEffect(() => {
    setActiveArtisticCategory(selectedArtisticCategory);
  }, [selectedArtisticCategory]);

  // Available category tabs (only those with styles)
  const availableCompositionCategories = useMemo(() => {
    return COMPOSITION_CATEGORY_ORDER.filter((cat) => groupedCompositions.has(cat));
  }, [groupedCompositions]);

  const availableArtisticCategories = useMemo(() => {
    return ARTISTIC_CATEGORY_ORDER.filter((cat) => groupedArtisticStyles.has(cat));
  }, [groupedArtisticStyles]);

  // Resolve display names for badge
  const artisticName = useMemo(() => {
    if (settings.artisticStyleId === RANDOM_ID) return "Random";
    if (settings.artisticStyleId === NONE_ID) return "None";
    return (
      styleLibrary?.artisticStyles.find((s) => s.id === settings.artisticStyleId)?.name ||
      settings.artisticStyleId
    );
  }, [settings.artisticStyleId, styleLibrary]);

  const compositionName = useMemo(() => {
    if (settings.compositionStyleId === RANDOM_ID) return "Random";
    if (settings.compositionStyleId === NONE_ID) return "None";
    return (
      styleLibrary?.compositionStyles.find((s) => s.id === settings.compositionStyleId)?.name ||
      settings.compositionStyleId
    );
  }, [settings.compositionStyleId, styleLibrary]);

  const paletteName = useMemo(() => {
    if (settings.colorPaletteId === RANDOM_ID) return "Random";
    if (settings.colorPaletteId === NONE_ID) return "None";
    return (
      styleLibrary?.colorPalettes.find((s) => s.id === settings.colorPaletteId)?.name ||
      settings.colorPaletteId
    );
  }, [settings.colorPaletteId, styleLibrary]);

  // Group palettes by pre-defined groups
  const palettesByGroup = useMemo(() => {
    if (!styleLibrary) return [];
    const paletteMap = new Map(styleLibrary.colorPalettes.map((p) => [p.id, p]));
    return PALETTE_GROUPS.map((group) => ({
      label: group.label,
      palettes: group.ids
        .map((id) => paletteMap.get(id))
        .filter(Boolean) as typeof styleLibrary.colorPalettes,
    })).filter((g) => g.palettes.length > 0);
  }, [styleLibrary]);

  // Size/quality options for current model
  const sizeOptions = useMemo(() => getSizeOptions(imageModel), [imageModel]);
  const qualityOptions = useMemo(() => getQualityOptions(imageModel), [imageModel]);

  // Is the current selection a special value?
  const isSpecialArtistic =
    settings.artisticStyleId === RANDOM_ID || settings.artisticStyleId === NONE_ID;
  const isSpecialComposition =
    settings.compositionStyleId === RANDOM_ID || settings.compositionStyleId === NONE_ID;
  const isSpecialPalette =
    settings.colorPaletteId === RANDOM_ID || settings.colorPaletteId === NONE_ID;

  // Pool count info for random selection with exclusion filtering
  const artisticPoolInfo = useMemo(() => {
    if (!styleLibrary || isSpecialComposition) return undefined;
    const total = styleLibrary.artisticStyles.length;
    const filtered = filterStylesForComposition(
      styleLibrary.artisticStyles as any,
      settings.compositionStyleId,
      DEFAULT_RANDOM_EXCLUSIONS,
      styleLibrary.compositionStyles as any
    );
    return filtered.length < total ? `(${filtered.length}/${total})` : undefined;
  }, [styleLibrary, settings.compositionStyleId, isSpecialComposition]);

  const compositionPoolInfo = useMemo(() => {
    if (!styleLibrary || isSpecialArtistic) return undefined;
    const total = styleLibrary.compositionStyles.length;
    const filtered = filterCompositionsForStyle(
      styleLibrary.compositionStyles as any,
      settings.artisticStyleId,
      DEFAULT_RANDOM_EXCLUSIONS,
      styleLibrary.artisticStyles as any
    );
    return filtered.length < total ? `(${filtered.length}/${total})` : undefined;
  }, [styleLibrary, settings.artisticStyleId, isSpecialArtistic]);

  if (!isOpen) return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="isd-backdrop"
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        onClick={(e) => e.stopPropagation()}
        className="isd-drawer"
      >
        {/* Header */}
        <div className="isd-header">
          <span className="isd-header-title">Image Settings</span>
          <button
            onClick={onClose}
            className="isd-close-btn"
          >
            &#10005;
          </button>
        </div>

        {/* Scrollable content */}
        <div className="isd-scroll">
          {!styleLibrary ? (
            <div className="isd-loading">
              Loading styles...
            </div>
          ) : (
            <>
              {/* ─── Visual Style ─── */}
              <CollapsibleSection
                title="Visual Style"
                sectionKey="artistic"
                collapsed={collapsedSet.has("artistic")}
                onToggle={toggleSection}
                badge={artisticName}
              >
                <SpecialToggle
                  value={isSpecialArtistic ? settings.artisticStyleId : ""}
                  onChange={(id) => onSettingsChange({ artisticStyleId: id })}
                  poolInfo={artisticPoolInfo}
                />

                {/* Artistic category tabs */}
                <div className="isd-category-tabs">
                  {availableArtisticCategories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setActiveArtisticCategory(cat)}
                      className="isd-category-tab"
                      data-active={activeArtisticCategory === cat}
                    >
                      {ARTISTIC_CATEGORY_LABELS[cat] || cat}
                    </button>
                  ))}
                </div>

                {/* Artistic style list for active category */}
                <div className="isd-item-list">
                  {(groupedArtisticStyles.get(activeArtisticCategory) || []).map((style) => {
                    const isSelected = settings.artisticStyleId === style.id;
                    return (
                      <button
                        key={style.id}
                        onClick={() => onSettingsChange({ artisticStyleId: style.id })}
                        title={style.promptFragment}
                        className="isd-item-btn"
                        data-selected={isSelected}
                      >
                        <span className="isd-item-name">
                          {style.name}
                        </span>
                        {style.description && (
                          <span className="isd-item-desc">
                            {style.description}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </CollapsibleSection>

              <div className="isd-divider" />

              {/* ─── Composition ─── */}
              <CollapsibleSection
                title="Composition"
                sectionKey="composition"
                collapsed={collapsedSet.has("composition")}
                onToggle={toggleSection}
                badge={compositionName}
              >
                <SpecialToggle
                  value={isSpecialComposition ? settings.compositionStyleId : ""}
                  onChange={(id) => onSettingsChange({ compositionStyleId: id })}
                  poolInfo={compositionPoolInfo}
                />

                {/* Category tabs */}
                <div className="isd-category-tabs">
                  {availableCompositionCategories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setActiveCompositionCategory(cat)}
                      className="isd-category-tab"
                      data-active={activeCompositionCategory === cat}
                    >
                      {COMPOSITION_CATEGORY_LABELS[cat] || cat}
                    </button>
                  ))}
                </div>

                {/* Composition list for active category */}
                <div className="isd-item-list">
                  {(groupedCompositions.get(activeCompositionCategory) || []).map((style) => {
                    const isSelected = settings.compositionStyleId === style.id;
                    return (
                      <button
                        key={style.id}
                        onClick={() => onSettingsChange({ compositionStyleId: style.id })}
                        title={style.promptFragment}
                        className="isd-item-btn"
                        data-selected={isSelected}
                      >
                        <span className="isd-item-name-composition">
                          {style.name}
                        </span>
                        {style.description && (
                          <span className="isd-item-desc">
                            {style.description}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </CollapsibleSection>

              <div className="isd-divider" />

              {/* ─── Color Palette ─── */}
              <CollapsibleSection
                title="Color Palette"
                sectionKey="palette"
                collapsed={collapsedSet.has("palette")}
                onToggle={toggleSection}
                badge={paletteName}
              >
                <SpecialToggle
                  value={isSpecialPalette ? settings.colorPaletteId : ""}
                  onChange={(id) => onSettingsChange({ colorPaletteId: id })}
                />

                {palettesByGroup.map((group) => (
                  <div key={group.label} className="isd-palette-group">
                    <div className="isd-palette-group-label">
                      {group.label}
                    </div>
                    <div className="isd-palette-grid">
                      {group.palettes.map((palette) => {
                        const isSelected = settings.colorPaletteId === palette.id;
                        return (
                          <button
                            key={palette.id}
                            onClick={() => onSettingsChange({ colorPaletteId: palette.id })}
                            title={palette.description}
                            className="isd-palette-btn"
                            data-selected={isSelected}
                          >
                            {palette.swatchColors && palette.swatchColors.length > 0 && (
                              <div className="isd-palette-swatch-row">
                                <SwatchStrip colors={palette.swatchColors} />
                              </div>
                            )}
                            <div className="isd-palette-name">
                              {palette.name}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </CollapsibleSection>

              <div className="isd-divider" />

              {/* ─── Output Settings ─── */}
              <CollapsibleSection
                title="Output"
                sectionKey="output"
                collapsed={collapsedSet.has("output")}
                onToggle={toggleSection}
              >
                {/* Size - segmented buttons */}
                <div className="isd-output-group">
                  <div className="isd-output-label">
                    Size
                  </div>
                  <div className="isd-output-btns">
                    {sizeOptions.map((opt) => {
                      const isSelected = settings.imageSize === opt.value;
                      return (
                        <button
                          key={opt.value}
                          onClick={() => onSettingsChange({ imageSize: opt.value })}
                          className="isd-output-btn"
                          data-selected={isSelected}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Quality - segmented buttons */}
                <div className="isd-output-group">
                  <div className="isd-output-label">
                    Quality
                  </div>
                  <div className="isd-output-btns">
                    {qualityOptions.map((opt) => {
                      const isSelected = settings.imageQuality === opt.value;
                      return (
                        <button
                          key={opt.value}
                          onClick={() => onSettingsChange({ imageQuality: opt.value })}
                          className="isd-output-btn"
                          data-selected={isSelected}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Culture dropdown */}
                {cultures && cultures.length > 0 && (
                  <div>
                    <div className="isd-output-label">
                      Culture
                    </div>
                    <select
                      value={settings.selectedCultureId}
                      onChange={(e) => onSettingsChange({ selectedCultureId: e.target.value })}
                      className="illuminator-select isd-culture-select"
                    >
                      <option value="">Auto-detect</option>
                      {cultures.map((culture) => (
                        <option key={culture.id} value={culture.id}>
                          {culture.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </CollapsibleSection>
            </>
          )}
        </div>
      </div>
    </>,
    document.body
  );
}

// ─── Summary line component (used by EntityBrowser / ChronicleImagePanel) ─

export function ImageSettingsSummary({
  settings,
  styleLibrary,
  onOpenSettings,
}: {
  settings: ImageGenSettings;
  styleLibrary: StyleLibrary | null;
  onOpenSettings: () => void;
}) {
  const resolve = (id: string, list: Array<{ id: string; name: string }> | undefined) => {
    if (id === RANDOM_ID) return "Random";
    if (id === NONE_ID) return "None";
    return list?.find((s) => s.id === id)?.name || id;
  };

  const artistic = resolve(settings.artisticStyleId, styleLibrary?.artisticStyles);
  const composition = resolve(settings.compositionStyleId, styleLibrary?.compositionStyles);
  const palette = resolve(settings.colorPaletteId, styleLibrary?.colorPalettes);

  // Find swatch colors for current palette
  const currentPalette = styleLibrary?.colorPalettes.find((p) => p.id === settings.colorPaletteId);
  const swatchColors = currentPalette?.swatchColors;

  return (
    <div className="isd-summary">
      <span className="isd-summary-label">Image:</span>
      <span className="isd-summary-value">
        {artistic} &middot; {composition} &middot; {palette}
      </span>
      {swatchColors && swatchColors.length > 0 && <SwatchStrip colors={swatchColors} />}
      <button
        onClick={onOpenSettings}
        className="isd-summary-settings-btn"
      >
        Settings
      </button>
    </div>
  );
}

// ─── Sidebar trigger button ──────────────────────────────────────────────

export function ImageSettingsTrigger({
  settings,
  styleLibrary,
  onClick,
}: {
  settings: ImageGenSettings;
  styleLibrary: StyleLibrary | null;
  onClick: () => void;
}) {
  const resolve = (id: string, list: Array<{ id: string; name: string }> | undefined) => {
    if (id === RANDOM_ID) return "Random";
    if (id === NONE_ID) return "\u2014";
    return list?.find((s) => s.id === id)?.name || id;
  };

  const artistic = resolve(settings.artisticStyleId, styleLibrary?.artisticStyles);
  const palette = resolve(settings.colorPaletteId, styleLibrary?.colorPalettes);
  const currentPalette = styleLibrary?.colorPalettes.find((p) => p.id === settings.colorPaletteId);
  const swatchColors = currentPalette?.swatchColors;

  return (
    <button
      onClick={onClick}
      className="isd-trigger"
      title="Open image generation settings"
    >
      <div className="isd-trigger-header">
        <span className="isd-trigger-title">Image Settings</span>
      </div>
      <div className="isd-trigger-detail">
        {swatchColors &&
        settings.colorPaletteId !== RANDOM_ID &&
        settings.colorPaletteId !== NONE_ID ? (
          <SwatchStrip colors={swatchColors.slice(0, 3)} />
        ) : null}
        <span className="isd-trigger-text">
          {artistic} &middot; {palette}
        </span>
      </div>
    </button>
  );
}

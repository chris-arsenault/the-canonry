/**
 * ImageSettingsDrawer - Global slide-out panel for image generation settings
 *
 * Centralizes all style, composition, palette, size, and quality controls
 * in a single drawer accessible from the sidebar. Replaces inline
 * StyleSelector dropdowns in EntityBrowser and ChronicleImagePanel.
 */

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { getSizeOptions, getQualityOptions } from '../lib/imageSettings';
import { DEFAULT_RANDOM_EXCLUSIONS, filterStylesForComposition, filterCompositionsForStyle } from '@canonry/world-schema';
import type { ImageGenSettings } from '../hooks/useImageGenSettings';

// ─── Types ───────────────────────────────────────────────────────────────

interface StyleLibrary {
  artisticStyles: Array<{ id: string; name: string; description?: string; promptFragment?: string; category?: string }>;
  compositionStyles: Array<{ id: string; name: string; description?: string; promptFragment?: string; targetCategory?: string }>;
  colorPalettes: Array<{ id: string; name: string; description?: string; promptFragment?: string; swatchColors?: string[] }>;
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

const RANDOM_ID = 'random';
const NONE_ID = 'none';

const COMPOSITION_CATEGORY_LABELS: Record<string, string> = {
  character: 'Character',
  pair: 'Pair',
  pose: 'Pose',
  collective: 'Collective',
  place: 'Place',
  landscape: 'Landscape',
  object: 'Object',
  concept: 'Concept',
  event: 'Event',
};

const COMPOSITION_CATEGORY_ORDER = ['character', 'pair', 'pose', 'collective', 'place', 'landscape', 'object', 'concept', 'event'];

const ARTISTIC_CATEGORY_LABELS: Record<string, string> = {
  painting: 'Painting',
  'ink-print': 'Ink & Print',
  digital: 'Digital',
  camera: 'Camera',
  experimental: 'Experimental',
  document: 'Document',
};

const ARTISTIC_CATEGORY_ORDER = ['painting', 'ink-print', 'digital', 'camera', 'experimental', 'document'];

const PALETTE_GROUPS: Array<{ label: string; ids: string[] }> = [
  {
    label: 'Hues',
    ids: ['crimson-dynasty', 'amber-blaze', 'gilded-sunlight', 'verdant-jungle', 'arctic-cyan', 'midnight-sapphire', 'electric-magenta', 'borealis'],
  },
  {
    label: 'Special',
    ids: ['monochrome-noir', 'volcanic-obsidian', 'verdigris-patina'],
  },
  {
    label: 'Natural',
    ids: ['natural-daylight', 'vivid-realism', 'comic-bold'],
  },
  {
    label: 'Contrast Pairs',
    ids: ['blood-ivory', 'ink-gold', 'jade-obsidian', 'azure-bone'],
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
    <div style={{ display: 'flex', gap: '4px', marginBottom: '8px', alignItems: 'center' }}>
      {[
        { id: RANDOM_ID, label: '⚄ Random' },
        { id: NONE_ID, label: '— None' },
      ].map((opt) => (
        <button
          key={opt.id}
          onClick={() => onChange(opt.id)}
          style={{
            padding: '3px 10px',
            fontSize: '11px',
            borderRadius: '4px',
            border: '1px solid',
            borderColor: value === opt.id ? 'var(--accent-color)' : 'var(--border-color)',
            background: value === opt.id ? 'rgba(168, 85, 247, 0.2)' : 'transparent',
            color: value === opt.id ? 'var(--accent-color)' : 'var(--text-muted)',
            cursor: 'pointer',
            transition: 'border-color 0.15s ease, background 0.15s ease, color 0.15s ease',
          }}
        >
          {opt.label}
        </button>
      ))}
      {poolInfo && value === RANDOM_ID && (
        <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: '4px' }}>
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
    <div style={{ marginBottom: '4px' }}>
      <button
        onClick={() => onToggle(sectionKey)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          width: '100%',
          padding: '8px 0',
          background: 'none',
          border: 'none',
          color: 'var(--text-color)',
          fontSize: '13px',
          fontWeight: 600,
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{
          display: 'inline-block',
          width: '12px',
          fontSize: '10px',
          color: 'var(--text-muted)',
          transition: 'transform 0.15s ease',
          transform: collapsed ? 'rotate(0deg)' : 'rotate(90deg)',
        }}>
          ▶
        </span>
        {title}
        {badge && (
          <span style={{
            marginLeft: 'auto',
            fontSize: '10px',
            color: 'var(--accent-color)',
            padding: '1px 6px',
            background: 'rgba(168, 85, 247, 0.15)',
            borderRadius: '3px',
          }}>
            {badge}
          </span>
        )}
      </button>
      {!collapsed && (
        <div style={{ paddingLeft: '18px', paddingBottom: '8px' }}>
          {children}
        </div>
      )}
    </div>
  );
}

function SwatchStrip({ colors }: { colors: string[] }) {
  return (
    <div style={{ display: 'flex', gap: '2px' }}>
      {colors.map((color, i) => (
        <div
          key={i}
          style={{
            width: '14px',
            height: '14px',
            borderRadius: '3px',
            background: color,
            border: '1px solid rgba(255,255,255,0.15)',
          }}
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
  useEffect(() => { setLocalSettings(externalSettings); }, [externalSettings]);

  // Debounced push to parent — renders locally first, then flushes
  const onSettingsChange = useCallback((partial: Partial<ImageGenSettings>) => {
    setLocalSettings((prev) => ({ ...prev, ...partial }));
    if (pendingFlush.current !== null) cancelAnimationFrame(pendingFlush.current);
    pendingFlush.current = requestAnimationFrame(() => {
      pendingFlush.current = null;
      externalOnChange(partial);
    });
  }, [externalOnChange]);

  // Cleanup on unmount
  useEffect(() => () => {
    if (pendingFlush.current !== null) cancelAnimationFrame(pendingFlush.current);
  }, []);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Section collapse state
  const collapsedSet = useMemo(() => new Set(settings.collapsedSections), [settings.collapsedSections]);
  const toggleSection = useCallback((key: string) => {
    const next = new Set(collapsedSet);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onSettingsChange({ collapsedSections: Array.from(next) });
  }, [collapsedSet, onSettingsChange]);

  // Group compositions by category
  const groupedCompositions = useMemo(() => {
    if (!styleLibrary) return new Map<string, typeof styleLibrary.compositionStyles>();
    const map = new Map<string, typeof styleLibrary.compositionStyles>();
    for (const style of styleLibrary.compositionStyles) {
      const cat = style.targetCategory || 'other';
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
      const cat = style.category || 'other';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(style);
    }
    return map;
  }, [styleLibrary]);

  // Derive initial category tab from current selection
  const selectedCompositionCategory = useMemo(() => {
    if (!styleLibrary) return COMPOSITION_CATEGORY_ORDER[0];
    const selected = styleLibrary.compositionStyles.find((s) => s.id === settings.compositionStyleId);
    return selected?.targetCategory || COMPOSITION_CATEGORY_ORDER[0];
  }, [styleLibrary, settings.compositionStyleId]);

  const selectedArtisticCategory = useMemo(() => {
    if (!styleLibrary) return ARTISTIC_CATEGORY_ORDER[0];
    const selected = styleLibrary.artisticStyles.find((s) => s.id === settings.artisticStyleId);
    return selected?.category || ARTISTIC_CATEGORY_ORDER[0];
  }, [styleLibrary, settings.artisticStyleId]);

  // Active category tabs — initialized from selection, then user-controllable
  const [activeCompositionCategory, setActiveCompositionCategory] = useState(selectedCompositionCategory);
  const [activeArtisticCategory, setActiveArtisticCategory] = useState(selectedArtisticCategory);

  // Sync tab when selection changes to a different category (e.g. picking from a different tab)
  useEffect(() => { setActiveCompositionCategory(selectedCompositionCategory); }, [selectedCompositionCategory]);
  useEffect(() => { setActiveArtisticCategory(selectedArtisticCategory); }, [selectedArtisticCategory]);

  // Available category tabs (only those with styles)
  const availableCompositionCategories = useMemo(() => {
    return COMPOSITION_CATEGORY_ORDER.filter((cat) => groupedCompositions.has(cat));
  }, [groupedCompositions]);

  const availableArtisticCategories = useMemo(() => {
    return ARTISTIC_CATEGORY_ORDER.filter((cat) => groupedArtisticStyles.has(cat));
  }, [groupedArtisticStyles]);

  // Resolve display names for badge
  const artisticName = useMemo(() => {
    if (settings.artisticStyleId === RANDOM_ID) return 'Random';
    if (settings.artisticStyleId === NONE_ID) return 'None';
    return styleLibrary?.artisticStyles.find((s) => s.id === settings.artisticStyleId)?.name || settings.artisticStyleId;
  }, [settings.artisticStyleId, styleLibrary]);

  const compositionName = useMemo(() => {
    if (settings.compositionStyleId === RANDOM_ID) return 'Random';
    if (settings.compositionStyleId === NONE_ID) return 'None';
    return styleLibrary?.compositionStyles.find((s) => s.id === settings.compositionStyleId)?.name || settings.compositionStyleId;
  }, [settings.compositionStyleId, styleLibrary]);

  const paletteName = useMemo(() => {
    if (settings.colorPaletteId === RANDOM_ID) return 'Random';
    if (settings.colorPaletteId === NONE_ID) return 'None';
    return styleLibrary?.colorPalettes.find((s) => s.id === settings.colorPaletteId)?.name || settings.colorPaletteId;
  }, [settings.colorPaletteId, styleLibrary]);

  // Group palettes by pre-defined groups
  const palettesByGroup = useMemo(() => {
    if (!styleLibrary) return [];
    const paletteMap = new Map(styleLibrary.colorPalettes.map((p) => [p.id, p]));
    return PALETTE_GROUPS.map((group) => ({
      label: group.label,
      palettes: group.ids.map((id) => paletteMap.get(id)).filter(Boolean) as typeof styleLibrary.colorPalettes,
    })).filter((g) => g.palettes.length > 0);
  }, [styleLibrary]);

  // Size/quality options for current model
  const sizeOptions = useMemo(() => getSizeOptions(imageModel), [imageModel]);
  const qualityOptions = useMemo(() => getQualityOptions(imageModel), [imageModel]);

  // Is the current selection a special value?
  const isSpecialArtistic = settings.artisticStyleId === RANDOM_ID || settings.artisticStyleId === NONE_ID;
  const isSpecialComposition = settings.compositionStyleId === RANDOM_ID || settings.compositionStyleId === NONE_ID;
  const isSpecialPalette = settings.colorPaletteId === RANDOM_ID || settings.colorPaletteId === NONE_ID;

  // Pool count info for random selection with exclusion filtering
  const artisticPoolInfo = useMemo(() => {
    if (!styleLibrary || isSpecialComposition) return undefined;
    const total = styleLibrary.artisticStyles.length;
    const filtered = filterStylesForComposition(
      styleLibrary.artisticStyles as any,
      settings.compositionStyleId,
      DEFAULT_RANDOM_EXCLUSIONS,
      styleLibrary.compositionStyles as any,
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
      styleLibrary.artisticStyles as any,
    );
    return filtered.length < total ? `(${filtered.length}/${total})` : undefined;
  }, [styleLibrary, settings.artisticStyleId, isSpecialArtistic]);

  if (!isOpen) return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.4)',
          zIndex: 9998,
        }}
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          top: 0,
          left: '200px',
          bottom: 0,
          width: '380px',
          background: 'var(--bg-primary)',
          borderRight: '1px solid var(--border-color)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '4px 0 24px rgba(0, 0, 0, 0.3)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid var(--border-color)',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: '14px', fontWeight: 600 }}>Image Settings</span>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '18px',
              cursor: 'pointer',
              padding: '0 4px',
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Scrollable content */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 16px',
        }}>
          {!styleLibrary ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '12px', padding: '12px 0' }}>
              Loading styles...
            </div>
          ) : (
            <>
              {/* ─── Visual Style ─── */}
              <CollapsibleSection
                title="Visual Style"
                sectionKey="artistic"
                collapsed={collapsedSet.has('artistic')}
                onToggle={toggleSection}
                badge={artisticName}
              >
                <SpecialToggle
                  value={isSpecialArtistic ? settings.artisticStyleId : ''}
                  onChange={(id) => onSettingsChange({ artisticStyleId: id })}
                  poolInfo={artisticPoolInfo}
                />

                {/* Artistic category tabs */}
                <div style={{
                  display: 'flex',
                  gap: '2px',
                  marginBottom: '8px',
                  flexWrap: 'wrap',
                }}>
                  {availableArtisticCategories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setActiveArtisticCategory(cat)}
                      style={{
                        padding: '3px 8px',
                        fontSize: '10px',
                        borderRadius: '3px',
                        border: '1px solid',
                        borderColor: activeArtisticCategory === cat ? 'var(--accent-color)' : 'var(--border-color)',
                        background: activeArtisticCategory === cat ? 'rgba(168, 85, 247, 0.15)' : 'transparent',
                        color: activeArtisticCategory === cat ? 'var(--accent-color)' : 'var(--text-muted)',
                        cursor: 'pointer',
                        transition: 'border-color 0.15s ease, background 0.15s ease, color 0.15s ease',
                        fontWeight: activeArtisticCategory === cat ? 600 : 400,
                      }}
                    >
                      {ARTISTIC_CATEGORY_LABELS[cat] || cat}
                    </button>
                  ))}
                </div>

                {/* Artistic style list for active category */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '3px',
                  maxHeight: '200px',
                  overflowY: 'auto',
                }}>
                  {(groupedArtisticStyles.get(activeArtisticCategory) || []).map((style) => {
                    const isSelected = settings.artisticStyleId === style.id;
                    return (
                      <button
                        key={style.id}
                        onClick={() => onSettingsChange({ artisticStyleId: style.id })}
                        title={style.promptFragment}
                        style={{
                          display: 'flex',
                          alignItems: 'baseline',
                          gap: '8px',
                          padding: '5px 8px',
                          borderRadius: '4px',
                          border: '1px solid',
                          borderColor: isSelected ? 'var(--accent-color)' : 'transparent',
                          background: isSelected ? 'rgba(168, 85, 247, 0.12)' : 'transparent',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'border-color 0.15s ease, background 0.15s ease, color 0.15s ease',
                          width: '100%',
                        }}
                      >
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 500,
                          color: isSelected ? 'var(--accent-color)' : 'var(--text-color)',
                          flexShrink: 0,
                        }}>
                          {style.name}
                        </span>
                        {style.description && (
                          <span style={{
                            fontSize: '10px',
                            color: 'var(--text-muted)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>
                            {style.description}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </CollapsibleSection>

              <div style={{ borderTop: '1px solid var(--border-color)', margin: '4px 0' }} />

              {/* ─── Composition ─── */}
              <CollapsibleSection
                title="Composition"
                sectionKey="composition"
                collapsed={collapsedSet.has('composition')}
                onToggle={toggleSection}
                badge={compositionName}
              >
                <SpecialToggle
                  value={isSpecialComposition ? settings.compositionStyleId : ''}
                  onChange={(id) => onSettingsChange({ compositionStyleId: id })}
                  poolInfo={compositionPoolInfo}
                />

                {/* Category tabs */}
                <div style={{
                  display: 'flex',
                  gap: '2px',
                  marginBottom: '8px',
                  flexWrap: 'wrap',
                }}>
                  {availableCompositionCategories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setActiveCompositionCategory(cat)}
                      style={{
                        padding: '3px 8px',
                        fontSize: '10px',
                        borderRadius: '3px',
                        border: '1px solid',
                        borderColor: activeCompositionCategory === cat ? 'var(--accent-color)' : 'var(--border-color)',
                        background: activeCompositionCategory === cat ? 'rgba(168, 85, 247, 0.15)' : 'transparent',
                        color: activeCompositionCategory === cat ? 'var(--accent-color)' : 'var(--text-muted)',
                        cursor: 'pointer',
                        transition: 'border-color 0.15s ease, background 0.15s ease, color 0.15s ease',
                        fontWeight: activeCompositionCategory === cat ? 600 : 400,
                      }}
                    >
                      {COMPOSITION_CATEGORY_LABELS[cat] || cat}
                    </button>
                  ))}
                </div>

                {/* Composition list for active category */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '3px',
                  maxHeight: '200px',
                  overflowY: 'auto',
                }}>
                  {(groupedCompositions.get(activeCompositionCategory) || []).map((style) => {
                    const isSelected = settings.compositionStyleId === style.id;
                    return (
                      <button
                        key={style.id}
                        onClick={() => onSettingsChange({ compositionStyleId: style.id })}
                        title={style.promptFragment}
                        style={{
                          display: 'flex',
                          alignItems: 'baseline',
                          gap: '8px',
                          padding: '5px 8px',
                          borderRadius: '4px',
                          border: '1px solid',
                          borderColor: isSelected ? 'var(--accent-color)' : 'transparent',
                          background: isSelected ? 'rgba(168, 85, 247, 0.12)' : 'transparent',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'border-color 0.15s ease, background 0.15s ease, color 0.15s ease',
                          width: '100%',
                        }}
                      >
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 500,
                          color: isSelected ? 'var(--accent-color)' : 'var(--text-color)',
                          flexShrink: 0,
                          minWidth: '0',
                        }}>
                          {style.name}
                        </span>
                        {style.description && (
                          <span style={{
                            fontSize: '10px',
                            color: 'var(--text-muted)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>
                            {style.description}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </CollapsibleSection>

              <div style={{ borderTop: '1px solid var(--border-color)', margin: '4px 0' }} />

              {/* ─── Color Palette ─── */}
              <CollapsibleSection
                title="Color Palette"
                sectionKey="palette"
                collapsed={collapsedSet.has('palette')}
                onToggle={toggleSection}
                badge={paletteName}
              >
                <SpecialToggle
                  value={isSpecialPalette ? settings.colorPaletteId : ''}
                  onChange={(id) => onSettingsChange({ colorPaletteId: id })}
                />

                {palettesByGroup.map((group) => (
                  <div key={group.label} style={{ marginBottom: '8px' }}>
                    <div style={{
                      fontSize: '10px',
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: '4px',
                    }}>
                      {group.label}
                    </div>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: '4px',
                    }}>
                      {group.palettes.map((palette) => {
                        const isSelected = settings.colorPaletteId === palette.id;
                        return (
                          <button
                            key={palette.id}
                            onClick={() => onSettingsChange({ colorPaletteId: palette.id })}
                            title={palette.description}
                            style={{
                              padding: '6px',
                              borderRadius: '4px',
                              border: '1px solid',
                              borderColor: isSelected ? 'var(--accent-color)' : 'var(--border-color)',
                              background: isSelected ? 'rgba(168, 85, 247, 0.12)' : 'var(--bg-tertiary)',
                              cursor: 'pointer',
                              textAlign: 'left',
                              transition: 'border-color 0.15s ease, background 0.15s ease, color 0.15s ease',
                            }}
                          >
                            {palette.swatchColors && palette.swatchColors.length > 0 && (
                              <div style={{ marginBottom: '4px' }}>
                                <SwatchStrip colors={palette.swatchColors} />
                              </div>
                            )}
                            <div style={{
                              fontSize: '10px',
                              fontWeight: 500,
                              color: isSelected ? 'var(--accent-color)' : 'var(--text-color)',
                              lineHeight: 1.2,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}>
                              {palette.name}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </CollapsibleSection>

              <div style={{ borderTop: '1px solid var(--border-color)', margin: '4px 0' }} />

              {/* ─── Output Settings ─── */}
              <CollapsibleSection
                title="Output"
                sectionKey="output"
                collapsed={collapsedSet.has('output')}
                onToggle={toggleSection}
              >
                {/* Size - segmented buttons */}
                <div style={{ marginBottom: '10px' }}>
                  <div style={{
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    marginBottom: '4px',
                  }}>
                    Size
                  </div>
                  <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
                    {sizeOptions.map((opt) => {
                      const isSelected = settings.imageSize === opt.value;
                      return (
                        <button
                          key={opt.value}
                          onClick={() => onSettingsChange({ imageSize: opt.value })}
                          style={{
                            padding: '4px 10px',
                            fontSize: '11px',
                            borderRadius: '4px',
                            border: '1px solid',
                            borderColor: isSelected ? 'var(--accent-color)' : 'var(--border-color)',
                            background: isSelected ? 'rgba(168, 85, 247, 0.2)' : 'transparent',
                            color: isSelected ? 'var(--accent-color)' : 'var(--text-secondary)',
                            cursor: 'pointer',
                            transition: 'border-color 0.15s ease, background 0.15s ease, color 0.15s ease',
                            fontWeight: isSelected ? 600 : 400,
                          }}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Quality - segmented buttons */}
                <div style={{ marginBottom: '10px' }}>
                  <div style={{
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    marginBottom: '4px',
                  }}>
                    Quality
                  </div>
                  <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
                    {qualityOptions.map((opt) => {
                      const isSelected = settings.imageQuality === opt.value;
                      return (
                        <button
                          key={opt.value}
                          onClick={() => onSettingsChange({ imageQuality: opt.value })}
                          style={{
                            padding: '4px 10px',
                            fontSize: '11px',
                            borderRadius: '4px',
                            border: '1px solid',
                            borderColor: isSelected ? 'var(--accent-color)' : 'var(--border-color)',
                            background: isSelected ? 'rgba(168, 85, 247, 0.2)' : 'transparent',
                            color: isSelected ? 'var(--accent-color)' : 'var(--text-secondary)',
                            cursor: 'pointer',
                            transition: 'border-color 0.15s ease, background 0.15s ease, color 0.15s ease',
                            fontWeight: isSelected ? 600 : 400,
                          }}
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
                    <div style={{
                      fontSize: '11px',
                      color: 'var(--text-muted)',
                      marginBottom: '4px',
                    }}>
                      Culture
                    </div>
                    <select
                      value={settings.selectedCultureId}
                      onChange={(e) => onSettingsChange({ selectedCultureId: e.target.value })}
                      className="illuminator-select"
                      style={{ width: '100%' }}
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
    if (id === RANDOM_ID) return 'Random';
    if (id === NONE_ID) return 'None';
    return list?.find((s) => s.id === id)?.name || id;
  };

  const artistic = resolve(settings.artisticStyleId, styleLibrary?.artisticStyles);
  const composition = resolve(settings.compositionStyleId, styleLibrary?.compositionStyles);
  const palette = resolve(settings.colorPaletteId, styleLibrary?.colorPalettes);

  // Find swatch colors for current palette
  const currentPalette = styleLibrary?.colorPalettes.find((p) => p.id === settings.colorPaletteId);
  const swatchColors = currentPalette?.swatchColors;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 12px',
        background: 'var(--bg-tertiary)',
        borderRadius: '4px',
        marginBottom: '12px',
        flexWrap: 'wrap',
      }}
    >
      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Image:</span>
      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
        {artistic} · {composition} · {palette}
      </span>
      {swatchColors && swatchColors.length > 0 && (
        <SwatchStrip colors={swatchColors} />
      )}
      <button
        onClick={onOpenSettings}
        style={{
          marginLeft: 'auto',
          padding: '2px 8px',
          fontSize: '10px',
          borderRadius: '3px',
          border: '1px solid var(--border-color)',
          background: 'transparent',
          color: 'var(--accent-color)',
          cursor: 'pointer',
          transition: 'border-color 0.15s ease, background 0.15s ease, color 0.15s ease',
        }}
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
    if (id === RANDOM_ID) return 'Random';
    if (id === NONE_ID) return '—';
    return list?.find((s) => s.id === id)?.name || id;
  };

  const artistic = resolve(settings.artisticStyleId, styleLibrary?.artisticStyles);
  const palette = resolve(settings.colorPaletteId, styleLibrary?.colorPalettes);
  const currentPalette = styleLibrary?.colorPalettes.find((p) => p.id === settings.colorPaletteId);
  const swatchColors = currentPalette?.swatchColors;

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        width: '100%',
        padding: '8px 10px',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: '4px',
        color: 'var(--text-secondary)',
        fontSize: '11px',
        cursor: 'pointer',
        transition: 'border-color 0.15s ease, background 0.15s ease, color 0.15s ease',
        textAlign: 'left',
      }}
      title="Open image generation settings"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%' }}>
        <span style={{ fontSize: '12px', fontWeight: 500 }}>Image Settings</span>
      </div>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '10px',
        color: 'var(--text-muted)',
        overflow: 'hidden',
      }}>
        {swatchColors && settings.colorPaletteId !== RANDOM_ID && settings.colorPaletteId !== NONE_ID ? (
          <SwatchStrip colors={swatchColors.slice(0, 3)} />
        ) : null}
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {artistic} · {palette}
        </span>
      </div>
    </button>
  );
}

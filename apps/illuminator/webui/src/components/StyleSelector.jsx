/**
 * StyleSelector - Select artistic, composition, and color palette styles for image generation
 *
 * Three dropdowns for style selection:
 * - Artistic style (oil painting, watercolor, digital art, etc.)
 * - Composition style (portrait, full body, establishing shot, etc.)
 * - Color palette (warm earth, jewel tones, sunset fire, etc.)
 *
 * Supports:
 * - "Random" option (default) - picks a random style at generation time
 * - "None" - no style/composition constraint, let the prompt decide
 */

import { useMemo } from 'react';
import { DEFAULT_RANDOM_EXCLUSIONS } from '@canonry/world-schema';

const RANDOM_ID = 'random';
const NONE_ID = 'none';

/**
 * Category display names for grouping compositions
 */
const CATEGORY_LABELS = {
  character: 'Character',
  collective: 'Collective',
  place: 'Place',
  object: 'Object',
  concept: 'Concept',
  power: 'Power',
  era: 'Era',
  event: 'Event',
};

/**
 * Order for displaying category groups
 */
const CATEGORY_ORDER = ['character', 'collective', 'place', 'object', 'concept', 'power', 'era', 'event'];

/**
 * Group composition styles by targetCategory
 * Returns an array of { category, label, styles } objects in display order
 */
function groupCompositionsByCategory(styles) {
  const grouped = new Map();
  const uncategorized = [];

  for (const style of styles) {
    const category = style.targetCategory;
    if (category && CATEGORY_LABELS[category]) {
      if (!grouped.has(category)) {
        grouped.set(category, []);
      }
      grouped.get(category).push(style);
    } else {
      uncategorized.push(style);
    }
  }

  // Build result in category order
  const result = [];
  for (const category of CATEGORY_ORDER) {
    const categoryStyles = grouped.get(category);
    if (categoryStyles && categoryStyles.length > 0) {
      result.push({
        category,
        label: CATEGORY_LABELS[category],
        styles: categoryStyles,
      });
    }
  }

  // Add uncategorized at the end if any
  if (uncategorized.length > 0) {
    result.push({
      category: 'other',
      label: 'Other',
      styles: uncategorized,
    });
  }

  return result;
}

export default function StyleSelector({
  styleLibrary,
  selectedArtisticStyleId,
  selectedCompositionStyleId,
  selectedColorPaletteId,
  onArtisticStyleChange,
  onCompositionStyleChange,
  onColorPaletteChange,
  entityKind,
  compact = false,
}) {
  const artisticStyles = styleLibrary?.artisticStyles || [];
  const compositionStyles = styleLibrary?.compositionStyles || [];
  const colorPalettes = styleLibrary?.colorPalettes || [];

  // Filter composition styles based on entity kind (legacy suitableForKinds)
  const filteredCompositionStyles = useMemo(() => {
    if (!entityKind) {
      return compositionStyles;
    }
    return compositionStyles.filter(
      (s) => !s.suitableForKinds || s.suitableForKinds.length === 0 || s.suitableForKinds.includes(entityKind)
    );
  }, [compositionStyles, entityKind]);

  // Group compositions by targetCategory for organized display
  const groupedCompositions = useMemo(() => {
    return groupCompositionsByCategory(filteredCompositionStyles);
  }, [filteredCompositionStyles]);

  const selectedArtistic = artisticStyles.find((s) => s.id === selectedArtisticStyleId);
  const selectedComposition = compositionStyles.find((s) => s.id === selectedCompositionStyleId);
  const selectedColorPalette = colorPalettes.find((s) => s.id === selectedColorPaletteId);

  if (compact) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Style:</span>
        <select
          value={selectedArtisticStyleId || RANDOM_ID}
          onChange={(e) => onArtisticStyleChange(e.target.value || RANDOM_ID)}
          className="illuminator-select"
          style={{ width: 'auto', minWidth: '120px' }}
          title={selectedArtistic?.description || 'Select artistic style'}
        >
          <option value={RANDOM_ID}>Random</option>
          <option value={NONE_ID}>None</option>
          {artisticStyles.map((style) => (
            <option key={style.id} value={style.id}>
              {style.name}
            </option>
          ))}
        </select>

        <select
          value={selectedCompositionStyleId || RANDOM_ID}
          onChange={(e) => onCompositionStyleChange(e.target.value || RANDOM_ID)}
          className="illuminator-select"
          style={{ width: 'auto', minWidth: '120px' }}
          title={selectedComposition?.description || 'Select composition style'}
        >
          <option value={RANDOM_ID}>Random</option>
          <option value={NONE_ID}>None</option>
          {groupedCompositions.map((group) => (
            <optgroup key={group.category} label={group.label}>
              {group.styles.map((style) => (
                <option key={style.id} value={style.id}>
                  {style.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>

        <select
          value={selectedColorPaletteId || RANDOM_ID}
          onChange={(e) => onColorPaletteChange(e.target.value || RANDOM_ID)}
          className="illuminator-select"
          style={{ width: 'auto', minWidth: '120px' }}
          title={selectedColorPalette?.description || 'Select color palette'}
        >
          <option value={RANDOM_ID}>Random</option>
          <option value={NONE_ID}>None</option>
          {colorPalettes.map((palette) => (
            <option key={palette.id} value={palette.id}>
              {palette.name}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: '12px',
      }}
    >
      {/* Artistic Style */}
      <div>
        <label
          style={{
            display: 'block',
            fontSize: '12px',
            color: 'var(--text-muted)',
            marginBottom: '4px',
          }}
        >
          Artistic Style
        </label>
        <select
          value={selectedArtisticStyleId || RANDOM_ID}
          onChange={(e) => onArtisticStyleChange(e.target.value || RANDOM_ID)}
          className="illuminator-select"
        >
          <option value={RANDOM_ID}>Random</option>
          <option value={NONE_ID}>None</option>
          {artisticStyles.map((style) => (
            <option key={style.id} value={style.id}>
              {style.name}
            </option>
          ))}
        </select>
        {selectedArtistic && (
          <div
            style={{
              fontSize: '11px',
              color: 'var(--text-muted)',
              marginTop: '4px',
            }}
          >
            {selectedArtistic.description}
          </div>
        )}
      </div>

      {/* Composition Style */}
      <div>
        <label
          style={{
            display: 'block',
            fontSize: '12px',
            color: 'var(--text-muted)',
            marginBottom: '4px',
          }}
        >
          Composition Style{entityKind && ` (for ${entityKind})`}
        </label>
        <select
          value={selectedCompositionStyleId || RANDOM_ID}
          onChange={(e) => onCompositionStyleChange(e.target.value || RANDOM_ID)}
          className="illuminator-select"
        >
          <option value={RANDOM_ID}>Random</option>
          <option value={NONE_ID}>None</option>
          {groupedCompositions.map((group) => (
            <optgroup key={group.category} label={group.label}>
              {group.styles.map((style) => (
                <option key={style.id} value={style.id}>
                  {style.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {selectedComposition && (
          <div
            style={{
              fontSize: '11px',
              color: 'var(--text-muted)',
              marginTop: '4px',
            }}
          >
            {selectedComposition.description}
          </div>
        )}
      </div>

      {/* Color Palette */}
      <div>
        <label
          style={{
            display: 'block',
            fontSize: '12px',
            color: 'var(--text-muted)',
            marginBottom: '4px',
          }}
        >
          Color Palette
        </label>
        <select
          value={selectedColorPaletteId || RANDOM_ID}
          onChange={(e) => onColorPaletteChange(e.target.value || RANDOM_ID)}
          className="illuminator-select"
        >
          <option value={RANDOM_ID}>Random</option>
          <option value={NONE_ID}>None</option>
          {colorPalettes.map((palette) => (
            <option key={palette.id} value={palette.id}>
              {palette.name}
            </option>
          ))}
        </select>
        {selectedColorPalette && (
          <div
            style={{
              fontSize: '11px',
              color: 'var(--text-muted)',
              marginTop: '4px',
            }}
          >
            {selectedColorPalette.description}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Pick a random element from an array
 * Uses crypto.getRandomValues for better randomness in rapid succession
 */
function pickRandom(arr) {
  if (!arr || arr.length === 0) return null;
  const randomBuffer = new Uint32Array(1);
  crypto.getRandomValues(randomBuffer);
  const randomValue = randomBuffer[0] / (0xFFFFFFFF + 1);
  return arr[Math.floor(randomValue * arr.length)];
}

/**
 * Resolve style selection to actual style definitions
 * Handles culture defaults, random selection, exclusion filtering, and fallbacks
 */
export function resolveStyleSelection({
  selection,
  entityCultureId,
  entityKind,
  cultures,
  styleLibrary,
  exclusionRules = DEFAULT_RANDOM_EXCLUSIONS,
}) {
  const result = {
    artisticStyle: null,
    compositionStyle: null,
    colorPalette: null,
    cultureKeywords: [],
  };

  if (!styleLibrary) return result;

  const artisticStyles = styleLibrary.artisticStyles || [];
  const compositionStyles = styleLibrary.compositionStyles || [];
  const colorPalettes = styleLibrary.colorPalettes || [];
  const rules = exclusionRules || [];

  // Filter composition styles by entity kind
  const filteredCompositionStyles = entityKind
    ? compositionStyles.filter(
        (s) => !s.suitableForKinds || s.suitableForKinds.length === 0 || s.suitableForKinds.includes(entityKind)
      )
    : compositionStyles;

  const styleIsRandom = selection.artisticStyleId === RANDOM_ID || !selection.artisticStyleId;
  const compIsRandom = selection.compositionStyleId === RANDOM_ID || !selection.compositionStyleId;

  if (styleIsRandom && compIsRandom && selection.artisticStyleId !== NONE_ID && selection.compositionStyleId !== NONE_ID) {
    // Both random: pick composition first, then filter styles for that composition
    result.compositionStyle = pickRandom(filteredCompositionStyles);
    if (result.compositionStyle && rules.length > 0) {
      const filteredStyles = filterByExclusion(artisticStyles, result.compositionStyle.id, rules, artisticStyles, compositionStyles, 'style');
      result.artisticStyle = pickRandom(filteredStyles);
    } else {
      result.artisticStyle = pickRandom(artisticStyles);
    }
  } else {
    // Resolve artistic style
    if (selection.artisticStyleId === NONE_ID) {
      result.artisticStyle = null;
    } else if (styleIsRandom) {
      // Style is random, composition is fixed — filter styles for fixed composition
      const fixedCompId = selection.compositionStyleId;
      if (fixedCompId && fixedCompId !== NONE_ID && rules.length > 0) {
        const filteredStyles = filterByExclusion(artisticStyles, fixedCompId, rules, artisticStyles, compositionStyles, 'style');
        result.artisticStyle = pickRandom(filteredStyles);
      } else {
        result.artisticStyle = pickRandom(artisticStyles);
      }
    } else {
      result.artisticStyle = artisticStyles.find(
        (s) => s.id === selection.artisticStyleId
      );
    }

    // Resolve composition style
    if (selection.compositionStyleId === NONE_ID) {
      result.compositionStyle = null;
    } else if (compIsRandom) {
      // Composition is random, style is fixed — filter compositions for fixed style
      const fixedStyleId = selection.artisticStyleId;
      if (fixedStyleId && fixedStyleId !== NONE_ID && rules.length > 0) {
        const filteredComps = filterByExclusion(filteredCompositionStyles, fixedStyleId, rules, artisticStyles, compositionStyles, 'composition');
        result.compositionStyle = pickRandom(filteredComps);
      } else {
        result.compositionStyle = pickRandom(filteredCompositionStyles);
      }
    } else {
      result.compositionStyle = compositionStyles.find(
        (s) => s.id === selection.compositionStyleId
      );
    }
  }

  // Resolve color palette (no culture default for palettes)
  if (selection.colorPaletteId === NONE_ID) {
    result.colorPalette = null;
  } else if (selection.colorPaletteId === RANDOM_ID || !selection.colorPaletteId) {
    result.colorPalette = pickRandom(colorPalettes);
  } else {
    result.colorPalette = colorPalettes.find(
      (p) => p.id === selection.colorPaletteId
    );
  }

  // Get culture style keywords
  const culture = cultures?.find((c) => c.id === entityCultureId);
  if (culture?.styleKeywords?.length > 0) {
    result.cultureKeywords = culture.styleKeywords;
  }

  return result;
}

/**
 * Filter items by exclusion rules.
 * axis: 'style' means we're filtering styles given a fixed compositionId,
 *        'composition' means we're filtering compositions given a fixed styleId.
 */
function filterByExclusion(items, fixedId, rules, artisticStyles, compositionStyles, axis) {
  return items.filter((item) => {
    const styleId = axis === 'style' ? item.id : fixedId;
    const compId = axis === 'style' ? fixedId : item.id;
    return !isExcludedPairLocal(styleId, compId, rules, artisticStyles, compositionStyles);
  });
}

/**
 * Local JS implementation of isExcludedPair (avoids importing TS from world-schema at runtime).
 */
function isExcludedPairLocal(styleId, compositionId, rules, artisticStyles, compositionStyles) {
  for (const rule of rules) {
    const excludedStyles = expandPatterns(rule.styles, artisticStyles, (s) => s.category);
    const excludedComps = expandPatterns(rule.compositions, compositionStyles, (c) => c.targetCategory);
    if (excludedStyles.has(styleId) && excludedComps.has(compositionId)) {
      if (rule.allow?.some(([s, c]) => s === styleId && c === compositionId)) {
        continue;
      }
      return true;
    }
  }
  return false;
}

function expandPatterns(patterns, items, getCategoryFn) {
  const ids = new Set();
  for (const pattern of patterns) {
    if (pattern.startsWith('cat:')) {
      const cat = pattern.slice(4);
      for (const item of items) {
        if (getCategoryFn(item) === cat) {
          ids.add(item.id);
        }
      }
    } else {
      ids.add(pattern);
    }
  }
  return ids;
}

export { RANDOM_ID, NONE_ID };

<!-- drift-generated -->
# ADR-029: Panel CSS Utilities — Shared Structural Patterns

## Status
Accepted

## Context

The Illuminator app contains 20 co-located CSS files for panel and tab components that share ~44% similar CSS declarations. The duplicated patterns include:

- **Section card containers** (bg-secondary, border, border-radius 8px, padding 16px)
- **Overflow containers** (bg-secondary, border, border-radius 8px, overflow hidden)
- **Collapsible header bars** (bg-tertiary, padding 12px 16px, flex layout)
- **Action buttons** (bg-tertiary, border, border-radius 6px, font-size 12px, disabled state)
- **Empty states** (centered text, muted color, padding)
- **Footer action rows** (flex, justify-content flex-end, gap, border-top)
- **Warning/error banners** (amber/red tinted backgrounds with borders)
- **Section labels** (uppercase, muted, 11px, letter-spacing)

Each component file re-declares these patterns with its own prefix (ap-, bcm-, cip-, crp-, etc.), creating maintenance burden and visual inconsistency risk.

## Decision

Extract the most commonly duplicated structural patterns into a shared utility CSS file at `packages/shared-components/src/styles/components/panel-utilities.css`.

Components compose these utilities alongside their prefixed component-specific classes:
```jsx
<div className="ilu-section htab-section">
```

The `ilu-*` class provides the base structural pattern. The component-prefixed class adds or overrides unique properties.

### Shared utility classes

| Class | Pattern | Usage count |
|-------|---------|-------------|
| `.ilu-section` | Padded section card container | ~8 files |
| `.ilu-container` | Overflow-hidden container | ~8 files |
| `.ilu-container-header` | Collapsible header bar | ~6 files |
| `.ilu-action-btn` | Standard action button + disabled | ~10 files |
| `.ilu-empty` | Empty state centered text | ~8 files |
| `.ilu-footer` | Footer action row | ~3 files |
| `.ilu-warning-banner` | Amber warning banner | ~3 files |
| `.ilu-error-banner` | Red error banner | ~3 files |
| `.ilu-section-label` | Uppercase section label | ~4 files |
| `.ilu-selection-bar` | Sticky selection action bar | ~3 files |
| `.ilu-stats-grid` | Auto-fit stats grid layout | ~3 files |
| `.ilu-stat-card` | Stats card container | ~3 files |
| `.ilu-stat-value` | Stats large value text | ~3 files |
| `.ilu-stat-label` | Stats muted label text | ~3 files |
| `.ilu-thumb-cover` | Absolute positioned cover image | ~3 files |
| `.ilu-thumb-placeholder` | Absolute positioned loading placeholder | ~3 files |

## Consequences

**Positive:**
- Single source of truth for structural patterns
- Reduced total CSS size
- Consistent visual appearance across panels
- Easier to update spacing/colors globally

**Negative:**
- Components now have two-class composition (shared + prefixed)
- Need to maintain the shared file as new patterns emerge
- Existing components need gradual migration to use shared classes

## Enforcement

- ESLint rule `local/no-panel-css-duplication` warns when an Illuminator component CSS file contains structural patterns that duplicate panel-utilities.css without referencing the shared classes
- Pattern documentation at `docs/patterns/panel-css-utilities.md`

<!-- drift-generated -->
# ADR-032: Archivist Section CSS Consolidation

**Status:** Accepted
**Date:** 2026-02-28
**Deciders:** tsonu
**Drift area:** css-css-cluster-016 (CSS Duplication: ChainLinkSection, DiscoveryStory, EraNarrative, LoreSection)

## Context

Four archivist components — ChainLinkSection, DiscoveryStory, EraNarrative, and LoreSection — each defined their own CSS for structurally identical patterns: themed content-section containers with header bars (icon + title), serif italic narrative text blocks, modal overlays, close buttons, and footer bars.

The only variation across components was the color scheme (purple, orange, gold, blue). The structural layout properties (display, alignment, padding, border-radius, font styling) were copy-pasted identically across all four CSS files, creating ~42% average similarity.

| Component | Role | Theme Color |
|-----------|------|-------------|
| ChainLinkSection | Inline mystery clue section | Purple |
| DiscoveryStory | Inline + modal discovery narrative | Orange |
| EraNarrative | Modal era-transition narrative | Gold/Blue |
| LoreSection | Inline lore description section | Gold |

Shared duplicated patterns:
- Section container: `margin-top`, `border`, `border-radius`, gradient `background`, `overflow: hidden`
- Header bar: `display: flex`, `align-items: center`, `gap`, `padding`, gradient `background`, `border-bottom`
- Icon: `font-size`, `line-height: 1`
- Title: `font-size`, `font-weight: bold`, `text-transform: uppercase`, `letter-spacing`
- Narrative text: `font-family: var(--font-serif)`, `font-style: italic`
- Modal overlay: `position: fixed`, `inset: 0`, flex centering
- Close button: `padding`, `border-radius`, `font-weight`, `text-transform`, `cursor`, `transition`
- Footer bar: `display: flex`, `align-items: center`, `border-top`

## Decision

Extract shared structural CSS into `archivist-section.css` co-located with the components. Color theming is parameterized through CSS custom properties set on each component's root element.

### Shared Classes

| Class | Purpose |
|-------|---------|
| `.archivist-section` | Content section container |
| `.archivist-section-hdr` | Header bar (icon + title) |
| `.archivist-section-icon` | Section icon |
| `.archivist-section-title` | Section title text |
| `.archivist-narrative` | Serif italic narrative text |
| `.archivist-label` | Uppercase metadata label |
| `.archivist-modal-overlay` | Modal overlay |
| `.archivist-close-btn` | Modal close button |
| `.archivist-section-footer` | Footer bar |

### Custom Property Contract

Components set these on their root element:

| Property | Purpose |
|----------|---------|
| `--_section-border` | Border color for the container |
| `--_section-bg` | Background for the container |
| `--_section-header-bg` | Background for the header bar |
| `--_section-separator` | Color for sub-section borders |
| `--_section-accent` | Color for titles and labels |
| `--_section-text` | Color for narrative body text |

### Composition Pattern

Components compose shared + component-specific classes on each element:

```html
<div class="archivist-section chain-link-section">
  <div class="archivist-section-hdr">
    <span class="archivist-section-icon">🔍</span>
    <span class="archivist-section-title">Mystery Clue</span>
  </div>
  <div class="archivist-narrative chain-link-text">...</div>
</div>
```

## Consequences

### Positive
- Eliminated ~80 lines of duplicated CSS across 4 files
- New archivist section components get structural consistency for free
- Color theming is a single block of custom property definitions per component
- Structural changes propagate automatically to all section components

### Negative
- Components must import two CSS files (`archivist-section.css` + their own)
- Class names in JSX are slightly longer (shared + component class)
- EraNarrative only partially participates (modal header is too different)

## Enforcement

- ESLint rule `local/no-archivist-section-drift` warns when archivist component files import a component CSS file but not `archivist-section.css`
- Pattern documentation: `docs/patterns/archivist-section.md`

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|---------------|
| Keep per-component CSS | Continues the duplication. Each new section component would re-declare the same structural rules. |
| Move shared CSS to `packages/shared-components/` | These styles are archivist-specific (themed content sections for the world browser). Not reusable across other apps. |
| CSS preprocessor mixins | Project doesn't use a CSS preprocessor. Pure CSS custom properties achieve the same parameterization. |
| Single mega-class with modifiers | Would require all components to use the same DOM structure. Current approach allows flexible internal layouts while sharing structural base. |

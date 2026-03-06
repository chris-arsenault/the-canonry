<!-- drift-generated -->
# ADR-039: Shared SVG Visualization Base CSS

## Status
Accepted

## Context
The `ChronicleWizard/visualizations/` directory contains multiple SVG-based visualization
components (EnsembleConstellation, TimelineBrush, NarrativeTimeline, StoryPotentialRadar,
IntensitySparkline, MiniConstellation). Each component independently defined the same
utility CSS rules:

- `display: block` on the SVG container (removes inline-element whitespace gap)
- `pointer-events: none` for overlay text and decorations
- Cursor utilities (`pointer`, `grab`, `ew-resize`)

These were prefixed per-component (`ec-no-pointer`, `tb-grab`, etc.), creating identical
rules under different names.

## Decision
Extract shared SVG visualization utilities into a single `visualization-base.css` file
in the `visualizations/` directory. All visualization components import this file and use
the shared `viz-*` class names:

| Shared class | Purpose |
|---|---|
| `.viz-svg` | SVG container base (`display: block`) |
| `.viz-no-pointer` | Suppress pointer events on overlays |
| `.viz-cursor-pointer` | Pointer cursor for clickable elements |
| `.viz-grab` | Grab cursor for draggable elements |
| `.viz-ew-resize` | East-west resize cursor for handles |

Component-specific SVG styles (background, border-radius, CSS-variable cursors) remain
in the component's own CSS file, which imports `visualization-base.css`.

## Consequences
- One place to update SVG visualization utilities across all components
- Consistent class names make it easier to grep for usage patterns
- New visualization components start by importing `visualization-base.css`
- Component CSS files become smaller — only component-specific overrides

## Enforcement
- ESLint rule `local/no-viz-utility-drift` bans component-prefixed utility class names
  (e.g. `ec-no-pointer`, `tb-grab`) in JSX within the `visualizations/` directory, requiring
  the shared `viz-*` classes instead
- Pattern guide: `docs/patterns/visualization-base-css.md`

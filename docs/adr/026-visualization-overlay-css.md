<!-- drift-generated -->
# ADR-026: Unified Visualization Overlay CSS

## Status
Accepted

## Context
The archivist app has three visualization views — GraphView (2D Cytoscape), GraphView3D (3D force-graph), and TimelineView3D (3D timeline). All three independently defined CSS for the same overlay UI elements:

- **Full-bleed container** (`position: absolute; inset: 0; overflow: hidden`)
- **Legend panel** (gradient background, header, footer, swatch items)
- **Controls panel** (same gradient, header)
- **WebGL fallback** (centered error message for missing WebGL)

Each file used a different class prefix (`gv-*`, `gv3d-*`, `tv3d-*`) and a different CSS custom property for swatch colors (`--gv-swatch-color`, `--gv3d-swatch-color`, `--tv3d-swatch-color`). The only real variation was the color theme: blue for graph views, golden/amber for the timeline view.

This created 57% average CSS similarity across files, with identical structural patterns duplicated three times.

## Decision
Consolidate all shared visualization overlay styles into a single `visualization-overlay.css` file using CSS custom properties for theming.

- **Shared classes** use the `viz-` prefix: `viz-container`, `viz-legend`, `viz-legend-header`, `viz-legend-footer`, `viz-legend-swatch`, `viz-controls`, `viz-controls-header`, `viz-no-webgl`, etc.
- **Theme classes** (`viz-theme-blue`, `viz-theme-golden`) set CSS custom properties (`--viz-panel-start`, `--viz-panel-end`, `--viz-accent-10`, `--viz-accent-05`) on the container element.
- **Swatch color** uses a unified `--viz-swatch-color` CSS variable.
- **Component-specific styles** remain in their own CSS files: shape legend variants in `GraphView.css`, era-specific styles in `TimelineView3D.css`.
- `GraphView3D.css` was deleted entirely (no unique styles remained).

## Consequences
- New visualization views in archivist import `visualization-overlay.css` and pick a theme class.
- Adding a new color theme is a single CSS class definition.
- Per-component CSS files only contain truly component-specific styles.
- The old per-component class prefixes (`gv-wrapper`, `gv-legend`, `gv3d-*`, `tv3d-container`, `tv3d-legend`, etc.) are banned.

## Enforcement
- ESLint rule `local/no-viz-overlay-drift` bans the old per-component overlay CSS class names and CSS variable names in archivist components.
- Pattern guide at `docs/patterns/visualization-overlay.md` documents the canonical usage.

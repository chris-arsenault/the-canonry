<!-- drift-generated -->
# ADR-037: Matrix CSS Consolidation

## Status
Accepted

## Context
Two matrix/spreadsheet-style table components — `WeightMatrixEditor` (coherence-engine) and `CoverageMatrix` (shared-components) — independently implemented the same structural CSS patterns:

- Flex column layout container
- Scrollable table container with dark background and border
- Full-width collapsed table with sticky uppercase headers
- Row hover transitions
- Toolbar with search input
- Legend bar

Both files contained ~120 lines of near-identical structural CSS (40% similarity detected by drift-audit). WeightMatrixEditor used hardcoded values while CoverageMatrix used CSS custom properties with fallbacks that resolved to the same values.

## Decision
Extract the shared structural patterns into `packages/shared-components/src/styles/components/matrix-base.css` using a `mat-` class prefix. Components compose the shared utility classes alongside their component-specific prefixed classes (dual-class pattern), matching the convention established by `panel-utilities.css` (ADR-029).

### Shared utility classes:
| Class | Purpose |
|-------|---------|
| `.mat-layout` | Flex column container at 100% height |
| `.mat-scroll-area` | Flex-growing scrollable table wrapper |
| `.mat-table` | Full-width collapsed table with sticky headers |
| `.mat-row` | Row with hover background transition |
| `.mat-toolbar` | Horizontal toolbar above the matrix |
| `.mat-search` | Dark-themed search input with focus accent |
| `.mat-legend` | Legend bar below the matrix |

### Usage pattern:
```jsx
<div className="mat-layout weight-matrix-editor">
  <div className="mat-toolbar matrix-toolbar">
    <input className="mat-search matrix-search" />
  </div>
  <div className="mat-scroll-area">
    <table className="mat-table matrix-table">
      <tr className="mat-row matrix-row">...</tr>
    </table>
  </div>
  <div className="mat-legend matrix-legend">...</div>
</div>
```

Component-specific CSS files only contain overrides and unique rules (heatmap cells, filter buttons, status badges, etc.).

## Consequences
- **Positive:** ~120 lines of duplicated structural CSS eliminated. Future matrix-style components can reuse `mat-*` classes instead of reimplementing the same patterns.
- **Positive:** Single source of truth for matrix structural styling — changes to spacing, colors, or borders propagate consistently.
- **Negative:** Dual-class pattern adds slight verbosity to JSX class names.
- **Negative:** Both CSS files and JSX files needed changes — not just CSS.

## Enforcement
- ESLint rule `local/no-matrix-css-duplication` detects CSS files that contain 3+ matrix structural patterns without referencing the shared `mat-*` utilities
- Pattern doc: `docs/patterns/matrix-css-base.md`

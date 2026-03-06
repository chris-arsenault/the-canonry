<!-- drift-generated -->
# Matrix CSS Base Pattern

Shared structural CSS for data matrix / spreadsheet-style table components.

**Shared CSS:** `packages/shared-components/src/styles/components/matrix-base.css`
**ADR:** `docs/adr/037-matrix-css-consolidation.md`
**ESLint rule:** `local/no-matrix-css-duplication`

## When to use

Use the `mat-*` utility classes when building any component that displays a data grid or matrix with:
- A scrollable table area
- Sticky column headers
- Row hover effects
- A toolbar with search
- A legend bar

## Available classes

| Class | What it provides |
|-------|-----------------|
| `mat-layout` | `display: flex; flex-direction: column; height: 100%; max-width: 100%` |
| `mat-scroll-area` | `flex: 1; overflow: auto` with dark bg, subtle border, 12px radius |
| `mat-table` | `width: 100%; border-collapse: collapse; font-size: 13px` |
| `mat-table th` | Sticky, dark bg, uppercase 11px headers with letter-spacing |
| `mat-table th, td` | 10px 12px padding, left-aligned, subtle bottom border |
| `mat-row` | `transition: background-color 0.1s` + hover highlight |
| `mat-toolbar` | `display: flex; align-items: center; gap: 12px; margin-bottom: 16px; flex-wrap: wrap` |
| `mat-search` | Dark input with subtle border, focus accent (#f59e0b), placeholder color |
| `mat-legend` | Flex row with 16px gap, 12px 16px padding, dark bg, subtle border, 8px radius |

## Usage pattern (dual-class)

Compose `mat-*` base classes with your component-prefixed classes:

```jsx
<div className="mat-layout my-matrix">
  {/* Header — component-specific, no mat-* class */}
  <div className="my-header">
    <h2 className="my-title">My Matrix</h2>
  </div>

  {/* Toolbar — mat-toolbar provides layout, my-toolbar adds overrides */}
  <div className="mat-toolbar my-toolbar">
    <input className="mat-search my-search" placeholder="Search..." />
    {/* Component-specific toolbar items */}
  </div>

  {/* Scrollable area */}
  <div className="mat-scroll-area">
    <table className="mat-table my-table">
      <thead>
        <tr>
          <th>Column A</th>
          <th>Column B</th>
        </tr>
      </thead>
      <tbody>
        <tr className="mat-row my-row">
          <td>...</td>
          <td>...</td>
        </tr>
      </tbody>
    </table>
  </div>

  {/* Legend */}
  <div className="mat-legend my-legend">
    <span>Legend items here</span>
  </div>
</div>
```

## Component-specific CSS

Your component CSS file should only contain overrides and unique rules:

```css
/**
 * MyMatrix — component-specific styles
 * Structural base provided by mat-* classes from matrix-base.css.
 */

/* Override toolbar gap */
.my-toolbar {
  justify-content: space-between;
  gap: 16px;
}

/* Override search width */
.my-search {
  width: 200px;
}

/* Component-specific column widths */
.my-name-col { min-width: 200px; }
.my-data-col { text-align: center !important; }

/* Component-specific cell styling */
.my-cell { cursor: pointer; }
```

## Existing components using this pattern

- **WeightMatrixEditor** (`apps/coherence-engine/webui/src/components/weight-matrix/`) — heatmap-style weight grid with inline cell editing
- **CoverageMatrix** (`packages/shared-components/src/components/CoverageMatrix/`) — generic coverage/relationship matrix with grouped rows and status badges

<!-- drift-generated -->
# Visualization Base CSS

Shared SVG utility classes for `ChronicleWizard/visualizations/` components.

**File:** `apps/illuminator/webui/src/components/ChronicleWizard/visualizations/visualization-base.css`
**ADR:** [ADR-039](../adr/039-visualization-base-css.md)

## Usage

### 1. Import in your component CSS

```css
/* MyVisualization.css */
@import "./visualization-base.css";

/* Component-specific styles only */
.my-viz-svg {
  background: var(--bg-secondary);
  border-radius: 8px;
}
```

### 2. Use shared class names in JSX

```tsx
import "./MyVisualization.css";

export default function MyVisualization() {
  return (
    <svg className="viz-svg my-viz-svg" width={400} height={300}>
      {/* Clickable node */}
      <g className="viz-cursor-pointer" onClick={handleClick}>
        <circle cx={50} cy={50} r={10} />
      </g>

      {/* Non-interactive overlay text */}
      <text className="viz-no-pointer">Label</text>

      {/* Draggable handle */}
      <rect className="viz-grab" onMouseDown={startDrag} />

      {/* Resize handle */}
      <rect className="viz-ew-resize" onMouseDown={startResize} />
    </svg>
  );
}
```

## Available Classes

| Class | CSS | Purpose |
|---|---|---|
| `.viz-svg` | `display: block` | SVG container base — removes inline whitespace gap |
| `.viz-no-pointer` | `pointer-events: none` | Overlay text, labels, decorations |
| `.viz-cursor-pointer` | `cursor: pointer` | Clickable nodes/elements |
| `.viz-grab` | `cursor: grab` | Draggable selections/regions |
| `.viz-ew-resize` | `cursor: ew-resize` | Horizontal resize handles |

## Rules

- Always combine `viz-svg` with a component-specific class for any SVG-specific overrides (background, border-radius, etc.)
- Do **not** define `display: block`, `pointer-events: none`, or cursor utilities in component CSS — use the shared classes
- Do **not** create component-prefixed copies like `ec-no-pointer` or `tb-grab` — the ESLint rule `local/no-viz-utility-drift` will flag these

## Adding New Utilities

If a new cursor or pointer utility is needed across multiple visualization components, add it to `visualization-base.css` with the `viz-` prefix. Single-component cursors (like TimelineBrush's CSS-variable-driven cursor) stay in the component CSS.

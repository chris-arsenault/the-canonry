<!-- drift-generated -->
# Visualization Overlay CSS Pattern

All archivist visualization views share a common overlay panel pattern for legend, controls, and WebGL fallback UI. These shared styles live in a single file.

## Canonical location

```
apps/archivist/webui/src/components/visualization-overlay.css
```

## Usage

### 1. Import the shared CSS

```tsx
import "./visualization-overlay.css";
// Component-specific CSS (if any) comes after
import "./MyView.css";
```

### 2. Set the container and theme

Wrap your view in a `viz-container` with a theme class:

```tsx
<div className="viz-container viz-theme-blue">
  {/* your visualization content */}
</div>
```

Available themes:
- `viz-theme-blue` — blue/slate gradient (for graph views)
- `viz-theme-golden` — golden/amber gradient (for timeline views)

### 3. Legend panel

```tsx
<div className="absolute bottom-6 left-6 rounded-xl text-white text-sm shadow-2xl border border-blue-500-30 overflow-hidden viz-legend">
  <div className="px-5 py-3 border-b border-blue-500-20 viz-legend-header">
    <div className="font-bold text-blue-200 uppercase tracking-wider text-xs">Legend</div>
  </div>
  <div className="px-5 py-4 space-y-3">
    {items.map((item) => (
      <div key={item.kind} className="flex items-center gap-3">
        <div
          className="w-5 h-5 rounded-full shadow-lg flex-shrink-0 viz-legend-swatch"
          style={{ '--viz-swatch-color': item.color } as React.CSSProperties}
        />
        <span className="font-medium">{item.label}</span>
      </div>
    ))}
  </div>
  <div className="px-5 py-3 border-t border-blue-500-20 viz-legend-footer">
    <div className="text-xs text-blue-300 italic">Size indicates prominence</div>
  </div>
</div>
```

### 4. Controls panel

```tsx
<div className="absolute top-6 left-6 rounded-xl text-white text-xs shadow-2xl border border-blue-500-30 overflow-hidden viz-controls">
  <div className="px-5 py-3 border-b border-blue-500-20 viz-controls-header">
    <div className="font-bold text-blue-200 uppercase tracking-wider">Controls</div>
  </div>
  <div className="px-5 py-3 space-y-2">
    {/* control items */}
  </div>
</div>
```

### 5. WebGL fallback (3D views)

```tsx
if (!webglAvailable) {
  return (
    <div className="viz-no-webgl">
      <div className="viz-no-webgl-inner">
        <div className="viz-no-webgl-icon">&#x1F4A0;</div>
        <div className="viz-no-webgl-title">WebGL not available</div>
        <div className="viz-no-webgl-message">
          3D view requires WebGL. Switch to another view.
        </div>
      </div>
    </div>
  );
}
```

## Adding a new theme

Add a CSS class in `visualization-overlay.css`:

```css
.viz-theme-crimson {
  --viz-panel-start: rgba(95, 30, 30, 0.95);
  --viz-panel-end: rgba(41, 10, 10, 0.95);
  --viz-accent-10: rgba(239, 68, 68, 0.1);
  --viz-accent-05: rgba(239, 68, 68, 0.05);
}
```

## What NOT to do

- Do not create per-component prefixed classes (`gv3d-legend`, `tv3d-controls`, etc.) for overlay panels. Use the shared `viz-*` classes.
- Do not create per-component CSS custom properties for swatch colors. Use `--viz-swatch-color`.
- Component-specific styles that genuinely don't overlap (like shape clip-paths or era-specific markers) belong in the component's own CSS file.

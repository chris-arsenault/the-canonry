<!-- drift-generated -->
# Panel CSS Utilities

Shared structural CSS patterns for Illuminator panel and tab components.

**Location:** `packages/shared-components/src/styles/components/panel-utilities.css`
**ADR:** [ADR-029](../adr/029-panel-css-utilities.md)

## Usage

Compose shared `ilu-*` utility classes alongside component-prefixed classes:

```jsx
// Section card container
<div className="ilu-section htab-section">

// Overflow container with header
<div className="ilu-container ctab-viewer">
  <div className="ilu-container-header ilu-container-header-bordered ctab-viewer-toolbar">

// Action button
<button className="ilu-action-btn vtab-action-btn" disabled={loading}>

// Empty state
<div className="ilu-empty itab-empty">No images available</div>

// Footer with action buttons
<div className="ilu-footer bcm-footer">
  <button className="ilu-footer-btn">Cancel</button>
  <button className="ilu-footer-btn">Save</button>
</div>
```

The `ilu-*` class provides the base structural pattern. The component-prefixed class provides overrides and unique styling.

## Available Classes

### `.ilu-section`
Padded section card with background and border.
```css
padding: 16px;
background: var(--bg-secondary);
border-radius: 8px;
border: 1px solid var(--border-color);
```

### `.ilu-container`
Container without padding, for sections that have a separate header/body.
```css
background: var(--bg-secondary);
border: 1px solid var(--border-color);
border-radius: 8px;
overflow: hidden;
```

### `.ilu-container-header` / `.ilu-container-header-bordered`
Header bar inside a container.
```css
padding: 12px 16px;
background: var(--bg-tertiary);
display: flex;
align-items: center;
/* -bordered adds: border-bottom: 1px solid var(--border-color); */
```

### `.ilu-action-btn` / `.ilu-action-btn-sm`
Action button with built-in disabled state handling.
```css
/* Standard */
padding: 8px 14px;
background: var(--bg-tertiary);
border: 1px solid var(--border-color);
border-radius: 6px;
color: var(--text-secondary);
font-size: 12px;

/* Small variant: padding: 6px 12px; border-radius: 4px; */
```

### `.ilu-empty`
Centered empty state message.
```css
font-size: 13px;
color: var(--text-muted);
padding: 24px;
text-align: center;
```

### `.ilu-footer`
Footer action row for dialogs/panels.
```css
padding: 12px 20px;
border-top: 1px solid var(--border-color);
display: flex;
justify-content: flex-end;
gap: 8px;
```

### `.ilu-warning-banner` / `.ilu-error-banner`
Colored alert banners.

### `.ilu-section-label`
Uppercase section heading label.
```css
font-size: 11px;
color: var(--text-muted);
text-transform: uppercase;
font-weight: 600;
letter-spacing: 0.5px;
```

### `.ilu-selection-bar`
Sticky selection action bar with count and action buttons.
```css
display: flex;
align-items: center;
justify-content: space-between;
padding: 12px 16px;
background: var(--bg-secondary);
border: 1px solid var(--accent-color);
border-radius: 6px;
```

### `.ilu-stats-grid` / `.ilu-stat-card` / `.ilu-stat-value` / `.ilu-stat-label`
Auto-fit grid of stats cards with large value + small label.
```jsx
<div className="ilu-stats-grid">
  <div className="ilu-stat-card">
    <div className="ilu-stat-value">42</div>
    <div className="ilu-stat-label">Total</div>
  </div>
</div>
```

### `.ilu-thumb-cover` / `.ilu-thumb-placeholder`
Absolute positioned cover image and loading placeholder for thumbnail containers.
```jsx
<div className="cip-thumb-container">  {/* position: relative wrapper */}
  {url ? (
    <img src={url} alt={alt} className="ilu-thumb-cover" />
  ) : (
    <div className="ilu-thumb-placeholder">Loading...</div>
  )}
</div>
```

## When to Use

- **New panel/tab component:** Start with `ilu-*` utilities, add component-specific overrides
- **Existing component:** Gradually replace duplicated declarations with `ilu-*` classes
- **Custom pattern:** If a pattern appears in 3+ components, consider adding it to panel-utilities.css

## When NOT to Use

- **One-off layout:** If the pattern is truly unique to one component, keep it co-located
- **Significantly different values:** If padding, colors, or structure differ substantially, keep the component-specific class

<!-- drift-generated -->
# Viewer CSS Patterns

Shared structural patterns for read-only viewer pages. Use these classes from
`packages/shared-components/src/styles/components/viewer.css` instead of defining
component-prefixed copies.

## Page Layout

```html
<div class="viewer-container">
  <div class="viewer-header">
    <h1 class="viewer-title">
      <span>📊</span> Page Title
    </h1>
    <div class="viewer-legend">
      <span class="viewer-legend-item">
        <span class="viewer-legend-dot" style="background:#60a5fa"></span>
        Category A
      </span>
    </div>
  </div>
  <!-- sections go here -->
</div>
```

## Collapsible Section Card

```html
<div class="viewer-section">
  <div class="viewer-section-header" onClick={toggle}>
    <div class="viewer-section-title">
      <span>📦</span> Section Name
      <span class="viewer-section-count">12</span>
    </div>
    <span class={`viewer-expand-icon ${open ? 'viewer-expand-icon-open' : ''}`}>
      ▼
    </span>
  </div>
  {open && (
    <div class="viewer-section-content">
      <!-- items -->
    </div>
  )}
</div>
```

## Data Rows

```html
<div class="viewer-item-row">
  <span class="viewer-item-name">item_name</span>
  <div class="viewer-badge-list">
    <span class="viewer-badge" style="background:rgb(96 165 250/20%); color:#60a5fa">
      generator
    </span>
  </div>
</div>
```

## Tables

```html
<table class="viewer-table">
  <thead>
    <tr>
      <th class="viewer-table-header">Column</th>
    </tr>
  </thead>
  <tbody>
    <tr class="viewer-table-row">
      <td class="viewer-table-cell">Value</td>
    </tr>
  </tbody>
</table>
```

## Empty State

```html
<div class="viewer-empty-state">
  No items to display.
</div>
```

## Customization

If a viewer needs wider layout, override `max-width` on the container:

```css
.my-viewer .viewer-container {
  max-width: 1600px;
}
```

For component-specific badge colors, add additional classes alongside `viewer-badge`:

```css
.my-badge-special {
  background-color: rgb(168 85 247 / 20%);
  color: #a855f7;
}
```

## What NOT to Do

Do not create new component-prefixed copies of these patterns:

```css
/* BAD — reinvents viewer-section */
.my-component-section {
  background-color: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  margin-bottom: var(--spacing-xl);
  overflow: hidden;
}
```

Instead, use `viewer-section` directly and add only the properties that differ.

## Related

- ADR: [030-viewer-css-consolidation](../adr/030-viewer-css-consolidation.md)
- Canonical CSS: `packages/shared-components/src/styles/components/viewer.css`
- ESLint guard: `local/no-viewer-pattern-drift`, `local/no-duplicate-component-css`

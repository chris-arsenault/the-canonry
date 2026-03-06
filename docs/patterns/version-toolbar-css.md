<!-- drift-generated -->
# Version Toolbar CSS Pattern

Shared utility classes for version comparison toolbars in Illuminator — the UI rows containing version selectors, active badges, and action buttons.

**ADR:** [033-version-toolbar-css-consolidation](../adr/033-version-toolbar-css-consolidation.md)
**Source:** `packages/shared-components/src/styles/components/panel-utilities.css`

## Shared Classes

### `.ilu-action-btn` / `.ilu-action-btn-sm`

Compact tertiary action buttons with bg-tertiary background, border, 6px radius. The `-sm` variant has tighter padding (6px 12px vs 8px 14px).

```html
<!-- Standard size (workspace headers) -->
<button className="ilu-action-btn wsh-btn-unpublish">Unpublish</button>

<!-- Compact size (version selectors) -->
<button className="ilu-action-btn-sm hec-make-active-btn">Make Active</button>
```

Both variants include `:disabled` state (`cursor: not-allowed; opacity: 0.6`).

### `.ilu-active-badge`

Green pill badge indicating the active/current version.

```html
<span className="ilu-active-badge">Active</span>
```

Renders as: green text (`#10b981`), green-tinted background, full pill radius.

### `.ilu-compact-select`

Compact select input for version/comparison dropdowns. Sets `width: auto`, `font-size: 12px`, `padding: 4px 6px`. Compose with a component class that provides `min-width`.

```html
<select className="illuminator-select ilu-compact-select cvs-select-version">
  ...
</select>
```

```css
/* Component CSS — only the delta */
.cvs-select-version {
  min-width: 240px;
}
```

## Composition Pattern

Component CSS files keep only the properties unique to that component. Shared structural properties come from the `ilu-*` classes.

```jsx
{/* Button: shared base + component override */}
<button className="ilu-action-btn-sm hec-export-btn">Export</button>
```

```css
/* Component CSS — only margin-left and smaller font override */
.hec-export-btn {
  padding: 4px 10px;
  font-size: 11px;
  margin-left: auto;
}
```

## When to Use

Use these classes when building:
- Version comparison UIs with selector dropdowns and action buttons
- Toolbar rows with compact tertiary buttons
- Active/current state indicators (green pill badge)

## What NOT to Redeclare

Do not create new CSS rules that duplicate these properties:

```css
/* BAD — redeclares ilu-action-btn-sm */
.my-new-btn {
  padding: 6px 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-secondary);
  cursor: pointer;
}

/* BAD — redeclares ilu-active-badge */
.my-active-pill {
  background: rgb(16 185 129 / 15%);
  color: #10b981;
  border-radius: 999px;
}
```

Instead, compose:

```html
<button className="ilu-action-btn-sm my-new-btn">...</button>
<span className="ilu-active-badge">Active</span>
```

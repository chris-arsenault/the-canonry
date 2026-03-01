<!-- drift-generated -->
# Dashboard Section CSS Utilities

Shared utility classes for structuring sub-sections within lore-weave dashboard panels.

## Classes

### `.lw-section-spacer`
Adds vertical separation before a new section within a panel.

```css
.lw-section-spacer {
  margin-top: 16px;
}
```

### `.lw-section-label`
Styles a section heading — small, muted text with bottom margin.

```css
.lw-section-label {
  font-size: 12px;
  color: var(--lw-text-muted);
  margin-bottom: 8px;
}
```

### `.lw-section-label-hint`
Inline hint text within a section label — slightly indented and faded.

```css
.lw-section-label-hint {
  margin-left: 8px;
  opacity: 0.6;
}
```

## Usage

```jsx
<div className="lw-section-spacer">
  <div className="lw-section-label">
    Section Title
    <span className="lw-section-label-hint">(optional hint)</span>
  </div>
  {/* Section content */}
</div>
```

## Location
Defined in `apps/lore-weave/webui/src/App.css` alongside other `lw-` utility classes.

## Do NOT
- Create component-prefixed copies like `.xx-section-spacer` or `.xx-section-label` in per-component CSS files. The ESLint rule `local/no-dashboard-section-drift` will flag this.
- If a component needs a different spacing value, add a component-specific override class that composes with the shared class, rather than redefining the pattern from scratch.

## See Also
- [ADR-034: Dashboard Section CSS Consolidation](../adr/034-dashboard-section-css-consolidation.md)

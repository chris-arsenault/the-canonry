<!-- drift-generated -->
# Schema Editor Shared CSS

Shared utility classes for SchemaEditor sub-components live in
`apps/canonry/webui/src/components/SchemaEditor/schema-editor-shared.css`.

## Available Classes

| Class | Purpose | Properties |
|-------|---------|------------|
| `.se-select-compact` | Compact inline `<select>` | `width: auto; padding: 6px 10px;` |
| `.se-checkbox-sm` | Small checkbox (14×14) | `width: 14px; height: 14px;` |
| `.se-chip-framework` | Disabled chip for framework items | `pointer-events: none; opacity: 0.6;` |

## Usage

Every SchemaEditor sub-component that needs these utilities imports the shared file
**before** its own component CSS:

```jsx
import "./schema-editor-shared.css";
import "./MyEditor.css";
```

Then reference the shared class names in JSX:

```jsx
<select className="input se-select-compact" value={value} onChange={handleChange}>
  ...
</select>

<input type="checkbox" className="se-checkbox-sm" checked={checked} onChange={toggle} />

<div className={`chip ${isFramework ? "se-chip-framework" : ""}`}>
  {label}
</div>
```

## Adding New Shared Classes

If two or more SchemaEditor sub-components need the same CSS rule:

1. Add the rule to `schema-editor-shared.css` with the `se-` prefix
2. Remove the duplicated rules from each component's CSS file
3. Update JSX className references to use the `se-` prefixed name

Only add rules that are **identical** across components. If values differ (e.g.,
different `max-width` on containers), keep them component-local.

## Don't Do This

```css
/* ❌ MyEditor.css — re-declaring a shared utility */
.mye-select-compact {
  width: auto;
  padding: 6px 10px;
}

.mye-chip-framework {
  pointer-events: none;
  opacity: 0.6;
}
```

The ESLint rule `local/no-schema-editor-css-drift` will flag className usage of
component-prefixed versions of shared utilities.

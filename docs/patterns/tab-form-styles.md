<!-- drift-generated -->
# Tab Form Styles

Shared CSS classes for form elements inside coherence-engine tab components (required badges, checkbox labels, hints).

## Location

`apps/coherence-engine/webui/src/styles/components/tab-form.css`

Imported centrally via `styles/index.css` — no per-component import needed.

## Available Classes

| Class | Purpose |
|-------|---------|
| `tab-required-badge` | Small badge next to a title indicating a required field. Adds left margin and 10px font. |
| `tab-checkbox-label` | Flexbox label wrapping a checkbox, label text, and hint. Uses `var(--spacing-md)` gap. |
| `tab-required-hint` | Small 11px hint text explaining what "required" means in context. |

## Usage

```jsx
// In any coherence-engine tab component — NO local CSS import needed

<span className="badge badge-warning tab-required-badge">Required</span>

<label className="tab-checkbox-label">
  <input type="checkbox" checked={isRequired} onChange={...} />
  <span className="label mb-0">Required</span>
  <span className="text-muted tab-required-hint">
    (Action won't execute unless this variable resolves)
  </span>
</label>
```

## Adding New Tab Form Styles

If you need a new shared style for tab forms:

1. Add the class to `styles/components/tab-form.css`
2. Use the `tab-` prefix for the class name
3. It's available immediately in all tab components via the central import

**Do not** create a per-component CSS file in the `tabs/` directory. The ESLint rule `local/no-tab-companion-css` will flag this.

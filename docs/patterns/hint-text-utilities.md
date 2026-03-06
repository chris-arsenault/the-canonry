<!-- drift-generated -->
# Hint Text Utilities

Shared muted hint/description text classes for Illuminator panel and form components.

**Location:** `packages/shared-components/src/styles/components/panel-utilities.css`
**ADR:** [ADR-031](../adr/031-hint-text-css-deduplication.md)

## Available Classes

### `.ilu-hint`
Standard muted description text (12px).
```css
font-size: 12px;
color: var(--text-muted);
```

### `.ilu-hint-sm`
Smaller muted annotation/sub-hint text (11px).
```css
font-size: 11px;
color: var(--text-muted);
```

## Usage

Compose the shared utility class alongside a component-prefixed class. The utility provides typography; the component class provides spacing and layout.

```jsx
{/* Section description — 12px muted, with bottom margin */}
<p className="ilu-hint cfgp-section-desc">
  Improve image generation by chaining multiple AI calls.
</p>

{/* Small hint under a form field — 11px muted, with top margin */}
<p className="ilu-hint-sm cfgp-hint">
  Number of concurrent API calls. Higher = faster but may hit rate limits.
</p>

{/* Inline label — 12px muted, no extra spacing needed */}
<span className="ilu-hint">Style:</span>

{/* Description below a select — 11px muted, with top margin */}
<div className="ilu-hint-sm stsel-description">{style.description}</div>
```

The component CSS file contains only the unique spacing overrides:
```css
/* ConfigPanel.css */
.cfgp-hint {
  margin-top: 4px;
}

.cfgp-section-desc {
  margin-bottom: 16px;
}
```

## When to Use

- **Form field hints** — small text below inputs explaining their purpose
- **Section descriptions** — introductory text below a section heading
- **Annotation labels** — muted labels alongside primary content
- **Status summaries** — secondary text showing counts or sync status

## When NOT to Use

- **Text that isn't muted** — if the text uses a different color (e.g., error red, success green), use `.ilu-status-error`, `.ilu-status-success`, etc.
- **Text at a non-standard size** — if the text is 10px or 13px+, use a component-specific class
- **Bold/uppercase labels** — use `.ilu-section-label` for uppercase section headings instead

## Related Utilities

| Class | Purpose |
|-------|---------|
| `.ilu-hint` | 12px muted text |
| `.ilu-hint-sm` | 11px muted text |
| `.ilu-section-label` | 11px muted uppercase bold label |
| `.ilu-empty` | 13px muted centered empty state |
| `.ilu-status-warning` | Warning amber color |
| `.ilu-status-error` | Error red color |
| `.ilu-status-success` | Success green color |

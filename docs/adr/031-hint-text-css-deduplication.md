<!-- drift-generated -->
# ADR-031: Hint Text CSS Deduplication

## Status
Accepted

## Context
Five Illuminator component CSS files (BulkChronicleAnnotationModal.css, ConfigPanel.css, CostsPanel.css, IlluminatorTabContent.css, StyleSelector.css) each independently declared the same muted hint text pattern: `font-size: 11px/12px; color: var(--text-muted)`. This pattern appeared in 15+ CSS classes across the cluster, always serving the same purpose — secondary descriptive text beneath form fields, section descriptions, and annotation labels.

The duplication meant:
- Changes to hint text styling required updating every component CSS file independently
- New components would copy-paste the pattern from whichever file was open, perpetuating drift
- No single source of truth for what "hint text" looks like

## Decision
Extract the muted hint text pattern into two shared utility classes in `panel-utilities.css`:

- `.ilu-hint` — `font-size: 12px; color: var(--text-muted)` (standard hint/description text)
- `.ilu-hint-sm` — `font-size: 11px; color: var(--text-muted)` (smaller sub-hints and annotations)

Components compose the shared utility class alongside their component-prefixed class in JSX:
```jsx
<p className="ilu-hint cfgp-section-desc">Description text</p>
<p className="ilu-hint-sm cfgp-hint">Smaller hint text</p>
```

The component-prefixed class provides only unique spacing/layout overrides (margins, padding, line-height). The shared utility provides the typography.

Additionally, components that redeclared status colors (`color: #f59e0b`, `color: #ef4444`, `color: #10b981`) were migrated to compose with the existing `.ilu-status-warning`, `.ilu-status-error`, `.ilu-status-success` classes.

## Consequences
- Single source of truth for hint text typography across all Illuminator panels
- Component CSS files are smaller, containing only layout-specific overrides
- New components can immediately use `ilu-hint`/`ilu-hint-sm` without copying patterns
- Consistent visual language enforced by composition rather than convention

## Enforcement
- ESLint rule `local/no-hint-css-duplication` detects when Illuminator component CSS files declare both `font-size: 11px/12px` and `color: var(--text-muted)` within the same rule block, indicating the shared utility should be used instead
- ESLint rule `local/no-panel-css-duplication` (pre-existing) catches broader structural pattern duplication in panel CSS files
- Pattern documentation: `docs/patterns/hint-text-utilities.md`

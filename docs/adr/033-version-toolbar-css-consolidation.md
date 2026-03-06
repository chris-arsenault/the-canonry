<!-- drift-generated -->
# ADR-033: Version Toolbar CSS Consolidation

**Status:** Accepted
**Date:** 2026-02-28
**Deciders:** tsonu
**Drift area:** css-css-cluster-018

## Context

Three Illuminator component CSS files independently declared the same visual patterns for version comparison toolbars:

| File | Buttons | Active Badge | Compact Select | Disabled State |
|------|---------|-------------|----------------|----------------|
| `HistorianEditionComparison.css` | 2 (make-active, export) | yes | 2 (version, compare) | no |
| `ChronicleVersionSelector.css` | 2 (make-active, delete) | yes | 2 (version, compare) | yes |
| `WorkspaceHeader.css` | 3 (unpublish, regenerate, overflow) | no | no | yes |

The duplicated patterns:
- **Compact tertiary button**: `background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-secondary); cursor: pointer;` — with disabled state `cursor: not-allowed; opacity: 0.6;`
- **Active version pill badge**: green background (`rgb(16 185 129 / 15%)`), `#10b981` text, `border-radius: 999px`
- **Compact select**: `width: auto; font-size: 12px; padding: 4px 6px`

The shared `panel-utilities.css` already provided `.ilu-action-btn` and `.ilu-action-btn-sm` for the button pattern, but the badge and select patterns had no shared class.

## Decision

1. Add `.ilu-active-badge` and `.ilu-compact-select` utility classes to `panel-utilities.css`
2. Component CSS files keep only delta overrides (min-width, margin-left, transitions, extra-compact sizing)
3. Components compose shared + component classes: `className="ilu-action-btn-sm hec-make-active-btn"`

### Class Inventory

| Shared Class | Provides | Used By |
|-------------|----------|---------|
| `.ilu-action-btn` | Standard tertiary button (8px 14px) | WorkspaceHeader |
| `.ilu-action-btn-sm` | Compact tertiary button (6px 12px) | HistorianEditionComparison, ChronicleVersionSelector |
| `.ilu-active-badge` | Green active version pill | HistorianEditionComparison, ChronicleVersionSelector |
| `.ilu-compact-select` | Compact select input (12px, 4px 6px) | HistorianEditionComparison, ChronicleVersionSelector |

## Consequences

### Positive
- Eliminated ~50 lines of duplicated CSS across 3 files
- Active badge and compact select patterns now have single source of truth
- Components express only their unique overrides

### Negative
- Component classNames are slightly longer (composing two classes)
- Requires awareness of panel-utilities.css when building new version comparison UIs

## Enforcement

- **ESLint rule:** `local/no-version-toolbar-drift` — detects CSS files that redeclare the active version badge or compact select patterns instead of using the shared classes
- **ESLint rule:** `local/no-panel-css-duplication` — (existing) detects broader panel utility duplication including the action button pattern
- **Pattern documentation:** `docs/patterns/version-toolbar-css.md`

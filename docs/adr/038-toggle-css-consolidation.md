<!-- drift-generated -->
# ADR 038: Toggle CSS Consolidation

## Status
Accepted

## Context
The shared-components package contained two implementations of the same toggle switch pattern:

1. **`toggle.css`** — canonical toggle component with `.toggle`, `.toggle-on`, `.toggle-knob`, `.toggle-disabled`, `.toggle-container`, `.toggle-label`
2. **`actions.css`** — inline duplicate with `.enable-toggle`, `.enable-toggle-on`, `.enable-toggle-knob` (identical rules, different class prefix)

The `enable-toggle` classes in `actions.css` were dead CSS — no JSX component referenced them. They likely originated from an earlier version of the actions editor that was later refactored to use the canonical toggle classes, but the CSS was never cleaned up.

## Decision
Remove the duplicate `.enable-toggle*` rules from `actions.css`. The canonical toggle pattern lives exclusively in `toggle.css`. Any component needing a toggle switch uses the `.toggle` class family.

## Consequences
- `actions.css` is reduced from 159 to 127 lines
- Single source of truth for toggle styling in `toggle.css`
- Future toggle variants (sizes, colors) only need to be added in one place

## Enforcement
- ESLint rule `local/no-toggle-css-drift` flags JSX className values containing non-canonical toggle class names (e.g. `enable-toggle`, `custom-toggle`)
- Pattern doc: [docs/patterns/toggle-css.md](../patterns/toggle-css.md)

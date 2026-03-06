<!-- drift-generated -->
# ADR 040: Cosmographer Editor Shared CSS

## Status
Accepted

## Context
The cosmographer app contains multiple editor components (AxisRegistry, RelationshipEditor, CultureEditor, EntityEditor) that each independently defined identical CSS for common UI patterns: modal overlays, form groups, labels, inputs, buttons, empty states, and page layout (container, header, toolbar). AxisRegistry.css and RelationshipEditor.css had ~46% similarity, with modal, form, and button rules being essentially identical.

This duplication meant:
- Visual inconsistencies crept in (e.g., different background colors for inputs, different delete button red shades)
- Changes to shared patterns required editing multiple files
- New editor components would copy-paste from existing ones, perpetuating drift

## Decision
Extract shared CSS patterns into `apps/cosmographer/webui/src/styles/cosmographer-editor.css` using a `cosmo-*` class namespace. Editor components `@import` the shared CSS and use `cosmo-*` classes for common elements, keeping only component-specific rules in their own CSS files.

### Shared classes
| Category | Classes |
|----------|---------|
| Modal | `cosmo-modal`, `cosmo-modal-content`, `cosmo-modal-title`, `cosmo-modal-actions` |
| Form | `cosmo-form-group`, `cosmo-label`, `cosmo-input`, `cosmo-select`, `cosmo-hint` |
| Buttons | `cosmo-add-btn`, `cosmo-cancel-btn`, `cosmo-save-btn`, `cosmo-delete-btn`, `cosmo-edit-btn` |
| Layout | `cosmo-editor-container`, `cosmo-editor-header`, `cosmo-editor-title`, `cosmo-editor-subtitle`, `cosmo-toolbar`, `cosmo-actions`, `cosmo-count` |
| Other | `cosmo-empty-state`, `cosmo-arrow` |

Component-specific overrides (e.g., modal width, table layout, card list) stay in the component CSS file and use the component's own class prefix.

## Consequences
- Single source of truth for common cosmographer editor styles
- New editors get consistent styling by importing one file and using `cosmo-*` classes
- Component-specific CSS files are smaller and focused on unique layout
- CultureEditor and EntityEditor can adopt the shared CSS in a follow-up pass

## Enforcement
- ESLint rule `local/no-cosmo-editor-drift` bans old per-component class names (`axr-modal`, `axr-form-group`, `re-modal`, `re-form-group`, etc.) in cosmographer component files, requiring use of the shared `cosmo-*` classes instead

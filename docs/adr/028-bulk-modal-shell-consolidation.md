<!-- drift-generated -->
# ADR 028: Bulk Modal Shell Consolidation

## Status
Accepted

## Context
The Illuminator app has multiple "bulk operation" modals (BulkBackportModal, BulkHistorianModal, BulkEraNarrativeModal, BulkChronicleAnnotationModal, BulkFactCoverageModal, BulkToneRankingModal) that share an identical structural shell: overlay backdrop, dialog container with dynamic width, header with title/minimize/status, body with confirming/processing states, footer with confirm/cancel/close buttons, and floating pill lifecycle management.

`BulkOperationShell.jsx` was created to provide this shared shell as a wrapper component with `BulkOperationShell.css` providing the `bulk-*` prefixed CSS classes. Most bulk modals adopted this pattern, rendering only their content-specific body markup as children.

However, `BulkEraNarrativeModal` duplicated the entire shell inline — its own overlay, dialog, header, minimize button, pill management effects, footer buttons, and terminal messages — all with `benm-*` prefixed CSS classes. This duplicated ~80 lines of CSS and ~60 lines of JSX shell logic that was identical in purpose to `BulkOperationShell`.

## Decision
All bulk operation modals MUST use `BulkOperationShell` as their structural wrapper. Each bulk modal provides:
- `pillId`, `title`, `tabId` for identity
- `confirmLabel`, `statusText`, `pillStatusText` for display
- `confirmWidth`, `processWidth` for sizing
- `onConfirm`, `onCancel`, `onClose` handlers
- Content-specific body markup as `children`

The shell handles overlay, dialog sizing, header (title + minimize + status), body wrapper, footer buttons, and pill lifecycle. Terminal messages use `BulkTerminalMessage`, cost uses `BulkCost`, progress uses `BulkProgressBar` — all exported from `BulkOperationShell.jsx`.

Content-specific CSS files (e.g., `BulkEraNarrativeModal.css`) contain ONLY styles for component-unique markup (era lists, tone selectors, step progress, streaming counters). Shell styles (overlay, header, body, footer, terminal messages) are NOT defined in content CSS files.

## Consequences
- New bulk modals get consistent structure automatically
- Pill lifecycle, minimize behavior, and footer button logic are maintained in one place
- Content CSS files are smaller and focused on what's actually unique
- The `benm-overlay`, `benm-modal`, `benm-header`, `benm-footer`, and `benm-terminal-msg-*` CSS classes are permanently banned

## Enforcement
- ESLint rule `local/no-bulk-shell-drift` bans the old `benm-*` shell class names in JSX
- Pattern documentation at `docs/patterns/bulk-modal-shell.md` shows how to use the canonical pattern

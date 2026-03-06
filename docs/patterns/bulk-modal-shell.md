<!-- drift-generated -->
# Bulk Modal Shell Pattern

All bulk operation modals in the Illuminator app use `BulkOperationShell` as their structural wrapper. The shell handles the overlay, dialog container, header, footer, pill lifecycle, and minimize behavior. Each bulk modal provides only its content-specific body markup.

## Architecture

```
BulkOperationShell (shared)
├── Overlay (bulk-overlay)
├── Dialog (bulk-dialog, dynamic width via CSS var)
├── Header (bulk-header: title, minimize btn, status text)
├── Body (bulk-body: confirming/processing states)
│   └── [Your content-specific children go here]
└── Footer (bulk-footer: confirm/cancel/close buttons)
```

## Usage

```jsx
import BulkOperationShell, {
  BulkTerminalMessage,
  BulkCost,
  BulkProgressBar,
  BulkFailedList,
} from "./BulkOperationShell";
import "./MyBulkModal.css";  // content-specific styles only

export default function MyBulkModal({ progress, onConfirm, onCancel, onClose }) {
  const isConfirming = progress?.status === "confirming";
  const isTerminal = /* ... */;

  let statusText;
  if (isConfirming) statusText = `${progress.items.length} items`;
  else if (progress?.status === "running") statusText = "Processing...";
  else if (progress?.status === "complete") statusText = "Complete";
  // ...

  return (
    <BulkOperationShell
      pillId="my-bulk-op"
      title="My Bulk Operation"
      tabId="my-tab"
      progress={progress}
      onConfirm={onConfirm}
      onCancel={onCancel}
      onClose={onClose}
      confirmLabel={`Start (${progress?.totalItems ?? 0} items)`}
      statusText={statusText}
      pillStatusText={progress?.status === "running" ? `${progress.processed}/${progress.total}` : progress?.status}
      confirmWidth="540px"
      processWidth="480px"
    >
      {/* Confirmation screen */}
      {isConfirming && (
        <div className="my-item-list">
          {/* Content-specific confirmation UI */}
        </div>
      )}

      {/* Processing + terminal */}
      {!isConfirming && (
        <>
          <BulkProgressBar processed={progress.processed} total={progress.total} status={progress.status} />

          {progress.status === "complete" && (
            <BulkTerminalMessage status="complete">
              Processed {progress.processed} items.
            </BulkTerminalMessage>
          )}

          <BulkFailedList items={progress.failedItems} />
          <BulkCost cost={progress.totalCost} />
        </>
      )}
    </BulkOperationShell>
  );
}
```

## Shared Components

| Component | CSS Class | Purpose |
|-----------|-----------|---------|
| `BulkOperationShell` | `bulk-overlay`, `bulk-dialog`, `bulk-header`, `bulk-body`, `bulk-footer` | Full modal shell |
| `BulkProgressBar` | `bulk-progress-*` | Progress bar with percent display |
| `BulkTerminalMessage` | `bulk-terminal-msg-*` | Colored complete/cancelled/failed message |
| `BulkFailedList` | `bulk-failed-*` | Scrollable list of failed items |
| `BulkCost` | `bulk-cost` | Right-aligned cost display |

## CSS Guidelines

Content-specific CSS files should:
- Use a unique prefix (e.g., `bbm-` for BulkBackportModal, `bhm-` for BulkHistorianModal)
- Include a header comment stating that shell styles come from BulkOperationShell.css
- NOT define any overlay, dialog, header, body, footer, or terminal message styles
- For section labels, use the shared `bulk-section-label` class

## Examples

See `BulkBackportModal.jsx` and `BulkBackportModal.css` as the reference implementation.

## Related

- [ADR 028: Bulk Modal Shell Consolidation](../adr/028-bulk-modal-shell-consolidation.md)
- Source: `apps/illuminator/webui/src/components/BulkOperationShell.jsx`
- CSS: `apps/illuminator/webui/src/components/BulkOperationShell.css`

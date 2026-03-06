<!-- drift-generated -->
# Error Display Pattern

All operational error display uses the shared `<ErrorMessage>` component from `@the-canonry/shared-components`.

## Import

```jsx
import { ErrorMessage } from '@the-canonry/shared-components';
```

## Basic Usage

```jsx
// Simple error message
{error && <ErrorMessage message={error} />}

// With title
{error && <ErrorMessage title="Upload failed" message={error} />}
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `message` | `string` | Yes | Error message text |
| `title` | `string` | No | Bold heading above the message |
| `className` | `string` | No | Additional CSS class names for context-specific styling |

## Rendered HTML

```html
<div class="error-message" role="alert">
  <div class="error-message-title">Title here</div>
  <div class="error-message-text">Message here</div>
</div>
```

## Context-Specific Styling

Use the `className` prop to apply context-specific CSS without changing the component structure:

```jsx
// Inside a toast container
<ErrorMessage message={error} className="toast-error" />
```

```css
/* Override styling when inside a toast */
.chron-toast .error-message {
  background: transparent;
  padding: 0;
}
```

## Common Patterns

### Conditional render on error state

```jsx
{error && <ErrorMessage message={error} />}
```

### Per-item errors in a list

```jsx
{failedItems.map(item => (
  <ErrorMessage
    key={item.id}
    title={item.name}
    message={item.error || 'Unknown error'}
  />
))}
```

### Inside a full-screen state card

```jsx
<div className="state-card">
  <ErrorMessage title="World data unavailable" message={loadError} />
  <button onClick={onRetry}>Retry</button>
</div>
```

## What NOT to Do

The ESLint rule `local/no-raw-error-div` will warn on these patterns:

```jsx
// BAD: ad-hoc error div with bare CSS class
<div className="error">{error}</div>

// BAD: component-prefixed error class
<div className="imod-error">{error}</div>

// BAD: ad-hoc failed state display
<div className="dgm-failed">{message}</div>
```

## When ErrorMessage Doesn't Apply

- **React render crashes** — use `<ErrorBoundary>` (separate shared component)
- **Form field validation** — inline validation messages next to inputs are a different concern
- **Console/debug errors** — not user-facing, not subject to this pattern

## Reference

- Component source: `packages/shared-components/src/components/ErrorMessage.jsx`
- CSS: `packages/shared-components/src/styles/components/error-message.css`
- ADR: `docs/adr/021-shared-error-display.md`

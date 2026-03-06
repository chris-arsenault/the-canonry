<!-- drift-generated -->
# Centered Message Layout Pattern

Full-screen or section-filling centered messages (empty states, error boundaries, loading placeholders) all compose on the `empty-state` base classes from `packages/shared-components/src/styles/components/empty-state.css`.

## Base Classes

| Class | Purpose |
|---|---|
| `.empty-state` | Flex column, centered, padded container |
| `.empty-state-icon` | Large emoji/icon with reduced opacity |
| `.empty-state-title` | 2xl medium-weight heading |
| `.empty-state-desc` | Muted description, max-width 400px |

## Using the EmptyState Component

For simple empty states, use the shared `<EmptyState>` component directly:

```jsx
import { EmptyState } from '@the-canonry/shared-components';

<EmptyState icon="📦" title="No items yet" description="Create your first item to get started." />
```

## Extending with a Modifier

When a variant needs different visual treatment (error boundaries, loading states), compose on the base:

```jsx
{/* Container: base layout + modifier */}
<div className="empty-state error-boundary">
  {/* Unique sub-element with modifier-specific styling */}
  <div className="error-boundary-icon">!</div>

  {/* Shared title — no need for a modifier class */}
  <div className="empty-state-title">Something went wrong</div>

  {/* Shared description + modifier override */}
  <div className="empty-state-desc error-boundary-message">
    {error.message}
  </div>

  {/* Unique sub-element */}
  <button className="error-boundary-retry">Retry</button>
</div>
```

The modifier CSS file (`error-boundary.css`) contains ONLY overrides and additions:

```css
/* Only error-specific properties — layout comes from empty-state.css */
.error-boundary {
  height: 100%;
  min-height: 200px;
}

.error-boundary-message {
  font-size: var(--font-size-md);  /* smaller than base --font-size-lg */
  word-break: break-word;
}
```

## Rules

- **Never** duplicate the centered flex-column layout in a new CSS file
- **Always** compose on `.empty-state` for the base container
- **Only** put overrides in the modifier CSS — if a property matches the base, delete it
- ESLint rule `local/no-error-boundary-without-base` enforces the composition for error-boundary specifically

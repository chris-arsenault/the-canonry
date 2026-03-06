<!-- drift-generated -->
# ADR 021: Shared Error Display Component

## Status
Accepted

## Context

Error messages were displayed to users via 6 distinct patterns across the monorepo:

1. **Bare CSS class divs** — `<div className="error">` with utility margins (Name Forge, 8 files)
2. **Component-prefixed error classes** — `<div className="imod-error">`, `dgm-failed`, `hrm-failed-message`, etc. (Illuminator, 18 files)
3. **Full-screen state cards** — app-specific centered cards for fatal load errors (Viewer, Archivist, Chronicler)
4. **Toast notifications** — ad-hoc `chron-toast-error` pattern (ChroniclePanel, 3 instances)
5. **Sync status inline** — `itc-sync-status-error` conditional class (IlluminatorTabContent)
6. **Global error banner** — root-level error div (Canonry App.jsx)

This produced visual inconsistency across apps, unstandardized fallback text, varying retry capabilities, and no shared structure for error presentation. Over 40 files independently implemented error display.

## Decision

All operational error display uses the shared `<ErrorMessage>` component from `@the-canonry/shared-components`.

```jsx
import { ErrorMessage } from '@the-canonry/shared-components';

<ErrorMessage message={error} />
<ErrorMessage title="Operation failed" message={error} />
<ErrorMessage message={error} className="my-context-class" />
```

The component renders a `<div className="error-message" role="alert">` with optional title and always-present message text. The `className` prop allows context-specific CSS overrides (e.g., `.chron-toast .error-message` for toast styling).

**This is distinct from `<ErrorBoundary>`**, which handles React render crashes. `<ErrorMessage>` handles operational errors (failed API calls, validation failures, load errors).

## Consequences

- All error display shares consistent HTML structure and `role="alert"` accessibility
- New error display sites import one component instead of inventing CSS classes
- Context-specific styling (toast, card, inline) is achieved via the `className` prop and CSS overrides, not structural divergence
- Full-screen state cards still wrap `<ErrorMessage>` in app-specific card layouts — a shared `<StatusScreen>` could further unify these in the future

## Enforcement

- ESLint rule `local/no-raw-error-div` bans `<div>` elements with "error" or "failed" CSS class names, requiring `<ErrorMessage>` instead
- Pattern guide: `docs/patterns/error-display.md`

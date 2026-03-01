<!-- drift-generated -->
# Remote Shell Layout Pattern

All Module Federation remote entry points share a common sidebar + content layout
provided by `packages/shared-components/src/styles/components/remote-shell.css`.

## Quick Start

```jsx
import "@the-canonry/shared-components/styles";
import "./MyAppRemote.css"; // optional — only if you need accent overrides

export default function MyAppRemote({ activeSection, onSectionChange }) {
  const activeTab = activeSection || "default";
  const setActiveTab = onSectionChange || (() => {});

  return (
    <div className="rs-container my-app-shell">
      <div className="rs-sidebar">
        <nav className="rs-nav">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`rs-nav-button ${
                activeTab === tab.id ? "rs-nav-button-active" : "rs-nav-button-inactive"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
      <div className="rs-main">
        <div className="rs-content">{renderContent()}</div>
      </div>
    </div>
  );
}
```

## Available Classes

| Class | Purpose |
|-------|---------|
| `rs-container` | Full-height flex row — the outermost wrapper |
| `rs-sidebar` | 200px fixed-width sidebar with dark background |
| `rs-nav` | Nav wrapper inside the sidebar (12px padding) |
| `rs-nav-button` | Base button styles (block, full width, rounded) |
| `rs-nav-button-inactive` | Transparent background, light blue text |
| `rs-nav-button-active` | Gradient background, dark text, bold |
| `rs-nav-button-content` | Flex row for button label + optional indicator |
| `rs-status-dot` | 8px circle indicator (e.g., validation status) |
| `rs-main` | Flex-1 content wrapper with hidden overflow |
| `rs-content` | Scrollable content area with 24px padding |
| `rs-placeholder` | Centered empty-state column |
| `rs-placeholder-icon` | 48px icon above the placeholder title |
| `rs-placeholder-title` | 18px white title |
| `rs-placeholder-desc` | 14px light blue description (max 400px) |
| `rs-no-data` | Full-bleed centered empty state (like "No Schema") |
| `rs-no-data-title` | Title inside `rs-no-data` |

## Customising Accent Colors

Override CSS custom properties on a scoping class added to the root container:

```css
/* MyAppRemote.css */
.my-app-shell {
  --rs-active-from: #f59e0b;   /* gradient start for active button */
  --rs-active-to: #fbbf24;     /* gradient end for active button */
  --rs-hover-bg: rgba(245, 158, 11, 0.15);  /* hover background */
  --rs-hover-color: #f59e0b;   /* hover text color */
}
```

If you omit these variables, the defaults are blue (`#60a5fa → #93c5fd`).

## What NOT to Do

Do not create new per-app class prefixes for the shell layout:

```jsx
// BAD — will trigger local/no-remote-shell-drift
<div className="myapp-container">
<div className="myapp-sidebar">

// GOOD
<div className="rs-container myapp-shell">
<div className="rs-sidebar">
```

See [ADR-027](../adr/027-remote-shell-css.md) for the rationale.

<!-- drift-generated -->
# App.css Arctic Theme Base Pattern

## Overview
All MFE apps that use the Arctic Blue theme share a common base of design
tokens, CSS reset, and body styles. This base lives in a single shared file.
Each app imports it and only overrides accent-specific variables.

## Shared base location
```
packages/shared-components/src/styles/arctic-theme-base.css
```

## How to use in a new app

### 1. Add the import at the top of your App.css
```css
/* Arctic Blue Theme — Shared base */
@import "@the-canonry/shared-components/styles/arctic-theme-base";

/* MyApp accent overrides */
:root {
  --accent-color: #your-accent;
  --accent-hover: #your-accent-lighter;

  /* Buttons */
  --button-primary: #your-accent;
  --button-primary-hover: #your-accent-lighter;

  /* Shared-components canonical overrides */
  --color-accent: #your-accent;
  --color-accent-light: #your-accent-lighter;
  --gradient-accent: linear-gradient(135deg, #your-accent 0%, #your-accent-lighter 100%);
}

/* App-specific component styles below... */
```

### 2. Ensure your package.json depends on shared-components
```json
{
  "dependencies": {
    "@the-canonry/shared-components": "workspace:*"
  }
}
```

## What the shared base provides
These variables are available after importing `arctic-theme-base`:

| Category | Variables |
|----------|-----------|
| Backgrounds | `--bg-primary`, `--bg-secondary`, `--bg-tertiary`, `--bg-sidebar` |
| Borders | `--border-color`, `--border-light` |
| Text | `--text-color`, `--text-secondary`, `--text-muted` |
| Arctic palette | `--arctic-deep`, `--arctic-dark`, `--arctic-mid`, `--arctic-ice`, `--arctic-frost`, `--arctic-light` |
| Spacing | `--space-xs` (4px), `--space-sm` (8px), `--space-md` (12px), `--space-lg` (16px), `--space-xl` (24px) |
| Font sizes | `--text-xs` (11px), `--text-sm` (12px), `--text-base` (13px), `--text-lg` (14px), `--text-xl` (16px), `--text-2xl` (20px) |
| Component colors | `--card-bg`, `--card-border`, `--input-bg` |
| Semantic colors | `--danger`, `--success`, `--warning` |

Plus a CSS reset and body styles.

## What to override per-app
Only accent and button colors. See the existing apps for examples:
- **Illuminator** (`apps/illuminator/webui/src/App.css`): purple accent
- **Name Forge** (`apps/name-forge/webui/src/App.css`): gold accent

## Do NOT
- Copy the shared base variables into your App.css — import the shared file
- Redefine `--bg-primary`, `--border-color`, `--text-color`, etc. locally
- Add reset/body styles — they come from the shared base

The ESLint rule `drift-guard/no-app-css-base-duplication` will warn if an
App.css redefines shared base variables without importing the shared file.

<!-- drift-generated -->
# Toggle Switch CSS Pattern

## Canonical Location
`packages/shared-components/src/styles/components/toggle.css`

## Available Classes

| Class | Purpose |
|-------|---------|
| `.toggle` | Base toggle switch (36×20px, rounded, gray background) |
| `.toggle-on` | Active state (green background via `--color-success`) |
| `.toggle-disabled` | Disabled state (50% opacity, `not-allowed` cursor) |
| `.toggle-knob` | The sliding knob element (16×16px white circle) |
| `.toggle-container` | Flex wrapper for toggle + label |
| `.toggle-label` | Text label next to toggle |

## Usage

```jsx
<div
  className={`toggle ${enabled ? 'toggle-on' : ''}`}
  onClick={() => setEnabled(!enabled)}
  role="switch"
  aria-checked={enabled}
>
  <div className="toggle-knob" />
</div>
```

With label:
```jsx
<div className="toggle-container">
  <div
    className={`toggle ${enabled ? 'toggle-on' : ''} ${disabled ? 'toggle-disabled' : ''}`}
    onClick={disabled ? undefined : () => setEnabled(!enabled)}
    role="switch"
    aria-checked={enabled}
  >
    <div className="toggle-knob" />
  </div>
  <span className="toggle-label">Enable feature</span>
</div>
```

## Rules

- **Do NOT** create new toggle CSS classes with prefixes like `enable-toggle`, `custom-toggle`, etc.
- **Do NOT** add toggle styling to component-specific CSS files — extend `toggle.css` if needed.
- The canonical classes are imported globally via `shared-components/src/styles/index.css`.

## Enforcement
ESLint rule `local/no-toggle-css-drift` flags non-canonical toggle class names in JSX.
See [ADR 038](../adr/038-toggle-css-consolidation.md).

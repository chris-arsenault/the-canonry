<!-- drift-generated -->
# Archivist Section Pattern Guide

**ADR:** [032-archivist-section-css-consolidation](../adr/032-archivist-section-css-consolidation.md)
**ESLint rule:** `local/no-archivist-section-drift` (warn)

## Quick Rules

1. **Import `archivist-section.css`** in every archivist content-section component
2. **Use shared structural classes** for containers, headers, icons, titles, and narrative text
3. **Set color custom properties** on the component's root element
4. **Keep component-specific CSS** only for unique layout/behavior rules

## Shared Classes

| Class | Element | Provides |
|-------|---------|----------|
| `.archivist-section` | Root container | margin, border, radius, background, overflow |
| `.archivist-section-hdr` | Header bar | flex row, padding, background, border-bottom |
| `.archivist-section-icon` | Icon span | font-size, line-height |
| `.archivist-section-title` | Title span | font-size, bold, uppercase, letter-spacing, color |
| `.archivist-narrative` | Text block | serif font, italic, color |
| `.archivist-label` | Meta label | semibold, uppercase, letter-spacing, color |
| `.archivist-modal-overlay` | Modal backdrop | fixed position, flex centering, padding |
| `.archivist-close-btn` | Close button | padding, radius, font, uppercase, transition |
| `.archivist-section-footer` | Footer bar | flex row, border-top |

## Custom Property Contract

Set these on the root element (they cascade to children):

```css
.my-component {
  --_section-border: var(--color-bg-purple-border);
  --_section-bg: linear-gradient(...);
  --_section-header-bg: linear-gradient(...);
  --_section-separator: rgb(139 92 246 / 20%);
  --_section-accent: var(--color-purple-300);
  --_section-text: var(--color-purple-100);
}
```

## Creating a New Archivist Section Component

### 1. Import both CSS files

```tsx
import "./archivist-section.css";
import "./MySection.css";
```

### 2. Use shared + component classes

```tsx
export default function MySection({ data }) {
  return (
    <div className="archivist-section my-section">
      <div className="archivist-section-hdr">
        <span className="archivist-section-icon">🏛️</span>
        <span className="archivist-section-title">Section Title</span>
      </div>
      <div className="archivist-narrative my-section-content">
        {data.text}
      </div>
    </div>
  );
}
```

### 3. Component CSS: only color values and unique rules

```css
/* MySection.css */

.my-section {
  --_section-border: var(--color-bg-green-border);
  --_section-bg: linear-gradient(135deg, rgb(34 197 94 / 5%) 0%, rgb(22 163 74 / 5%) 100%);
  --_section-header-bg: linear-gradient(135deg, rgb(34 197 94 / 15%) 0%, rgb(22 163 74 / 15%) 100%);
  --_section-separator: rgb(34 197 94 / 20%);
  --_section-accent: var(--color-green-300);
  --_section-text: var(--color-green-200);
}

.my-section-content {
  padding: var(--spacing-lg);
  font-size: var(--font-size-base);
  line-height: var(--line-height-relaxed);
}
```

## Modal Components

For modal archivist components (like EraNarrative):

```tsx
<div className="archivist-modal-overlay my-modal-overlay">
  <div className="my-modal-content">
    {/* component-specific modal interior */}
    <div className="archivist-narrative my-modal-text">{text}</div>
    <div className="archivist-section-footer my-modal-footer">
      <button className="archivist-close-btn my-modal-close">Close</button>
    </div>
  </div>
</div>
```

The component CSS provides overlay background/z-index, close button colors, and footer layout:

```css
.my-modal-overlay {
  background: rgb(0 0 0 / 75%);
  z-index: var(--z-modal-overlay);
}

.my-modal-close {
  background: var(--gradient-accent-blue);
  border: 1px solid var(--color-border-strong);
  color: var(--color-blue-200);
}
```

## What NOT To Do

```css
/* BAD: re-declaring structural properties already in archivist-section.css */
.my-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-md) var(--spacing-lg);
}

/* GOOD: use the shared class, add only unique properties */
.my-header {
  /* nothing needed — .archivist-section-hdr handles it */
}
```

```tsx
{/* BAD: only component-specific class */}
<div className="my-section-header">

{/* GOOD: shared class, optionally with component class for overrides */}
<div className="archivist-section-hdr">
```

## Reference Implementations

- `ChainLinkSection.tsx` / `ChainLinkSection.css` — purple-themed inline section
- `LoreSection.tsx` / `LoreSection.css` — gold-themed inline section (simplest example)
- `DiscoveryStory.tsx` / `DiscoveryStory.css` — orange-themed section with modal mode
- `EraNarrative.tsx` / `EraNarrative.css` — modal with shared overlay/close/footer

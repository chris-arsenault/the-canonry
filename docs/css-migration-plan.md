# CSS Migration Plan: Inline Styles to CSS Modules

## Current State Analysis

### Summary Table

| App | CSS Files | Inline `style={{}}` | Style Objects | CSS Coverage | Migration Priority |
|-----|-----------|---------------------|---------------|--------------|-------------------|
| Viewer | 1 (474 lines) | 8 | 0 | 98% | Low - cleanup only |
| Archivist | 13 (2,863 lines) | 54 | 0 | 95% | Low - already good |
| Chronicler | 0 | 387 | 10 components | 0% | **Critical** |
| Canonry | 0 | 179 | 8 components | 10% | Medium |

### Detailed Findings

#### Viewer (`apps/viewer/webui/src/`)
- **Status**: Well-architected
- **CSS**: Single `styles.css` (474 lines) with CSS variables
- **Theme**: CSS custom properties at `:root`
- **Inline styles**: 8 occurrences (error states only)
- **Action**: Minor cleanup, ensure CSS modules for new components

#### Archivist (`apps/archivist/webui/src/`)
- **Status**: Well-architected
- **CSS**: 13 component-scoped CSS files (2,863+ lines total)
- **Components with CSS**:
  - EntityDetail.tsx + EntityDetail.css
  - FilterPanel.tsx + FilterPanel.css
  - TimelineControl.tsx + TimelineControl.css
  - StatsPanel.tsx + StatsPanel.css
  - CoordinateMapView.tsx + CoordinateMapView.css
  - DiscoveryStory.tsx + DiscoveryStory.css
  - ChainLinkSection.tsx + ChainLinkSection.css
  - RelationshipStoryModal.tsx + RelationshipStoryModal.css
  - EraNarrative.tsx + EraNarrative.css
  - HeaderMenu.tsx + HeaderMenu.css
  - LoreSection.tsx + LoreSection.css
  - WorldExplorer.tsx + WorldExplorer.css
  - index.css (global, 561 lines)
- **Inline styles**: 54 occurrences (acceptable)
- **Action**: Convert to CSS modules for scoping, consolidate theme variables

#### Chronicler (`apps/chronicler/webui/src/`)
- **Status**: Critical - full inline dependency
- **CSS**: None
- **Inline style objects** (10 components):
  1. WikiExplorer.tsx - ~200 lines of styles
  2. WikiPage.tsx - ~300 lines of styles
  3. WikiNav.tsx - ~90 lines of styles
  4. ChronicleIndex.tsx - ~80 lines of styles
  5. EntityTimeline.tsx - ~100 lines of styles
  6. ProminenceTimeline.tsx - ~80 lines of styles
  7. ConfluxesIndex.tsx - ~60 lines of styles
  8. HuddlesIndex.tsx - ~60 lines of styles
  9. WikiSearch.tsx - ~50 lines of styles
  10. ChronicleSeedViewer.tsx - ~80 lines of styles
  11. ImageLightbox.tsx - ~50 lines of styles
- **Color duplication**: `colors` object repeated in 4+ files
- **Total inline**: ~1,200-1,500 lines
- **Action**: Full migration to CSS modules

#### Canonry (`apps/canonry/webui/src/`)
- **Status**: Partially organized
- **CSS**: None (theme.js provides constants)
- **Theme file**: `theme.js` (281 lines) - well-structured
- **Inline style objects** (8+ components):
  1. App.jsx
  2. LandingPage.jsx
  3. ProjectManager.jsx
  4. SlotSelector.jsx
  5. HelpModal.jsx
  6. ValidationPopover.jsx
  7. TracePopover.jsx
  8. SchemaEditor/index.jsx
- **Total inline**: ~800-1,000 lines
- **Action**: Migrate to CSS modules, convert theme.js to CSS variables

---

## Migration Strategy

### Target Architecture: CSS Modules

```
apps/{app}/webui/src/
├── styles/
│   └── variables.css       # Shared CSS variables (colors, spacing, typography)
├── components/
│   ├── Component.tsx
│   └── Component.module.css
```

### Why CSS Modules?
1. **Scoped by default** - No class name collisions
2. **No runtime overhead** - Compiled at build time
3. **Vite native support** - Zero configuration
4. **TypeScript friendly** - Can generate type definitions
5. **Gradual migration** - Can coexist with existing styles

### Shared Variables Structure

```css
/* styles/variables.css */
:root {
  /* Colors - Arctic theme */
  --color-bg-primary: #0a1929;
  --color-bg-secondary: #1e3a5f;
  --color-bg-tertiary: #2d4a6f;
  --color-bg-sidebar: #0c1f2e;

  --color-border: rgba(59, 130, 246, 0.3);
  --color-border-light: rgba(59, 130, 246, 0.15);

  --color-text-primary: #ffffff;
  --color-text-secondary: #93c5fd;
  --color-text-muted: #60a5fa;

  --color-accent: #10b981;
  --color-accent-light: #34d399;
  --color-danger: #ef4444;
  --color-warning: #f59e0b;
  --color-success: #22c55e;

  /* Typography */
  --font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  --font-size-xs: 11px;
  --font-size-sm: 12px;
  --font-size-base: 13px;
  --font-size-md: 14px;
  --font-size-lg: 16px;
  --font-size-xl: 18px;
  --font-size-2xl: 24px;
  --font-size-3xl: 28px;

  /* Spacing */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 12px;
  --spacing-lg: 16px;
  --spacing-xl: 24px;
  --spacing-2xl: 32px;

  /* Border radius */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-xl: 12px;

  /* Shadows */
  --shadow-sm: 0 2px 4px rgba(0, 0, 0, 0.2);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.3);
  --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.4);

  /* Transitions */
  --transition-fast: 0.15s ease;
  --transition-base: 0.2s ease;
  --transition-slow: 0.3s ease;

  /* Breakpoints (for reference, use in media queries) */
  --breakpoint-mobile: 640px;
  --breakpoint-tablet: 1024px;
}
```

---

## Implementation Order

### Phase 1: Foundation
1. Create shared `styles/variables.css` for chronicler
2. Create shared `styles/variables.css` for canonry (or convert theme.js)

### Phase 2: Chronicler Migration (Critical)
1. WikiExplorer.tsx → WikiExplorer.module.css
2. WikiPage.tsx → WikiPage.module.css
3. WikiNav.tsx → WikiNav.module.css
4. ChronicleIndex.tsx → ChronicleIndex.module.css
5. EntityTimeline.tsx → EntityTimeline.module.css
6. ProminenceTimeline.tsx → ProminenceTimeline.module.css
7. ConfluxesIndex.tsx → ConfluxesIndex.module.css
8. HuddlesIndex.tsx → HuddlesIndex.module.css
9. WikiSearch.tsx → WikiSearch.module.css
10. ChronicleSeedViewer.tsx → ChronicleSeedViewer.module.css
11. ImageLightbox.tsx → ImageLightbox.module.css

### Phase 3: Canonry Migration (Medium)
1. Convert theme.js to CSS variables
2. App.jsx → App.module.css
3. LandingPage.jsx → LandingPage.module.css
4. ProjectManager.jsx → ProjectManager.module.css
5. SlotSelector.jsx → SlotSelector.module.css
6. HelpModal.jsx → HelpModal.module.css
7. Other components as needed

### Phase 4: Viewer Cleanup (Low)
1. Remove remaining inline styles from App.jsx
2. Ensure CSS variable consistency

### Phase 5: Archivist Cleanup (Low)
1. Convert existing .css to .module.css for scoping
2. Extract shared variables to variables.css

---

## Migration Checklist

### For Each Component:
- [ ] Create `Component.module.css`
- [ ] Import CSS module: `import styles from './Component.module.css'`
- [ ] Convert `const styles = {...}` object to CSS classes
- [ ] Replace `style={styles.x}` with `className={styles.x}`
- [ ] Replace inline `style={{...}}` with CSS classes
- [ ] Use CSS variables for colors/spacing
- [ ] Remove unused style definitions
- [ ] Test component renders correctly
- [ ] Test responsive behavior

### Quality Checks:
- [ ] No hardcoded color values (use variables)
- [ ] No hardcoded spacing values (use variables)
- [ ] Consistent naming convention (camelCase for module classes)
- [ ] No duplicate class definitions
- [ ] Responsive styles use consistent breakpoints

---

## Notes

- CSS Modules use camelCase class names by default
- Vite automatically scopes `.module.css` files
- Global styles can still use regular `.css` files
- Variables defined in `:root` are globally available

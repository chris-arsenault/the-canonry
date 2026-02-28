# Drift Audit Report

Generated: 2026-02-26
Project: penguin-tales (the-canonry)
Source files scanned: ~821 (ts/tsx/js/jsx)
Drift areas found: 12

## Executive Summary

The codebase exhibits a clear **two-cohort split**: archivist and chronicler were scaffolded with newer tooling (vite 7, strict TS, independent ESLint configs) while the other 7 apps remain on older versions. This creates systematic drift in dependencies, build config, and linting coverage. The most impactful structural drift is in **modal implementations** (5/38 use the shared ModalShell), **CSS theming** (4 separate variable systems), and **ESLint configuration** (2 apps bypass root quality rules entirely).

Quick wins: deleting redundant ESLint deps, removing the dead useLocalInputState copy, and aligning dependency version specifiers.

## Priority Matrix

| # | Area | Impact | Variants | Files | Notes |
|---|------|--------|----------|-------|-------|
| 1 | Dependency Version Two-Cohort Split | HIGH | 2 | 20 | vite 6.x vs 7.x across all apps |
| 2 | ESLint Configuration Fragmentation | HIGH | 3 | 8 | 2 apps bypass root rules entirely |
| 3 | Modal Implementation Drift | HIGH | 2 | 38 | 13% ModalShell adoption |
| 4 | CSS Theming and Styling Approach | HIGH | 4 | 136 | 4 separate CSS variable systems |
| 5 | Shared Hook Divergence | MEDIUM | 2 | 6 | useEditorState feature divergence |
| 6 | TypeScript Migration Inconsistency | MEDIUM | 3 | 14 | strict:false in largest app |
| 7 | Shared Component Adoption Gap | MEDIUM | 2 | 25 | Only 2/9 apps use shared lib heavily |
| 8 | State Management Approach Drift | MEDIUM | 3 | 20 | Zustand vs 30+ useState mega-component |
| 9 | Image Store Bypass | MEDIUM | 2 | 4 | Illuminator bypasses shared image-store |
| 10 | Module Federation Shared Deps | MEDIUM | 2 | 9 | Inconsistent shared dep declarations |
| 11 | Directory Naming Conventions | LOW | 3 | 40 | PascalCase vs kebab-case vs lowercase |
| 12 | Duplicate Cross-App Components | LOW | 2 | 4 | ChronicleSeedViewer in 2 apps |

## Detailed Findings

### 1. Dependency Version Two-Cohort Split
**Variants found:** 2 | **Impact:** HIGH | **Files affected:** 20

**Variant A: "Older Cohort" (7 apps)**
- vite ^6.4.1, @vitejs/plugin-react ^4.5.0, @module-federation/vite ^1.1.0
- react ^19.0.0, TypeScript ^5.3.0 through ^5.7.2 (or not declared)
- Representative: `apps/canonry/webui/package.json`

**Variant B: "Newer Cohort" (2 apps: archivist, chronicler)**
- vite ^7.2.4, @vitejs/plugin-react ^5.1.1, @module-federation/vite ^1.3.1
- react ^19.2.0, TypeScript ~5.9.3
- Representative: `apps/archivist/webui/package.json`

**Analysis:** The vite 6.x/7.x split is the highest-risk drift since different bundler major versions can produce incompatible module federation outputs. Upgrading the 7 older apps to match would eliminate 6+ distinct version mismatches in one sweep.

---

### 2. ESLint Configuration Fragmentation
**Variants found:** 3 | **Impact:** HIGH | **Files affected:** 8

**Variant A: "Root config only" (4 apps)**
- Full coverage: typescript-eslint, SonarJS, jsx-a11y, complexity limits, custom rules
- Representative: `apps/coherence-engine/webui/`

**Variant B: "Independent app config" (2 apps: archivist, name-forge)**
- Own `eslint.config.js` that bypasses root rules
- Missing: jsx-a11y, SonarJS, complexity limits, custom rules (max-jsx-props, no-inline-styles)
- Representative: `apps/archivist/webui/eslint.config.js`

**Variant C: "Redundant deps only" (canonry, viewer)**
- No config file but declare eslint devDependencies at different versions from root
- eslint-plugin-react-hooks v5 vs root's v7 (breaking API change)

**Analysis:** The independent configs are likely create-vite scaffolding artifacts. Since the root config runs via turbo, per-app configs and eslint devDependencies should be deleted.

---

### 3. Modal Implementation Drift
**Variants found:** 2 | **Impact:** HIGH | **Files affected:** 38

**Variant A: "Shared ModalShell" (5 files)**
- Uses `<ModalShell>` from @penguin-tales/shared-components
- Overlay click-close, header with icon/title, optional tabbed sidebar
- coherence-engine: 3 files, name-forge: 2 files

**Variant B: "Hand-Rolled Overlay" (33+ files)**
- Each component implements its own overlay div + mouseDown close handler
- 33+ unique CSS class prefixes (srm-, rfm-, qcm-, imod-, etc.)
- Illuminator alone: ~25 independent implementations
- Strengths: Some have features ModalShell lacks (full-bleed, keyboard trap)

**Analysis:** ModalShell has only 13% adoption. The hand-rolled modals aren't inferior — many have legitimate features — but the overlay close-logic duplication across 33+ files is pure structural drift. ModalShell needs feature extensions to become a universal base.

---

### 4. CSS Theming and Styling Approach Drift
**Variants found:** 4 | **Impact:** HIGH | **Files affected:** 136

**Variant A: Plain CSS + shared-components vars** (32 files)
- `--color-bg`, `--color-text`, `--spacing-*`, `--font-size-*`

**Variant B: Plain CSS + illuminator vars** (66 files)
- `--bg-primary`, `--text-color`, `--space-*`, `--text-sm` — different naming

**Variant C: CSS Modules + chronicler vars** (13 files)
- `--color-bg-primary` with warm brown palette, serif fonts

**Variant D: JS inline styles + canonry theme** (25 files)
- `colors.bgPrimary`, `typography.sizeLg` — JS object, no CSS variables

**Analysis:** Each app's palette is intentionally different. The drift is in the **naming** of the variables, not the values. Illuminator's 66 files using non-standard variable names are the biggest target. Standardizing names while keeping per-app palettes would let shared components theme reliably.

---

### 5. Shared Hook Divergence
**Variants found:** 2 | **Impact:** MEDIUM | **Files affected:** 6

- `useLocalInputState`: coherence-engine copy is byte-for-byte identical to shared — dead drift, delete it.
- `useEditorState`: coherence-engine version adds localStorage persistence via `selectedId`/`persistKey`. Shared version tracks by `selectedIndex` with no persistence.

**Analysis:** Backport persistence to shared package, delete both local copies.

---

### 6. TypeScript Migration Inconsistency
**Variants found:** 3 | **Impact:** MEDIUM | **Files affected:** 14

- 7 webui apps are pure JavaScript with PropTypes
- 2 apps (archivist, chronicler) are pure TypeScript with strict mode + extra strict flags
- 1 app (illuminator) is mid-migration: strict:false, allowJs:true, 192 TS + 81 JS files
- Three different module/moduleResolution strategies across tsconfigs
- lore-weave overrides noImplicitAny:false despite strict:true

**Analysis:** The JS-to-TS migration doesn't need forcing. But standardize module/moduleResolution to ESNext/bundler for all vite apps, and fix lore-weave's noImplicitAny:false.

---

### 7. Shared Component Adoption Gap
**Variants found:** 2 | **Impact:** MEDIUM | **Files affected:** 25

- Heavy adoption: coherence-engine, name-forge
- Minimal/no adoption: illuminator (1 component), archivist (0), chronicler (0), lore-weave (1), viewer (0)

**Analysis:** The shared library was designed around coherence-engine's needs. Focus ModalShell adoption (see area #3) and form primitives rather than forcing wholesale adoption.

---

### 8. State Management Approach Drift
**Variants found:** 3 | **Impact:** MEDIUM | **Files affected:** 20

- **Zustand** (illuminator: 15 stores, shared packages, archivist, chronicler, viewer)
- **30+ useState mega-component** (canonry App.jsx)
- **Prop drilling + localStorage** (coherence-engine)

**Analysis:** Zustand is the de facto standard. Canonry's mega-useState is a legacy pattern. Coherence-engine's prop drilling is architecturally sound for a MFE remote.

---

### 9. Image Store Bypass in Illuminator
**Variants found:** 2 | **Impact:** MEDIUM | **Files affected:** 4

- Shared `@penguin-tales/image-store`: returns `{url, loading}`
- Illuminator's local useImageUrl: returns `{url, loading, error, metadata}` — richer

**Analysis:** Backport richer return shape to shared package, migrate illuminator.

---

### 10. Module Federation Shared Dependencies Mismatch
**Variants found:** 2 | **Impact:** MEDIUM | **Files affected:** 9

- 4 remotes share only react/react-dom
- 3 remotes share additional packages (zustand, image-store, world-store)
- onwarn boilerplate duplicated across 8 configs

**Analysis:** Extract shared federation config into workspace-level utility.

---

### 11. Directory Naming Conventions
**Impact:** LOW | Not worth retroactive unification. Establish PascalCase for new component dirs.

---

### 12. Duplicate Cross-App Components
**Impact:** LOW | ChronicleSeedViewer exists in both chronicler and illuminator. Move to shared.

---

## Behavioral Findings

### B1. Modal Close Behavior Inconsistency
**Domain:** Modal/Dialog Interaction | **Variants found:** 3 | **Impact:** HIGH | **Files affected:** 31

**Behavior Matrix (summary):**

| Behavior | Count | Notes |
|----------|:-----:|-------|
| mouseDown+click guard overlay close | 16 | Canonical ModalShell pattern |
| Simple onClick overlay close | 4 | Bug: drag-from-modal triggers close |
| No overlay close | 15 | All Bulk* + workflow modals |
| Escape key support | 3 | Only image viewers |
| Body scroll lock | 3 | Only image viewers |
| Focus trapping | 0 | Absent everywhere |

**Analysis:** The no-overlay-close modals in illuminator are likely intentional (prevent accidental loss of in-progress work). The split between mouseDown guard and simple onClick is pure drift. ModalShell needs Escape key + scroll lock + opt-out prop.

### B2. Bulk Workflow Structural Duplication
**Domain:** Multi-Step Workflow | **Variants found:** 2 | **Impact:** MEDIUM | **Files affected:** 7

7 bulk operation modals share nearly identical markup (overlay>dialog>header+minimize>body>footer) and state machine (idle|confirming|running|complete|cancelled|failed) but are 7 independent components with unique CSS prefixes. 3 of 7 pill-enabled workflows are missing `tabId` (BulkHistorian, BulkBackport, InterleavedAnnotation) — a concrete navigation bug.

**Analysis:** Textbook case for a shared `BulkOperationModal` component with render props for confirmation/terminal content.

### B3. Loading/Error/Empty State Pattern Drift
**Domain:** Loading & Error States | **Variants found:** 3+ | **Impact:** MEDIUM | **Files affected:** 30

- 6+ loading indicator approaches, 4 independent CSS spinner definitions
- 6+ error display patterns, no shared error component
- 7 CSS class prefix conventions for empty states
- Shared `EmptyState` used by only 2 files
- **Zero error boundaries in the entire codebase** — most critical gap

### B4. Workflow Error Recovery Inconsistency
**Domain:** Multi-Step Workflow | **Variants found:** 5 | **Impact:** LOW | **Files affected:** 12

12 async workflows use 5 different error recovery strategies. BulkEraNarrative catches per-era errors but hides them from the UI. Only EnrichmentQueue supports per-item retry.

---

## Semantic Findings

The semantic analysis (4,235 code units extracted across 323 components, 76 hooks, 1,599 functions) **confirmed** the structural and behavioral findings above without surfacing major new drift areas. Key confirmations:

- **Component re-export layer**: Coherence-engine's barrel file re-exports shared-components (not actual code copies for most components), but the hooks (useEditorState, useLocalInputState) ARE actual local copies with divergence.
- **SeedModal duplication**: Both chronicler and illuminator have structurally identical SeedModal components wrapping ChronicleSeedViewer.
- **Hook behavioral complexity**: 24 of 76 hooks have error/loading/retry behavior flags, all concentrated in the illuminator app. No other app has hooks with these behavioral characteristics, confirming illuminator is the complexity center of the codebase.

The semantic pipeline's fingerprinting and clustering stages could not run (missing python3.12-venv), so deep structural similarity scoring was not performed. The extractor data is available in `.drift-audit/semantic/code-units.json` for future re-runs.

---

## Quick Wins

1. **Delete redundant per-app ESLint deps** from canonry, viewer, archivist, chronicler, name-forge package.json files
2. **Delete coherence-engine's useLocalInputState copy** — import from shared package
3. **Align React/TypeScript version specifiers** to consistent values across all package.json files
4. **Move ChronicleSeedViewer** to a shared location

## Questions for the Team

1. **Canonry's JS inline styles**: Is the JS theme object an intentional design choice (e.g., for SSR, dynamic theming) or a legacy pattern? This affects whether CSS theming unification should touch canonry.
2. **Illuminator's Dexie usage**: Is the direct Dexie access in useImageUrl a performance optimization or just an older pattern? This affects whether the image-store shared package needs Dexie-level features.
3. **Chronicler's CSS Modules**: Is CSS Modules the intended direction for new apps, or was it specific to chronicler's scoping needs?

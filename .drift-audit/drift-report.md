# Drift Audit Report
Generated: 2026-02-25
Project: penguin-tales (The Canonry)
Source files scanned: 810
Drift areas found: 7

## Executive Summary

This monorepo is architecturally sound in some respects -- `@canonry/world-schema` is a genuine single source of truth for types, shared-components prevents UI duplication, and design tokens are consistent. However, **archivist and chronicler are on a fundamentally different dependency generation** (React 19.2/Vite 7/TS 5.9) than all other apps (React 19.0/Vite 6.4), creating the most impactful drift area. Beyond that, there's moderate drift in state management patterns, file conventions (JSX vs TSX), and a legacy DSL package that should be removed.

## Priority Matrix

| # | Area | Impact | Variants | Files Affected | Notes |
|---|------|--------|----------|----------------|-------|
| 1 | Dependency generation split | HIGH | 2 | All apps | React/Vite/TS version split between archivist+chronicler vs rest |
| 2 | Module federation & build config | HIGH | 2 | 9 vite configs | MF plugin version mismatch, minify divergence |
| 3 | State management architecture | MEDIUM | 4 | ~60 | Four distinct patterns across apps |
| 4 | File extension conventions (JSX/TSX) | MEDIUM | 3 | 810 | Inconsistent language choice across apps |
| 5 | ESLint configuration fragmentation | MEDIUM | 3 | 9 apps | Some apps override root config with divergent rules |
| 6 | TypeScript config divergence | MEDIUM | 4 | 8 tsconfigs | Module resolution and target inconsistency |
| 7 | Legacy DSL v1 package | LOW | 2 | 2 packages | Disabled but still in codebase |

## Detailed Findings

### 1. Dependency Generation Split
**Variants found:** 2 | **Impact:** HIGH | **Files affected:** All apps

This is the most significant drift in the codebase. Two apps (archivist, chronicler) are on a fundamentally different dependency generation than the rest of the monorepo.

**Variant A: "Established stack" (7 apps)**
- How it works: React 19.0.0, Vite 6.4.1, @vitejs/plugin-react 4.5.0, eslint-plugin-react-hooks ^7.0.1 (root), @module-federation/vite 1.1.0
- Representative files: `apps/lore-weave/webui/package.json`, `apps/illuminator/webui/package.json`, `apps/canonry/webui/package.json`
- Strengths: Majority adoption, battle-tested across most apps, consistent
- Weaknesses: Older versions; may be missing performance improvements

**Variant B: "Next-gen stack" (2 apps: archivist, chronicler)**
- How it works: React 19.2.0, Vite 7.2.4, @vitejs/plugin-react 5.1.1, TS ~5.9.3, @module-federation/vite 1.3.1
- Representative files: `apps/archivist/webui/package.json`, `apps/chronicler/webui/package.json`
- Strengths: Latest features, newer TypeScript capabilities
- Weaknesses: Creates split in MFE ecosystem -- Module Federation shared singletons (React, zustand) must agree on version. Two copies of the MF plugin exist in node_modules.

**Analysis:** These two apps were likely created more recently and picked up newer deps. The React version mismatch (19.0 vs 19.2) is particularly concerning in a Module Federation architecture where React is declared as a shared singleton. Even if pnpm resolves this at install time, it creates risk of subtle runtime incompatibilities. The Vite major version split (6 vs 7) means different plugin APIs and build behavior.

The cleanest path is likely to **upgrade all apps to the archivist/chronicler versions** since the older apps will eventually need to update anyway. This is a coordinated effort but mostly mechanical (update package.json, test for breakage).

---

### 2. Module Federation & Build Config Divergence
**Variants found:** 2 | **Impact:** HIGH | **Files affected:** 9 vite configs

**Variant A: "Vite 6 MFE config" (7 apps)**
- How it works: JavaScript vite.config.js, `@module-federation/vite` ^1.1.0, `minify: false`, port range 5000-5004+5006
- Representative files: `apps/illuminator/webui/vite.config.js`, `apps/coherence-engine/webui/vite.config.js`
- Strengths: Consistent across majority, dev-friendly (no minification)
- Weaknesses: Older MF plugin version

**Variant B: "Vite 7 MFE config" (2 apps: archivist, chronicler)**
- How it works: TypeScript vite.config.ts, `@module-federation/vite` ^1.3.1, `minify: true`, ports 5005+5007, explicit path aliases for `@penguin-tales/*` packages
- Representative files: `apps/archivist/webui/vite.config.ts`, `apps/chronicler/webui/vite.config.ts`
- Strengths: Type-safe config, newer MF features, explicit aliasing
- Weaknesses: Minify inconsistency with other apps, different port numbering convention

**Analysis:** The minify split (true vs false) means archivist/chronicler produce different build outputs than other apps. The TypeScript config files (.ts vs .js) and explicit path aliases suggest a pattern evolution. The port gap (5006 for illuminator, 5007 for chronicler, no 5005 app visible in dev script) suggests the numbering grew organically.

Both variants produce working MFE remotes, but standardizing would reduce cognitive load when adding new apps. The Vite 7 + TS config pattern is likely the direction to converge toward.

---

### 3. State Management Architecture
**Variants found:** 4 | **Impact:** MEDIUM | **Files affected:** ~60

**Variant A: "Zustand + Dexie + Repository layers" (1 app: illuminator)**
- How it works: 14+ Zustand stores organized into data stores (nav/cache split), config stores, operational stores, and selectors. Repository layer handles Dexie CRUD. Hooks handle worker communication.
- Representative files: `apps/illuminator/webui/src/lib/db/entityStore.ts`, `apps/illuminator/webui/src/lib/db/entityRepository.ts`, `apps/illuminator/webui/src/lib/db/entitySelectors.ts`
- Strengths: Highly organized, scalable, separates concerns well, proven at 274-file app scale
- Weaknesses: Over-engineered for simpler apps

**Variant B: "Props-in, callbacks-out (controlled component)" (3 apps: cosmographer, coherence-engine, name-forge)**
- How it works: Zero internal state management. Parent (Canonry) passes all state as props, receives updates via callbacks. MFE remote is a pure controlled component.
- Representative files: `apps/cosmographer/webui/src/CosmographerRemote.jsx`, `apps/coherence-engine/webui/src/CoherenceEngineRemote.jsx`
- Strengths: Simple, predictable, state ownership clear, no sync issues
- Weaknesses: Only works when parent owns all state; won't scale to apps with own persistence

**Variant C: "Custom hooks + useState" (2 apps: chronicler, archivist)**
- How it works: Custom hooks encapsulate data loading (useWorldDataLoader, etc.) and return `{ data, loading, error }`. Uses shared Zustand stores from packages (narrative-store, image-store) but not app-level zustand.
- Representative files: `apps/chronicler/webui/src/hooks/useWorldDataLoader.ts`, `apps/archivist/webui/src/ArchivistRemote.tsx`
- Strengths: Lightweight, hook abstraction is clean, leverages shared packages well
- Weaknesses: No caching layer, no selector optimization

**Variant D: "Worker-based state machine" (1 app: lore-weave)**
- How it works: Single `useSimulationWorker` hook manages all state as a state machine (idle/running/paused/complete). Worker communication via postMessage. No external state library.
- Representative files: `apps/lore-weave/webui/src/hooks/useSimulationWorker.ts`
- Strengths: Appropriate for single-concern app (simulation), keeps worker complexity encapsulated
- Weaknesses: Not reusable pattern for other apps

**Analysis:** Much of this variation is **intentional and appropriate**. Cosmographer and coherence-engine are editing tools embedded in Canonry -- controlled component pattern is correct for them. Lore-weave is a simulation runner with a single concern. The real question is whether chronicler and archivist (which access world data from Dexie) should adopt a lighter version of illuminator's repository pattern, or whether their current hook approach is sufficient given their smaller scope. I'd lean toward: the current variation is mostly justified by app complexity, but zustand versions should be synchronized.

---

### 4. File Extension Conventions (JSX vs TSX)
**Variants found:** 3 | **Impact:** MEDIUM | **Files affected:** 810

**Variant A: "Pure JSX" (6 apps)**
- Files: 254 JSX files across name-forge, coherence-engine, lore-weave webui, canonry, cosmographer, viewer
- Strengths: Less boilerplate, faster to write
- Weaknesses: No compile-time type checking in component files

**Variant B: "Pure TSX" (2 apps: archivist, chronicler)**
- Files: 68 TSX files
- Strengths: Full type safety, better IDE support, catches bugs at compile time
- Weaknesses: More verbose, requires type annotations

**Variant C: "Hybrid JSX + TSX" (1 app: illuminator)**
- Files: 67 JSX + 38 TSX files
- Pattern: Newer files are TSX, older files remain JSX. Not a migration in progress -- both coexist.
- Strengths: Allows gradual adoption
- Weaknesses: Inconsistent developer experience within the app

**Analysis:** The JSX/TSX split mirrors the dependency generation split. Archivist and chronicler (newer apps) chose TSX from the start. The older apps use JSX. This is a decision that affects developer productivity and code quality but doesn't cause runtime issues.

If the team values type safety, converging on TSX is worthwhile but is a large mechanical effort (254 JSX files to convert). The hybrid state in illuminator is the most problematic because developers working in that app face inconsistency.

---

### 5. ESLint Configuration Fragmentation
**Variants found:** 3 | **Impact:** MEDIUM | **Files affected:** 9 apps

**Variant A: "Inherit from root" (6 apps)**
- How it works: No local eslint config. All linting rules come from root `eslint.config.js`.
- Representative files: `apps/illuminator/`, `apps/canonry/`, `apps/cosmographer/`
- Strengths: Centralized rule management, consistency
- Weaknesses: Can't customize per-app

**Variant B: "Local flat config with divergent plugins" (2 apps: archivist, chronicler)**
- How it works: Own `eslint.config.js` using `defineConfig`. Uses `eslint-plugin-react-perf` (not in root). Different versions of react-hooks plugin.
- Representative files: `apps/archivist/webui/eslint.config.js`, `apps/chronicler/webui/eslint.config.js`
- Strengths: Can enforce app-specific rules (react-perf)
- Weaknesses: Rules diverge from rest of monorepo; may not catch same issues

**Variant C: "Local config with old plugin versions" (1 app: name-forge)**
- How it works: Own `eslint.config.js` with `eslint-plugin-react-hooks` ^5.2.0 (root uses ^7.0.1). This is a 2-major-version gap.
- Representative files: `apps/name-forge/webui/eslint.config.js`
- Strengths: Works for the app
- Weaknesses: Old plugin version may miss newer rule violations

**Analysis:** The root eslint.config.js was recently set up (based on the `linting` branch). Apps that existed before this may have their own configs that predate it. The name-forge version gap (react-hooks 5.x vs 7.x) is a concrete problem because the plugin APIs changed. Archivist/chronicler's custom configs are reasonable if they want react-perf rules, but those rules should ideally be incorporated into the root config.

---

### 6. TypeScript Configuration Divergence
**Variants found:** 4 module resolution strategies | **Impact:** MEDIUM | **Files affected:** 8 tsconfig files

**Variant A: "bundler resolution" (archivist, chronicler, lore-weave)**
- `module: ESNext`, `moduleResolution: bundler`
- Correct for Vite-bundled apps

**Variant B: "Node16 resolution" (name-forge)**
- `module: Node16`, `moduleResolution: Node16`
- Designed for Node.js execution, but name-forge also has a web UI

**Variant C: "NodeNext resolution" (cosmographer)**
- `module: NodeNext`, `moduleResolution: NodeNext`
- Similar to Node16 but allows future Node module features

**Variant D: "Outdated target" (world-schema)**
- `target: ES2020`, `moduleResolution: bundler`
- TypeScript 5.3.0 (other packages use 5.7-5.9)
- Two years behind the rest of the codebase

**Analysis:** The module resolution drift is the most practically impactful. Name-forge and cosmographer using Node-based resolution in a Vite-bundled context may not cause build failures (Vite handles it), but it can affect how TypeScript resolves `.js` extensions in import paths. World-schema's ES2020 target limits what TypeScript features are available in the shared type package.

Converging on `module: ESNext` + `moduleResolution: bundler` + `target: ES2022` for all packages would be correct since everything is ultimately bundled by Vite.

---

### 7. Legacy DSL v1 Package
**Variants found:** 2 | **Impact:** LOW | **Files affected:** 2 packages

**Variant A: "canonry-dsl v2" (production)**
- Path: `packages/canonry-dsl-v2/`
- 14,422 lines in compile.ts, 6,617 in serialize.ts
- Used by: `scripts/conduit.js` pipeline
- Features: illuminator block support, text formatting validation, extended field semantics

**Variant B: "canonry-dsl v1" (legacy, disabled)**
- Path: `packages/canonry-dsl/`
- 12,519 lines in compile.ts, 6,371 in serialize.ts
- Usage: `USE_CANON_DSL = false` in `useProjectStorage.js` -- never runs
- Missing: illuminator blocks, text validation, extended fields

**Analysis:** v1 is dead code gated behind a disabled flag. Both packages export identical APIs (drop-in replacement design), so there's no consumer migration needed. Removing v1 would eliminate ~19,000 lines of dead code and reduce confusion. This is a quick win.

## Progress Log

### 2026-02-25: ESLint Unification + Illuminator Prop Reduction

**Area #5 (ESLint Configuration):** Root `eslint.config.js` significantly strengthened:
- Added `eslint-plugin-sonarjs` (recommended config)
- Added complexity/max-lines/max-depth limits (warn level)
- Added `eslint-plugin-jsx-a11y` for accessibility
- Added custom `local/max-jsx-props` rule (threshold 12) to enforce prop count limits on JSX elements
- Rule file: `eslint-rules/max-jsx-props.js`
- Remaining: archivist, chronicler, name-forge still have local overrides

**Area #3 (State Management):** Illuminator's Zustand pattern refined:
- Decomposed 2505-line IlluminatorRemote.jsx into 17 files (hooks + components)
- Eliminated ~12 redundant prop-drilled values by having children read from Zustand stores directly
- Grouped 4 workflow flows (revision, backport, historian, dynamics) into domain objects instead of flat-spreading ~60 properties
- Tab renderers converted from plain functions to proper React components (enabling hook access)
- Documented in ADR-001, ADR-002, ADR-003

---

## Quick Wins

1. **Delete canonry-dsl v1** -- 19,000 lines of dead code behind a `false` flag. No consumers. Remove the package and the `USE_CANON_DSL` flag.
2. **Align zustand versions** -- Update canonry, archivist, chronicler, viewer from 5.0.2 to 5.0.11 (illuminator's version). Pure version bump, no API changes.
3. **Update name-forge eslint-plugin-react-hooks** -- Bump from ^5.2.0 to ^7.0.1 to match root. May require adjusting config format.
4. **Update world-schema TypeScript** -- Bump from 5.3.0 to 5.9.3 and update target from ES2020 to ES2022.

## Questions for the Team

1. **Dependency upgrade strategy:** Should all apps be upgraded to archivist/chronicler versions (React 19.2, Vite 7, TS 5.9), or should archivist/chronicler be pinned back to match the majority? Upgrading forward is more work now but avoids a second migration. The MFE singleton sharing of React makes version alignment important.

2. **JSX-to-TSX migration:** Is type-safe TSX desired across the codebase? If so, should this be done incrementally (new files only) or as a batch migration? Illuminator's hybrid state suggests the team may already be migrating organically.

3. **State management standardization:** The four patterns (Zustand+repo, controlled component, hooks+useState, worker state machine) seem mostly intentional. Should smaller apps that access Dexie (chronicler, archivist) adopt a lighter version of illuminator's repository pattern, or is the current hook-based approach sufficient?

4. **ESLint unification:** Should archivist/chronicler's `eslint-plugin-react-perf` rules be added to the root config so all apps benefit? This would centralize all linting.

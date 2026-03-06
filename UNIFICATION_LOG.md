# Unification Log

## 2026-02-28 — CSS Duplication: ActivityPanel.css, BackportConfigModal.css, ChronicleImagePanel.css

### Canonical Pattern
Shared panel utility classes (`.ilu-section`, `.ilu-container`, `.ilu-action-btn`, `.ilu-empty`, `.ilu-footer`, etc.) in `packages/shared-components/src/styles/components/panel-utilities.css`. Components compose these utilities alongside their prefixed component classes.

### Files Changed

**New shared utility file:**
- `packages/shared-components/src/styles/components/panel-utilities.css` — created with 12 shared utility classes for section containers, action buttons, empty states, footers, banners, labels
- `packages/shared-components/src/styles/index.css` — added import for panel-utilities.css

**Illuminator component CSS files (removed duplicated declarations):**
- `apps/illuminator/webui/src/components/ActivityPanel.css` — added shared utility reference comments
- `apps/illuminator/webui/src/components/BackportConfigModal.css` — `.bcm-section-label` and `.bcm-footer-btn` deduplicated
- `apps/illuminator/webui/src/components/ChronicleImagePanel.css` — `.cip-empty-state` deduplicated
- `apps/illuminator/webui/src/components/ChronicleReviewPanel.css` — `.crp-synth`, `.crp-acv`, headers deduplicated
- `apps/illuminator/webui/src/components/CohesionReportViewer.css` — `.crv-refinements`, `.crv-checks-panel` deduplicated
- `apps/illuminator/webui/src/components/CorpusFindReplace.css` — `.cfr-field-label`, `.cfr-context-heading`, `.cfr-error-banner` deduplicated
- `apps/illuminator/webui/src/components/CoverImageControls.css` — `.cic-action-btn` + disabled state deduplicated
- `apps/illuminator/webui/src/components/DescriptionMotifWeaver.css` — `.dmw-footer` deduplicated
- `apps/illuminator/webui/src/components/EventsPanel.css` — `.events-panel-export-btn`, `.events-panel-clear-filters-btn` deduplicated
- `apps/illuminator/webui/src/components/ProgressPanel.css` — `.pp-key-warning` base props deduplicated
- `apps/illuminator/webui/src/components/RevisionFilterModal.css` — `.rfm-footer-btn` deduplicated
- `apps/illuminator/webui/src/components/chronicle-workspace/ContentTab.css` — `.ctab-viewer`, `.ctab-viewer-toolbar`, `.ctab-summary-section` deduplicated
- `apps/illuminator/webui/src/components/chronicle-workspace/EnrichmentTab.css` — `.enrtab-container`, `.enrtab-button` deduplicated
- `apps/illuminator/webui/src/components/chronicle-workspace/HistorianTab.css` — `.htab-section`, `.htab-*-btn` × 3, `.htab-empty` deduplicated
- `apps/illuminator/webui/src/components/chronicle-workspace/ImagesTab.css` — `.itab-cover-section`, `.itab-cover-btn`, `.itab-empty` deduplicated
- `apps/illuminator/webui/src/components/chronicle-workspace/PipelineTab.css` — `.pt-checklist`, `.pt-refrow-btn` deduplicated
- `apps/illuminator/webui/src/components/chronicle-workspace/ReferenceTab.css` — `.ref-tab-synth`, `.ref-tab-fcv`, `.ref-tab-temporal`, headers deduplicated
- `apps/illuminator/webui/src/components/chronicle-workspace/VersionsTab.css` — `.vtab-action-btn`, `.vtab-report-section`, `.vtab-report-header` deduplicated

**Guard artifacts:**
- `eslint-rules/no-panel-css-duplication.js` — ESLint rule detecting CSS files that duplicate panel utility patterns
- `docs/adr/029-panel-css-utilities.md` — ADR documenting the decision
- `docs/patterns/panel-css-utilities.md` — usage guide for panel utility classes
- `eslint.config.js` — wired in the new ESLint rule

### Intentional Exceptions
- `apps/illuminator/webui/src/components/HistorianMarginNotes.css` — entirely unique historian-specific typography and color styles (Georgia serif, sepia tones); no structural patterns to consolidate
- `apps/illuminator/webui/src/components/EntityCoveragePanel.css` — highly domain-specific table/grid layout with dot/star/ratio indicators; no match to shared panel patterns

### Migration Notes
Component CSS files currently retain their prefixed class selectors with duplicate properties removed. The next step is for JSX/TSX to compose `ilu-*` utility classes alongside component-prefixed classes (e.g., `className="ilu-section htab-section"`). This is tracked as incremental migration — existing components continue to work as-is since the property removal only affects classes that will gain those properties from the shared utility.

---

## 2026-02-28 — Error Display Pattern Divergence

### Canonical Pattern
Shared `<ErrorMessage>` component from `@the-canonry/shared-components` with props: `message` (required), `title` (optional), `className` (optional). Reference implementation: `packages/shared-components/src/components/ErrorMessage.jsx`. CSS: `packages/shared-components/src/styles/components/error-message.css`.

### Files Changed

**Illuminator panels/lists (inline error → `<ErrorMessage>`):**
- `apps/illuminator/webui/src/components/ActivityPanel.jsx` — replaced `<div className="ap-error-detail">` with `<ErrorMessage>` per task error
- `apps/illuminator/webui/src/components/ProgressPanel.jsx` — replaced `pp-error-item` list items with `<ErrorMessage title={name} message={error}>` per task
- `apps/illuminator/webui/src/components/TraitPaletteSection.tsx` — replaced `tps-error-item` divs with `<ErrorMessage>` per error
- `apps/illuminator/webui/src/components/BulkOperationShell.jsx` — replaced `bulk-failed-item` spans with `<ErrorMessage title={label} message={error}>`
- `apps/illuminator/webui/src/components/ChronicleWizard/steps/RoleAssignmentStep.tsx` — replaced `ras-error` divs with `<ErrorMessage>` per validation error

**Full-screen state cards (error text → `<ErrorMessage>`):**
- `apps/viewer/webui/src/StatusScreen.jsx` — replaced title+detail divs with `<ErrorMessage title="Bundle unavailable" message={...}>`; added `@the-canonry/shared-components` dependency
- `apps/archivist/webui/src/ArchivistRemote.tsx` — replaced title+message divs with `<ErrorMessage title="World data unavailable" message={...}>`
- `apps/chronicler/webui/src/components/ChroniclerStatusScreen.tsx` — replaced CSS module title+detail with `<ErrorMessage title="World Data Unavailable" message={...}>`

**Toast notifications (error text → `<ErrorMessage>`):**
- `apps/illuminator/webui/src/components/ChroniclePanel.jsx` — replaced `Error: ${result.error}` strings with `<ErrorMessage message={...}>` in 3 toast error branches; added CSS override for `.chron-toast .error-message` to inherit toast styling
- `apps/illuminator/webui/src/components/ChroniclePanel.css` — added `.chron-toast .error-message` override rule

**Sync status (error case → `<ErrorMessage>`):**
- `apps/illuminator/webui/src/components/IlluminatorTabContent.jsx` — split success/error paths; error case now uses `<ErrorMessage>`, success case keeps green status div

**Validation (error header → `<ErrorMessage>`):**
- `apps/lore-weave/webui/src/components/validation/ValidationPanel.jsx` — replaced error card header (path+message divs) with `<ErrorMessage title={path} message={message}>`; kept structured detail body (expected/got/suggestion) as-is

### Shared Utilities Created/Updated
- `packages/shared-components/src/components/ErrorMessage.jsx` — already existed (created in prior session)
- `packages/shared-components/src/styles/components/error-message.css` — already existed
- `apps/viewer/webui/package.json` — added `@the-canonry/shared-components` workspace dependency

### Prior Work (already migrated before this session)
All Illuminator modal files (ImageModal, DynamicsGenerationModal, HistorianReviewModal, SummaryRevisionModal, ChronicleImagePanel, DescriptionMotifWeaver, CoverImageControls, CorpusFindReplace, ChronologyModal, EraNarrativeModal), ExportView, and Canonry App.jsx were already using `<ErrorMessage>` from shared-components.

All Name Forge files (GenerateTab, EntityWorkspace, LexemesTab, TestPanel, CultureSidebar, GrammarsTab, TestTab) were already using `<ErrorMessage>`.

### Intentional Exceptions
- None — all files in the drift manifest have been migrated.

### Breaking Changes
- None. All changes preserve existing behavior. The `<ErrorMessage>` component's `className` prop allows component-specific CSS to coexist with the shared error styling.

### Open Questions
- Toast error styling: the `.chron-toast .error-message` CSS override makes `<ErrorMessage>` transparent inside toasts. This works but couples the toast layout to knowledge of the shared component's class name. A future toast notification component could encapsulate this.
- Full-screen state cards still wrap `<ErrorMessage>` in app-specific card layouts. A shared `<StatusScreen>` component could further unify these if desired.

## 2026-02-28 — Prefixed ID generation — produce unique IDs in the format prefix_timestamp_uuid-slice for database records

### Canonical Pattern
Single `generatePrefixedId(prefix, sliceLength = 8)` utility producing IDs in the format `prefix_timestamp_randomSlice` using `Date.now()` and `crypto.randomUUID().slice()`. Reference implementation: `apps/illuminator/webui/src/lib/db/generatePrefixedId.ts`.

### Files Changed

**Illuminator repositories (hand-rolled generators → delegate to `generatePrefixedId`):**
- `apps/illuminator/webui/src/lib/db/costRepository.ts` — `generateCostId()` now calls `generatePrefixedId("cost", 9)`
- `apps/illuminator/webui/src/lib/db/dynamicsRepository.ts` — `generateRunId()` now calls `generatePrefixedId("dynrun")`
- `apps/illuminator/webui/src/lib/db/eraNarrativeRepository.ts` — `generateEraNarrativeId()` now calls `generatePrefixedId("eranarr")`; `generateVersionId()` now calls `generatePrefixedId("enver", 6)`
- `apps/illuminator/webui/src/lib/db/historianRepository.ts` — `generateHistorianRunId()` now calls `generatePrefixedId("histrun")`
- `apps/illuminator/webui/src/lib/db/staticPageRepository.ts` — `generatePageId()` now calls `generatePrefixedId("static")`
- `apps/illuminator/webui/src/lib/db/summaryRevisionRepository.ts` — `generateRevisionRunId()` now calls `generatePrefixedId("revrun")`

**Lore-weave (variant pattern → canonical pattern):**
- `apps/lore-weave/lib/core/idGeneration.ts` — `generateEventId()` replaced crypto fallback with canonical `prefix_timestamp_uuid-slice` pattern; `generateLoreId()` replaced counter-based suffix with `crypto.randomUUID().slice()`; removed `eventCounter` and `loreRecordCounter` module state

### Shared Utilities Created/Updated
- `apps/illuminator/webui/src/lib/db/generatePrefixedId.ts` — created; single canonical implementation of the `prefix_timestamp_uuid-slice` pattern

### Intentional Exceptions
- `apps/lore-weave/lib/core/idGeneration.ts: generateId()` — sequential counter-based ID generator (`prefix_N`). Fundamentally different pattern used for graph node IDs during simulation; not a variant of the timestamp+random pattern.
- `apps/canonry/webui/src/storage/staticPageStorage.js: generatePageId()` — already follows canonical pattern inline (`crypto.randomUUID().slice(0, 8)`). Separate app with no shared import path to illuminator; inline implementation is acceptable.

### Breaking Changes
- None. All exported function signatures are preserved. Callers import the same named functions from the same modules.

### Open Questions
- The `generatePrefixedId` utility lives within illuminator because 7/8 usages are there. If a shared `packages/shared-utils` package is created in the future, this utility would be a natural candidate to move there so lore-weave and canonry can import from a single source instead of maintaining inline copies.

## 2026-02-28 — CSS Duplication: section.css

### Canonical Pattern
Shared `section.css` from `packages/shared-components/src/styles/components/section.css`, providing section layout, nested sections, info boxes, and category headers. Apps that need tighter spacing override only the differing properties via their local `compact-overrides.css`.

### Files Changed
- `apps/coherence-engine/webui/src/styles/components/section.css` — **deleted**. Was a full duplicate of shared-components' section.css with compact spacing values. Coherence-engine already imports `@the-canonry/shared-components/styles` which provides the canonical section.css.
- `apps/coherence-engine/webui/src/styles/index.css` — removed `@import url("./components/section.css")` since the shared import already provides these styles.
- `apps/coherence-engine/webui/src/styles/components/compact-overrides.css` — added section-specific compact overrides (`.section`, `.section-header`, `.section-title`, `.section-icon`, `.section-count`, `.nested-section`, `.nested-title`, `.info-box`, `.category-header`) that preserve the tighter spacing coherence-engine needs for its dense config UI.

### Intentional Exceptions
- None. All coherence-engine section styles are preserved through compact overrides.

## 2026-02-28 — CSS Duplication: form.css, form.css

### Canonical Pattern
Shared `form.css` from `packages/shared-components/src/styles/components/form.css`, providing all form component styles (inputs, textareas, selects, checkboxes, sliders, chips, labels, alerts, condition editors, type selectors, etc.). Apps that need tighter spacing override only the differing properties via their local `compact-overrides.css`.

### Files Changed
- `apps/coherence-engine/webui/src/styles/components/form.css` — **deleted**. Was a full 466-line duplicate of shared-components' form.css with compact spacing values. Coherence-engine already imports `@the-canonry/shared-components/styles` which provides the canonical form.css.
- `apps/coherence-engine/webui/src/styles/index.css` — removed `@import url("./components/form.css")` since the shared import already provides these styles.
- `apps/coherence-engine/webui/src/styles/components/compact-overrides.css` — added form-specific compact overrides for all classes that differ in sizing: `.form-group`/`.input-group` (gap), `.form-grid` (gap), `.label` (font-size, letter-spacing), `.form-help-text`, `.alert`, `.input`, `.textarea`, `.select`, `.checkbox`, `.checkbox-label`, `.slider`, `.slider-row`, `.slider-value`, `.chip-container`, `.chip`, `.chip-remove`, `.chip-container-input`, `.chip-input`, `.condition-editor` + sub-classes, `.type-selector`, `.type-pill`, `.type-pill-icon`, `.type-description`.

### Intentional Exceptions
- None. All coherence-engine form styles are preserved through compact overrides. CE-specific classes (`condition-editor-header`, `condition-editor-body`) were moved into compact-overrides.css since they are only used by coherence-engine.

## 2026-02-28 — CSS Duplication: VariablesTab.css, ThresholdTriggerTab.css

### Canonical Pattern
Shared `tab-form.css` in `apps/coherence-engine/webui/src/styles/components/tab-form.css`, imported centrally via `styles/index.css`. Defines three generic classes (`tab-required-badge`, `tab-checkbox-label`, `tab-required-hint`) replacing per-component prefixed duplicates (`avt-`, `ttt-`, `vt-`).

### Files Changed
- `apps/coherence-engine/webui/src/styles/components/tab-form.css` — **created** shared CSS with the three tab form companion rules
- `apps/coherence-engine/webui/src/styles/index.css` — added `@import url("./components/tab-form.css")`
- `apps/coherence-engine/webui/src/components/systems/tabs/ThresholdTriggerTab.jsx` — replaced `ttt-*` class names with `tab-*`, removed CSS import
- `apps/coherence-engine/webui/src/components/actions/tabs/VariablesTab.jsx` — replaced `avt-*` class names with `tab-*`, removed CSS import
- `apps/coherence-engine/webui/src/components/generators/tabs/VariablesTab.jsx` — replaced `vt-required-checkbox` and inline utilities with `tab-*` classes, removed CSS import
- `apps/coherence-engine/webui/src/components/actions/tabs/VariablesTab.css` — **deleted** (redundant)
- `apps/coherence-engine/webui/src/components/systems/tabs/ThresholdTriggerTab.css` — **deleted** (redundant)
- `apps/coherence-engine/webui/src/components/generators/tabs/VariablesTab.css` — **deleted** (redundant)

### Intentional Exceptions
- None. All three consumers now use the shared `tab-form.css` classes via the central stylesheet.

## 2026-02-28 — CSS Duplication: level-selector.css, level-selector.css

### Canonical Pattern
Shared `level-selector.css` from `packages/shared-components/src/styles/components/level-selector.css`, providing all level selector styles (dots, fill SVG, active state, input). The `LevelSelector` component lives in shared-components and its CSS must live there too.

### Files Changed
- `apps/coherence-engine/webui/src/styles/components/level-selector.css` — **deleted**. Was a stale variant with an unused `.level-selector-dot-fill` class (div-based fill) while the actual `LevelSelector.jsx` component uses `.level-selector-dot-fill-svg` (SVG-based fill) and `.level-selector-dot-active`. Coherence-engine already imports `@the-canonry/shared-components/styles` which provides the correct CSS.
- `apps/coherence-engine/webui/src/styles/index.css` — removed `@import url("./components/level-selector.css")` since the shared import already provides these styles.

### Intentional Exceptions
- None. No compact overrides needed — the shared-components CSS matched the coherence-engine's usage exactly (the app version's differing classes were unused dead code).

## 2026-02-28 — Vite Path Alias Configuration Patterns

### Canonical Pattern
Two permitted alias patterns: (1) `@lib` pointing to sibling `../lib` directory for apps with a `lib/webui` split (lore-weave, name-forge, illuminator), and (2) no aliases for all other apps. Cross-app source aliases and redundant package source aliases are banned. Reference: `apps/name-forge/webui/vite.config.js`.

### Files Changed
- `apps/archivist/webui/vite.config.ts` — removed `@the-canonry/world-store` source alias and unused `path` import. The alias was redundant because the package's `exports` field already points to `./src/index.ts`, so workspace resolution reaches the same file.
- `apps/chronicler/webui/vite.config.ts` — same change as archivist (removed redundant `@the-canonry/world-store` source alias and unused `path` import).
- `apps/viewer/webui/vite.config.js` — removed `@chronicler` cross-app source alias and unused `resolve` import. Viewer directly bundles chronicler code for standalone deployment.
- `apps/viewer/webui/src/App.jsx` — converted `@chronicler/ChroniclerRemote.tsx` and `@chronicler/assets/textures/parchment-tile.jpg` imports to relative paths (`../../../chronicler/webui/src/...`), making the cross-app coupling explicit.
- `apps/cosmographer/webui/vite.config.js` — removed `@name-forge` cross-app source alias and unused `resolve` import. The alias was dead config (no source files imported from `@name-forge`).

### Intentional Exceptions
- `apps/viewer/webui/src/App.jsx` still imports directly from chronicler's source via relative paths. Viewer is a standalone deployment wrapper that intentionally bundles chronicler — this coupling is by design, not accidental drift. The fix makes it explicit (relative paths) rather than hidden (alias). A future improvement would be extracting the shared components to a package.

### Breaking Changes
- None. All import resolution paths resolve to the same files as before. The `@the-canonry/world-store` imports in archivist and chronicler resolve identically through workspace package resolution.

## 2026-02-28 — CSS Duplication: WikiSearch.module.css, dropdown.css, dropdown.css

### Canonical Pattern
Single `dropdown.css` stylesheet in `packages/shared-components/src/styles/components/dropdown.css`, providing all dropdown classes (`.dropdown`, `.dropdown-trigger`, `.dropdown-menu`, `.dropdown-option`, `.dropdown-menu-item`, etc.). Apps that need compact sizing override specific properties via their `compact-overrides.css`.

### Files Changed
- `apps/coherence-engine/webui/src/styles/components/dropdown.css` — **deleted**. Was a full copy of shared-components/dropdown.css with compact sizing values. Coherence-engine already loads shared-components styles first; this local copy was redundant.
- `apps/coherence-engine/webui/src/styles/index.css` — removed `@import url("./components/dropdown.css")` line.
- `apps/coherence-engine/webui/src/styles/components/compact-overrides.css` — added dropdown compact overrides for `.dropdown-menu`, `.dropdown-menu-item`, `.dropdown-menu-icon`, `.dropdown-menu-label` (the classes coherence-engine actually uses). This follows the existing compact-override pattern for buttons, modals, forms, etc.
- `packages/shared-components/src/styles/components/dropdown.css` — replaced hardcoded `rgb(30 41 59 / 80%)` with `var(--color-bg-dark)` and `rgb(100 116 139 / 30%)` with `var(--color-border)` to align with design token usage.

### Intentional Exceptions
- `apps/chronicler/webui/src/components/WikiSearch.module.css` — CSS Module scoped to the WikiSearch component. Uses locally-scoped class names (`.container`, `.input`, `.dropdown`, `.result`) that cannot conflict with global dropdown.css. The CSS Module isolation is intentional: WikiSearch is a search-results widget with a simpler dropdown overlay, not a generic searchable dropdown component. Migrating it to global dropdown.css classes would break CSS Module scoping for no benefit.

## 2026-02-28 — CSS Duplication: GraphView.css, GraphView3D.css, TimelineView3D.css

### Canonical Pattern
Shared visualization overlay panel CSS in `apps/archivist/webui/src/components/visualization-overlay.css`. Provides unified classes (`viz-container`, `viz-legend`, `viz-controls`, `viz-no-webgl`, etc.) with CSS custom property theming via `viz-theme-blue` and `viz-theme-golden` classes.

### Files Changed
- `apps/archivist/webui/src/components/visualization-overlay.css` — NEW. Shared styles for full-bleed container, WebGL fallback, legend panel, controls panel, and color themes (blue/golden).
- `apps/archivist/webui/src/components/GraphView.css` — removed duplicated container/legend/controls styles; retained only Cytoscape container (`.gv-cytoscape`) and shape legend variants (`.gv-shape-*`).
- `apps/archivist/webui/src/components/GraphView3D.css` — DELETED. All styles were shared overlay patterns, now in visualization-overlay.css.
- `apps/archivist/webui/src/components/TimelineView3D.css` — removed duplicated container/legend/controls/no-webgl styles; retained only era-specific styles (`.tv3d-era-swatch`, `.tv3d-era-link`).
- `apps/archivist/webui/src/components/GraphView.tsx` — imports visualization-overlay.css; class names migrated from `gv-*` to `viz-*`; CSS variable `--gv-swatch-color` → `--viz-swatch-color`.
- `apps/archivist/webui/src/components/GraphView3D.tsx` — imports visualization-overlay.css (replacing GraphView3D.css); class names migrated from `gv3d-*` to `viz-*`; CSS variable `--gv3d-swatch-color` → `--viz-swatch-color`.
- `apps/archivist/webui/src/components/TimelineView3D.tsx` — imports visualization-overlay.css; class names migrated from `tv3d-*` to `viz-*`; CSS variable `--tv3d-swatch-color` → `--viz-swatch-color`.

### Intentional Exceptions
- None. All three files were fully migrated.

## 2026-02-28 — CSS Duplication: CoherenceEngineRemote.css, CosmographerRemote.css

### Canonical Pattern
Shared remote app shell layout CSS in `packages/shared-components/src/styles/components/remote-shell.css`, using the `rs-` class prefix. Both Module Federation remote entry points (CoherenceEngineRemote, CosmographerRemote) shared an identical sidebar + nav button + content layout, duplicated under different class name prefixes (`cer-*` and `cosmo-*`). The shared stylesheet provides the structural layout with CSS custom properties (`--rs-active-from`, `--rs-active-to`, `--rs-hover-bg`, `--rs-hover-color`) for per-app accent color customization.

### Files Changed
- `packages/shared-components/src/styles/components/remote-shell.css` — **new** shared stylesheet with all common remote shell layout classes (`rs-container`, `rs-sidebar`, `rs-nav`, `rs-nav-button`, `rs-main`, `rs-content`, `rs-placeholder`, `rs-no-data`, etc.)
- `packages/shared-components/src/styles/index.css` — added `@import` for `remote-shell.css`
- `apps/coherence-engine/webui/src/CoherenceEngineRemote.css` — replaced 107 lines of layout CSS with 9-line override that sets amber accent via CSS custom properties on `.cer-shell`
- `apps/coherence-engine/webui/src/CoherenceEngineRemote.jsx` — migrated all class names from `cer-*` to `rs-*`; added `.cer-shell` scope class for accent overrides
- `apps/cosmographer/webui/src/CosmographerRemote.css` — replaced 76 lines of layout CSS with a comment-only file (uses shared defaults — blue accent needs no overrides)
- `apps/cosmographer/webui/src/CosmographerRemote.jsx` — migrated all class names from `cosmo-*` to `rs-*`; added `@the-canonry/shared-components/styles` import

### Intentional Exceptions
- None. Both files were fully migrated.

## 2026-02-28 — CSS Duplication: BulkBackportModal.css, BulkEraNarrativeModal.css, BulkHistorianModal.css

### Canonical Pattern
`BulkOperationShell.jsx` + `BulkOperationShell.css` — shared wrapper component and CSS for all bulk operation modals. Provides overlay, dialog container, header (title + minimize + status), body, footer (confirm/cancel/close), pill lifecycle, and terminal messages via `bulk-*` prefixed CSS classes. Each bulk modal renders only content-specific body markup as children. Reference implementation: `BulkBackportModal.jsx` + `BulkBackportModal.css`.

### Files Changed
- `apps/illuminator/webui/src/components/BulkEraNarrativeModal.jsx` — replaced inline shell rendering (overlay, dialog, header, minimize button, pill management effects, footer buttons) with `BulkOperationShell` wrapper. Terminal messages now use `BulkTerminalMessage` component. Cost display uses `BulkCost`. Removed `useFloatingPillStore` import and all pill lifecycle effects (handled by BulkOperationShell). Added `statusText` and `pillStatusText` props.
- `apps/illuminator/webui/src/components/BulkEraNarrativeModal.css` — removed ~80 lines of shell CSS (overlay, modal, header, body, footer, terminal messages) that duplicated BulkOperationShell.css. Retained content-specific styles: era list, tone selectors, custom progress bar, step progress, streaming counters, stats.

### Intentional Exceptions
- `ChronologyModal.css`, `DynamicsGenerationModal.css`, `SummaryRevisionModal.css`, `EraNarrativeModal.css`, `CreateEntityModal.css`, `EntityRenameModal.css`, `HistorianReviewModal.css`, `HistoryCompressionPreviewModal.css`, `InterleavedAnnotationModal.css`, `QuickCheckModal.css`, `ToneAssignmentPreviewModal.css` — standalone feature modals (not bulk operations). They share a similar modal shell structure but are not candidates for BulkOperationShell (which is specific to the bulk operation workflow with pill lifecycle, confirming/processing/terminal phases, etc.). A generic shared modal shell CSS is a separate consolidation opportunity.
- `ChroniclePanel.css`, `ChroniclePlanEditor.css`, `NarrativeTimeline.css`, `ChronicleWorkspace.css`, `ChronicleSeedViewer.css`, `EraNarrativeViewer.css`, `HistorianConfigEditor.css`, `ThinkingViewer.css` — non-modal components (panels, editors, viewers). They appear in the cluster due to shared design token usage (`--border-color`, `--text-muted`) and similar list/section patterns, not due to shell duplication.

---

## 2026-02-28 — CSS Duplication: BackrefImageEditor.css, ChronicleImagePicker.css, EntryPointStep.css (css-cluster-003)

### Canonical Pattern
Shared panel utility classes in `packages/shared-components/src/styles/components/panel-utilities.css` — specifically `ilu-empty`, `ilu-selection-bar`, `ilu-stats-grid`/`ilu-stat-card`/`ilu-stat-value`/`ilu-stat-label`, `ilu-thumb-cover`/`ilu-thumb-placeholder`. Components compose these alongside prefixed component classes (`className="ilu-empty cip-empty-state"`).

### Files Changed

**Shared utility file extended:**
- `packages/shared-components/src/styles/components/panel-utilities.css` — added 5 new utility patterns: selection bar, stats grid, stat cards, thumb cover, thumb placeholder

**Canonical file migrated to CSS variables:**
- `apps/illuminator/webui/src/components/BackrefImageEditor.css` — replaced all hardcoded `rgb()` colors with CSS custom properties (`var(--text-primary)`, `var(--text-muted)`, `var(--bg-tertiary)`, `var(--border-color)`, `var(--accent-color)`); trimmed `.bie-heading` to override-only

**CSS files — empty state deduplication (removed `text-align`, `color` duplicated from `ilu-empty`):**
- `ChronicleImagePicker.css` — `.cip-empty-state` trimmed to padding override
- `EntryPointStep.css` — `.eps-empty-list` trimmed to padding override
- `StyleStep.css` — `.sstep-empty` trimmed to padding override
- `EventResolutionStep.css` — `.ers-empty-events` trimmed to padding + font-size overrides
- `EntityDetailView.css` — `.edv-no-enrichment` trimmed to padding override
- `StyleLibraryEditor.css` — `.style-editor-empty` + `.style-editor-loading` trimmed
- `EnrichmentQueue.css` — `.eq-empty` trimmed to padding override
- `EntityBrowser.css` — `.eb-list-empty` + `.eb-list-loading` trimmed
- `ImagePickerModal.css` — `.ipm-loading`, `.ipm-empty` trimmed to padding override
- `StoragePanel.css` — `.storage-panel-loading`, `.storage-panel-empty` trimmed
- `TraitPaletteSection.css` — `.tps-loading`, `.tps-empty`, `.tps-kind-empty` trimmed

**CSS files — selection bar deduplication:**
- `EnrichmentQueue.css` — `.eq-selection-bar` trimmed to position override
- `EntityBrowser.css` — `.eb-selection-bar` trimmed to gap/wrap overrides
- `ResultsPanel.css` — `.rp-selection-bar` trimmed to position override

**CSS files — stats grid deduplication:**
- `TraitPaletteSection.css` — `.tps-stats-grid`, `.tps-stat-card`, `.tps-stat-value`, `.tps-stat-label` removed entirely
- `StoragePanel.css` — stat classes trimmed to size overrides only
- `ResultsPanel.css` — stat classes trimmed to size overrides only

**CSS files — thumb cover/placeholder deduplication:**
- `ChronicleImagePicker.css` — `.cip-thumb-img`, `.cip-thumb-loading` removed entirely
- `ImagePickerModal.css` — `.ipm-thumbnail-img`, `.ipm-thumbnail-placeholder` removed entirely
- `StoragePanel.css` — `.storage-panel-thumbnail-img`, `.storage-panel-thumbnail-placeholder` removed entirely

**JSX/TSX files — class composition updates (added `ilu-*` prefix classes):**
- `EntryPointStep.tsx`, `StyleStep.tsx`, `EventResolutionStep.tsx`, `EntityDetailView.tsx` — empty state class composition
- `StyleLibraryEditor.jsx` — empty state class composition
- `ChronicleImagePicker.jsx` — empty state + thumb class composition
- `EnrichmentQueue.jsx` — empty state + selection bar class composition
- `EntityBrowser.jsx` — empty state + selection bar class composition
- `ImagePickerModal.jsx` — empty state + thumb class composition
- `ResultsPanel.jsx` — selection bar class composition
- `StoragePanel.jsx` — empty state + stats + thumb class composition
- `TraitPaletteSection.tsx` — empty state + stats class composition

### Intentional Exceptions
- `GenerateStep.css`, `RoleAssignmentStep.css`, `ImageSettingsDrawer.css`, `WorldContextEditor.css` — these files appeared in the similarity cluster but contain only domain-specific layout rules (wizard step containers, drawer panels) with no duplicated empty-state, selection-bar, stats-grid, or thumb patterns to consolidate
- BackrefImageEditor.css `.bie-selected-overlay` uses hardcoded `rgb(59 130 246 / 30%)` — CSS `var()` cannot be used inside `rgb()` function parameters, so this accent alpha overlay remains literal

### Breaking Changes
- None. All changes are additive — shared utility classes provide the base, component-prefixed classes provide overrides.

## 2026-02-28 — CSS Duplication: dependency-viewer.css, naming-profile-viewer.css, validation.css

### Canonical Pattern
Shared-components card.css and editor.css (`packages/shared-components/src/styles/components/`) are the canonical CSS for card and editor layout patterns. App-specific compact sizing is expressed as overrides in `compact-overrides.css`, not as full local copies.

Common viewer page patterns (section cards, collapsible headers, data rows, badges, tables, empty states) are provided by `packages/shared-components/src/styles/components/viewer.css`.

### Files Changed

**Eliminated local card.css and editor.css from coherence-engine:**
- `apps/coherence-engine/webui/src/styles/components/card.css` — **deleted**; compact overrides moved to `compact-overrides.css`
- `apps/coherence-engine/webui/src/styles/components/editor.css` — **deleted**; compact overrides moved to `compact-overrides.css`
- `apps/coherence-engine/webui/src/styles/components/compact-overrides.css` — added card and editor compact override sections (~100 rules) covering the sizing/spacing/background differences
- `apps/coherence-engine/webui/src/styles/index.css` — removed `@import` for local card.css and editor.css

**New shared viewer utility module:**
- `packages/shared-components/src/styles/components/viewer.css` — created with reusable viewer page patterns: `.viewer-container`, `.viewer-header`, `.viewer-section`, `.viewer-section-header`, `.viewer-item-row`, `.viewer-badge`, `.viewer-legend`, `.viewer-table`, `.viewer-empty-state`
- `packages/shared-components/src/styles/index.css` — added import for viewer.css

### Intentional Exceptions
- `apps/coherence-engine/webui/src/components/dependency-viewer/dependency-viewer.css` — retains component-prefixed classes (`.dependency-viewer-*`); gradual migration to `.viewer-*` shared classes is a follow-up task
- `apps/coherence-engine/webui/src/components/naming-profile-viewer/naming-profile-viewer.css` — retains component-prefixed classes (`.naming-profile-*`); gradual migration to `.viewer-*` shared classes is a follow-up task
- `apps/coherence-engine/webui/src/components/validation/validation.css` — retains component-prefixed classes (`.validation-*`); gradual migration to `.viewer-*` shared classes is a follow-up task

### Breaking Changes
- None. Compact overrides preserve identical visual output. Shared viewer.css is additive.

## 2026-02-28 — CSS Duplication: BulkChronicleAnnotationModal.css, ConfigPanel.css, CostsPanel.css, IlluminatorTabContent.css, StyleSelector.css

### Canonical Pattern
Muted hint text (`font-size: 12px; color: var(--text-muted)` and its 11px variant) extracted to shared utility classes `.ilu-hint` and `.ilu-hint-sm` in `packages/shared-components/src/styles/components/panel-utilities.css`. Status color utilities (`.ilu-status-warning`, `.ilu-status-success`, `.ilu-status-error`) already existed in panel-utilities.css and are now composed into components that previously redeclared those colors.

### Files Changed
- `packages/shared-components/src/styles/components/panel-utilities.css` — added `.ilu-hint` (12px muted) and `.ilu-hint-sm` (11px muted) utility classes
- `apps/illuminator/webui/src/components/BulkChronicleAnnotationModal.css` — removed `.bcam-warning-text` (uses `ilu-status-warning`), `.bcam-chronicle-title` (uses `truncate flex-1`), stripped `font-size`/`color` from `.bcam-progress-stats` (uses `ilu-hint-sm`)
- `apps/illuminator/webui/src/components/BulkChronicleAnnotationModal.jsx` — composed `ilu-status-warning`, `truncate flex-1`, `ilu-hint-sm` utility classes in className attributes
- `apps/illuminator/webui/src/components/ConfigPanel.css` — stripped `font-size`/`color` from `.cfgp-hint`, `.cfgp-section-desc`, `.cfgp-checkbox-hint`, `.cfgp-checkbox-hint-tight`, `.cfgp-about-text`, `.cfgp-about-text-spaced`
- `apps/illuminator/webui/src/components/ConfigPanel.jsx` — composed `ilu-hint` and `ilu-hint-sm` utility classes alongside component-prefixed classes
- `apps/illuminator/webui/src/components/CostsPanel.css` — stripped `font-size`/`color` from `.cpanel-section-hint` and `.cpanel-empty-hint`
- `apps/illuminator/webui/src/components/CostsPanel.jsx` — composed `ilu-hint` utility class alongside component-prefixed classes
- `apps/illuminator/webui/src/components/IlluminatorTabContent.css` — stripped `font-size`/`color` from `.itc-sync-hint` and `.itc-sync-summary`, removed `.itc-sync-status-error` and `.itc-sync-status-success` (use `ilu-status-*`)
- `apps/illuminator/webui/src/components/IlluminatorTabContent.jsx` — composed `ilu-hint`, `ilu-hint-sm`, `ilu-status-success` utility classes
- `apps/illuminator/webui/src/components/StyleSelector.css` — stripped `font-size`/`color` from `.stsel-compact-label` (deleted, uses `ilu-hint` directly), `.stsel-label`, `.stsel-description`
- `apps/illuminator/webui/src/components/StyleSelector.jsx` — composed `ilu-hint` and `ilu-hint-sm` utility classes alongside component-prefixed classes

### Intentional Exceptions
- `.bcam-chronicle-tone` — retained as-is because it uses `font-size: 10px` (not 11px or 12px), which doesn't match either utility class
- `.cpanel-clear-button` — retained `font-size: 11px` locally because it's a button size override, not hint text
- `.itc-sync-status` — retained locally because it has no `color: var(--text-muted)`, it's a status container not hint text

### Breaking Changes
- None. Visual output is identical — utility classes provide the same `font-size` and `color` values that were previously declared inline in each component CSS file.

## 2026-02-28 — CSS Duplication: ChainLinkSection.css, DiscoveryStory.css, EraNarrative.css, LoreSection.css

### Canonical Pattern
Shared structural base classes in `apps/archivist/webui/src/components/archivist-section.css`, parameterized by CSS custom properties (`--_section-border`, `--_section-bg`, `--_section-header-bg`, `--_section-separator`, `--_section-accent`, `--_section-text`). Components compose the shared classes (`.archivist-section`, `.archivist-section-hdr`, `.archivist-section-icon`, `.archivist-section-title`, `.archivist-narrative`, `.archivist-modal-overlay`, `.archivist-close-btn`, `.archivist-section-footer`, `.archivist-label`) alongside their prefixed component classes, setting color values via custom properties on the root element.

### Files Changed

**New shared file:**
- `apps/archivist/webui/src/components/archivist-section.css` — 9 shared structural classes for section containers, header bars, icons, titles, narrative text, labels, modal overlays, close buttons, and footers

**Archivist component CSS files (removed duplicated structural declarations):**
- `apps/archivist/webui/src/components/ChainLinkSection.css` — removed `.chain-link-header`, `.chain-link-icon`, `.chain-link-title` entirely; replaced structural properties on `.chain-link-section` and `.chain-link-text` with custom property definitions and shared class composition
- `apps/archivist/webui/src/components/DiscoveryStory.css` — removed `.discovery-story-header`, `.discovery-story-icon`, `.discovery-story-title`, `.discovery-story-section-title` structural dups; replaced overlay/close/footer structural properties with shared class composition; `.discovery-story-meta-label` now uses `.archivist-label` base
- `apps/archivist/webui/src/components/EraNarrative.css` — removed overlay structural properties (now via `.archivist-modal-overlay`), close button structural properties (now via `.archivist-close-btn`), footer structural properties (now via `.archivist-section-footer`); narrative text uses `.archivist-narrative` base
- `apps/archivist/webui/src/components/LoreSection.css` — removed `.lore-header`, `.lore-icon`, `.lore-title` entirely; replaced structural properties on `.lore-section` and `.lore-content` with custom property definitions and shared class composition

**Archivist component TSX files (updated class names to compose shared + component classes):**
- `apps/archivist/webui/src/components/ChainLinkSection.tsx` — added `archivist-section.css` import; root uses `archivist-section`, header uses `archivist-section-hdr`, icon uses `archivist-section-icon`, title uses `archivist-section-title`, text uses `archivist-narrative`
- `apps/archivist/webui/src/components/DiscoveryStory.tsx` — added `archivist-section.css` import; root uses `archivist-section`, header uses `archivist-section-hdr`, icon/title use shared classes, section titles use `archivist-section-title`, meta labels use `archivist-label`, narrative content uses `archivist-narrative`, overlay/close/footer use shared base classes
- `apps/archivist/webui/src/components/EraNarrative.tsx` — added `archivist-section.css` import; overlay uses `archivist-modal-overlay`, close button uses `archivist-close-btn`, footer uses `archivist-section-footer`, content uses `archivist-narrative`
- `apps/archivist/webui/src/components/LoreSection.tsx` — added `archivist-section.css` import; root uses `archivist-section`, header uses `archivist-section-hdr`, icon uses `archivist-section-icon`, title uses `archivist-section-title`, content uses `archivist-narrative`

**Guard artifacts:**
- `eslint-rules/no-archivist-section-drift.js` — ESLint rule detecting archivist component CSS files that re-declare structural properties already in archivist-section.css
- `docs/adr/032-archivist-section-css-consolidation.md` — ADR documenting the decision
- `docs/patterns/archivist-section.md` — usage guide for the shared section pattern

### Intentional Exceptions
- EraNarrative header/title/icon — the modal header has fundamentally different layout (centered, larger font sizes, text shadow, drop shadow filter) vs the inline section header pattern. EraNarrative uses the shared overlay, close button, footer, and narrative text base but keeps its own header implementation.

### Breaking Changes
- None. Visual output is identical — shared classes provide the same structural properties that were previously declared in each component CSS file, with color theming via CSS custom properties.

## 2026-02-28 — CSS Duplication: HistorianEditionComparison.css, ChronicleVersionSelector.css, WorkspaceHeader.css

**Area ID:** css-css-cluster-018

### Canonical Pattern
Shared utility classes in `packages/shared-components/src/styles/components/panel-utilities.css`:
- `.ilu-action-btn` / `.ilu-action-btn-sm` — compact tertiary action buttons (bg-tertiary, border, rounded)
- `.ilu-active-badge` (new) — green pill badge for active version indication
- `.ilu-compact-select` (new) — compact select inputs for version/comparison toolbars

Component CSS files keep only delta overrides (min-width, margin-left, extra-compact sizing, transitions) and compose shared classes via `className="ilu-action-btn wsh-btn-unpublish"`.

### Files Changed
- `packages/shared-components/src/styles/components/panel-utilities.css` — added `.ilu-active-badge` and `.ilu-compact-select` utility classes
- `apps/illuminator/webui/src/components/HistorianEditionComparison.css` — removed 6 duplicated button/badge/select declarations; kept component-specific overrides (padding, font-size, margin-left)
- `apps/illuminator/webui/src/components/HistorianEditionComparison.tsx` — compose shared classes: `ilu-action-btn-sm`, `ilu-active-badge`, `ilu-compact-select`
- `apps/illuminator/webui/src/components/chronicle-workspace/ChronicleVersionSelector.css` — removed 5 duplicated button/badge/select/disabled declarations; kept transition and confirming-delete state
- `apps/illuminator/webui/src/components/chronicle-workspace/ChronicleVersionSelector.jsx` — compose shared classes: `ilu-action-btn-sm`, `ilu-active-badge`, `ilu-compact-select`
- `apps/illuminator/webui/src/components/chronicle-workspace/WorkspaceHeader.css` — removed 3 duplicated tertiary button declarations and 1 disabled state; kept accept button (primary, unique) and component overrides
- `apps/illuminator/webui/src/components/chronicle-workspace/WorkspaceHeader.jsx` — compose shared class: `ilu-action-btn`

### Intentional Exceptions
- `wsh-btn-accept` — this is a primary accent button (no border, accent background, white text), not a tertiary action button. It does not share the pattern and is intentionally kept as a component-local style.

### Breaking Changes
- None. Visual output is identical — shared classes provide the base properties, component classes override sizing.

## 2026-02-28 — CSS Duplication: EpochTimeline.css, FinalDiagnostics.css, PopulationMetrics.css

### Canonical Pattern
Shared dashboard section utility classes (`.lw-section-spacer`, `.lw-section-label`, `.lw-section-label-hint`) in `apps/lore-weave/webui/src/App.css`. All three dashboard panel components had independently prefixed copies of the same section spacing and label styles — these are now consolidated into the shared `lw-` namespace alongside existing layout utilities.

### Files Changed

**Shared styles (App.css):**
- `apps/lore-weave/webui/src/App.css` — added `.lw-section-spacer`, `.lw-section-label`, `.lw-section-label-hint` utilities

**Component CSS (removed duplicated rules):**
- `apps/lore-weave/webui/src/components/dashboard/EpochTimeline.css` — removed `.et-section-spacer`, `.et-section-label`, `.et-section-label-hint`
- `apps/lore-weave/webui/src/components/dashboard/FinalDiagnostics.css` — removed `.fd-section-spacer`, `.fd-section-label`
- `apps/lore-weave/webui/src/components/dashboard/PopulationMetrics.css` — removed `.pm-section-spacer`, `.pm-section-label`

**Component JSX (updated class references):**
- `apps/lore-weave/webui/src/components/dashboard/EpochTimeline.jsx` — `et-section-spacer` → `lw-section-spacer`, `et-section-label` → `lw-section-label`, `et-section-label-hint` → `lw-section-label-hint`
- `apps/lore-weave/webui/src/components/dashboard/FinalDiagnostics.jsx` — `fd-section-spacer` → `lw-section-spacer`, `fd-section-label` → `lw-section-label`
- `apps/lore-weave/webui/src/components/dashboard/PopulationMetrics.jsx` — `pm-section-spacer` → `lw-section-spacer`, `pm-section-label` → `lw-section-label`

### Intentional Exceptions
- None. All three components used identical section spacer and label styles.

## 2026-02-28 — CSS Duplication: RelationshipKindEditor.css, TagRegistryEditor.css

### Canonical Pattern
Shared schema-editor utility classes (`se-select-compact`, `se-checkbox-sm`, `se-chip-framework`) in `apps/canonry/webui/src/components/SchemaEditor/schema-editor-shared.css`. Both editor components import this shared file alongside their prefixed component CSS.

### Files Changed

**New shared utility file:**
- `apps/canonry/webui/src/components/SchemaEditor/schema-editor-shared.css` — created with 3 shared utility classes for compact selects, small checkboxes, and framework chip styling

**RelationshipKindEditor (canonical):**
- `apps/canonry/webui/src/components/SchemaEditor/RelationshipKindEditor.css` — removed `.rke-select-compact`, `.rke-checkbox`, `.rke-chip-framework` (now in shared)
- `apps/canonry/webui/src/components/SchemaEditor/RelationshipKindEditor.jsx` — added shared CSS import; `rke-select-compact` → `se-select-compact`, `rke-checkbox` → `se-checkbox-sm`, `rke-chip-framework` → `se-chip-framework`

**TagRegistryEditor (variant):**
- `apps/canonry/webui/src/components/SchemaEditor/TagRegistryEditor.css` — removed `.tre-select-compact`, `.tre-checkbox`, `.tre-chip-framework` (now in shared)
- `apps/canonry/webui/src/components/SchemaEditor/TagRegistryEditor.jsx` — added shared CSS import; `tre-select-compact` → `se-select-compact`, `tre-checkbox` → `se-checkbox-sm`, `tre-chip-framework` → `se-chip-framework`

### Intentional Exceptions
- None. All three duplicated rules were byte-identical between the two files.

## 2026-02-28 — CSS Duplication: App.css, App.css (css-css-cluster-014)

### Canonical Pattern
Arctic Blue Theme base design tokens, CSS reset, and body styles extracted to
`packages/shared-components/src/styles/arctic-theme-base.css`. Each MFE App.css
imports this shared base and only overrides accent-specific variables
(`--accent-color`, `--accent-hover`, `--button-primary`, etc.).

### Files Changed
- `packages/shared-components/src/styles/arctic-theme-base.css` — **new** shared base containing `:root` custom properties (backgrounds, borders, text, arctic palette, spacing, font sizes, component colors, semantic colors), CSS reset, and body styles
- `packages/shared-components/package.json` — added `"./styles/arctic-theme-base"` export
- `apps/illuminator/webui/src/App.css` — replaced 82 lines of duplicated `:root` vars, reset, and body with `@import` of shared base; kept only purple accent overrides (`--accent-color`, `--purple-accent`, `--button-primary`, `--color-accent`, `--gradient-accent`)
- `apps/name-forge/webui/src/App.css` — replaced 82 lines of duplicated `:root` vars, reset, and body with `@import` of shared base; kept only gold accent overrides (`--accent-color`, `--gold-accent`, `--button-primary`, `--color-accent`, `--gradient-accent`)

### Intentional Exceptions
- `apps/lore-weave/webui/src/App.css` — uses `--lw-` prefixed variable names (a completely different naming convention), not part of this drift cluster. Would require a separate naming-convention unification pass.

## 2026-02-28 — CSS Duplication: WeightMatrixEditor.css, CoverageMatrix.css

### Canonical Pattern
Shared matrix base utility classes (`.mat-layout`, `.mat-scroll-area`, `.mat-table`, `.mat-row`, `.mat-toolbar`, `.mat-search`, `.mat-legend`) in `packages/shared-components/src/styles/components/matrix-base.css`. Components compose these utilities alongside their prefixed component classes (dual-class pattern).

### Files Changed

**New shared utility file:**
- `packages/shared-components/src/styles/components/matrix-base.css` — shared structural patterns for data matrix components (layout, scroll area, table, row hover, toolbar, search input, legend)
- `packages/shared-components/src/styles/index.css` — added `@import` for `matrix-base.css`

**WeightMatrixEditor (canonical):**
- `apps/coherence-engine/webui/src/components/weight-matrix/WeightMatrixEditor.css` — removed duplicated structural rules (container layout, scroll area, table base, row hover, toolbar base, search styling, legend base); kept component-specific rules (heatmap cells, cell editing, bulk actions, orphan warnings, view toggle, column widths, row action buttons)
- `apps/coherence-engine/webui/src/components/weight-matrix/WeightMatrixEditor.jsx` — added `mat-*` base classes alongside existing component classes

**CoverageMatrix (variant):**
- `packages/shared-components/src/components/CoverageMatrix/CoverageMatrix.css` — removed duplicated structural rules (container layout, toolbar base, search styling, table base, row hover, legend base); kept component-specific rules (stats bar, filter buttons, status badges, cell icons, column widths, grouped rows)
- `packages/shared-components/src/components/CoverageMatrix/CoverageMatrix.jsx` — added `mat-*` base classes alongside existing component classes

### Intentional Exceptions
- None. Both matrix components now share the same structural base.

## 2026-02-28 — CSS Duplication: actions.css, toggle.css

### Canonical Pattern
`toggle.css` at `packages/shared-components/src/styles/components/toggle.css` — the shared toggle switch component (`.toggle`, `.toggle-on`, `.toggle-knob`, `.toggle-disabled`, `.toggle-container`, `.toggle-label`).

### Files Changed
- `packages/shared-components/src/styles/components/actions.css` — removed duplicate `.enable-toggle`, `.enable-toggle-on`, `.enable-toggle-knob`, and `.enable-toggle-on .enable-toggle-knob` rules (lines 96-124). These were identical to `toggle.css` styles but with an `enable-` prefix, and were unused by any component.

### Intentional Exceptions
- None. The `enable-toggle` classes were dead CSS — no JSX/TSX file referenced them. The canonical `.toggle` classes in `toggle.css` serve the same purpose and are properly imported via the shared-components style index.

## 2026-02-28 — CSS Duplication: EnsembleConstellation.css, TimelineBrush.css

### Canonical Pattern
Shared SVG visualization utility classes extracted into `visualization-base.css` in the `visualizations/` directory. Common patterns (`display: block`, `pointer-events: none`, cursor utilities) are defined once and imported by each component CSS file.

### Files Changed
- `apps/illuminator/webui/src/components/ChronicleWizard/visualizations/visualization-base.css` — **new** shared CSS with `.viz-svg`, `.viz-no-pointer`, `.viz-cursor-pointer`, `.viz-grab`, `.viz-ew-resize`
- `apps/illuminator/webui/src/components/ChronicleWizard/visualizations/EnsembleConstellation.css` — removed duplicated `display: block`, `cursor: pointer`, `pointer-events: none` rules; now imports `visualization-base.css` and keeps only component-specific styles (background, border-radius)
- `apps/illuminator/webui/src/components/ChronicleWizard/visualizations/TimelineBrush.css` — removed duplicated `display: block`, `pointer-events: none`, `cursor: grab`, `cursor: ew-resize` rules; now imports `visualization-base.css` and keeps only component-specific styles (CSS variable cursor)
- `apps/illuminator/webui/src/components/ChronicleWizard/visualizations/EnsembleConstellation.tsx` — updated class names: `ec-cursor-pointer` → `viz-cursor-pointer`, `ec-no-pointer` → `viz-no-pointer`, added `viz-svg` alongside `ec-svg`
- `apps/illuminator/webui/src/components/ChronicleWizard/visualizations/TimelineBrush.tsx` — updated class names: `tb-no-pointer` → `viz-no-pointer`, `tb-grab` → `viz-grab`, `tb-ew-resize` → `viz-ew-resize`, added `viz-svg` alongside `tb-svg`

### Intentional Exceptions
- `NarrativeTimeline.css`, `StoryPotentialRadar.css`, `IntensitySparkline.css`, `MiniConstellation.css` — also contain duplicated `display: block` / `pointer-events: none` but were outside this cluster's scope. They can adopt `visualization-base.css` in a follow-up pass.

## 2026-02-28 — CSS Duplication: AxisRegistry.css, RelationshipEditor.css

### Canonical Pattern
Shared cosmographer editor CSS utilities extracted to `apps/cosmographer/webui/src/styles/cosmographer-editor.css`. Defines common `cosmo-*` classes for modals, forms, buttons, empty states, layout, and arrows used across cosmographer editor components.

### Files Changed
- `apps/cosmographer/webui/src/styles/cosmographer-editor.css` — NEW: shared CSS for modal overlay, modal content, modal title, modal actions, form groups, labels, inputs, selects, hints, add/cancel/save/delete/edit buttons, empty state, editor container/header/title/subtitle, toolbar, actions row, count, and arrow
- `apps/cosmographer/webui/src/components/AxisRegistry/AxisRegistry.css` — removed 19 duplicated rules (modal, form, button, layout classes), added `@import` of shared CSS, kept component-specific rules (axis card list, axis range, tags, usage info, input row, save opacity)
- `apps/cosmographer/webui/src/components/AxisRegistry/index.jsx` — updated class names to use `cosmo-*` shared classes for container, header, title, subtitle, toolbar, count, add button, actions, edit button, delete button, arrow, modal, modal content, modal title, form groups, labels, inputs, hints, modal actions, cancel button, save button
- `apps/cosmographer/webui/src/components/RelationshipEditor/RelationshipEditor.css` — removed 16 duplicated rules (container, header, title, subtitle, toolbar, add button, delete button, empty state, modal, modal content, modal title, form group, label, input, modal actions, button/hint/arrow), added `@import` of shared CSS, kept component-specific rules (filter select, table layout, kind badge, entity link, modal width, empty state background override)
- `apps/cosmographer/webui/src/components/RelationshipEditor/index.jsx` — updated class names to use `cosmo-*` shared classes for container, header, title, subtitle, toolbar, add button, hints, empty state, arrow, delete button, modal, modal content, modal title, form groups, labels, selects, inputs, modal actions, cancel button

### Intentional Exceptions
- `CultureEditor/CultureEditor.css`, `EntityEditor/EntityEditor.css` — also contain similar patterns (title, header, empty state, form group, label, input, delete button) but were outside this cluster's scope. They can adopt `cosmographer-editor.css` in a follow-up pass.

## 2026-02-28 — Search Keyboard Navigation Duplication

### Canonical Pattern
Shared `useKeyboardNavigation` hook in `packages/shared-components/src/components/hooks/useKeyboardNavigation.js`. Accepts an options object `{ results, selectedIndex, setSelectedIndex, onSelect, onEscape }` and returns a memoized `onKeyDown` handler. Callers supply their own `onEscape` callback to control Escape behavior (clear query vs. preserve query).

### Files Changed
- `packages/shared-components/src/components/hooks/useKeyboardNavigation.js` — **new**: extracted shared hook with configurable `onEscape` callback
- `packages/shared-components/src/index.js` — added `useKeyboardNavigation` export
- `packages/shared-components/src/components/index.js` — added `useKeyboardNavigation` export
- `apps/viewer/webui/src/HeaderSearch.jsx` — removed local `useKeyboardNavigation` function, imported shared hook, adapted to options-object API with `onEscape: () => handleSelect(null)` (clears query + closes)
- `apps/chronicler/webui/src/components/WikiSearch.tsx` — replaced inline `handleKeyDown` switch block with shared hook, passes `onEscape: () => setIsOpen(false)` (closes dropdown, preserves query) and `onSelect` that also closes + clears

### Intentional Exceptions
None — both search components now use the shared hook.

---

## 2026-02-28 — CSS Duplication: empty-state.css, error-boundary.css

### Canonical Pattern
`empty-state.css` at `packages/shared-components/src/styles/components/empty-state.css` — the base centered-message layout (flex column, centered, padded, with icon/title/description slots).

### What Changed
The `error-boundary.css` duplicated the entire centered-message layout from `empty-state.css` (flex column container, title typography, description/message styling). The ErrorBoundary component now composes on the `empty-state` base classes, and `error-boundary.css` is stripped to only error-specific overrides:
- Container: `height: 100%; min-height: 200px;` (fill parent)
- Icon: circular danger badge (completely different from emoji icon)
- Message: smaller font-size (`--font-size-md` vs `--font-size-lg`) + `word-break: break-word`
- Retry button: unique to error boundary

### Files Changed
- `packages/shared-components/src/styles/components/error-boundary.css` — removed duplicated layout, title, and description properties; now only contains error-specific overrides that compose on `.empty-state` base
- `packages/shared-components/src/components/ErrorBoundary.jsx` — container uses `empty-state error-boundary` (composed classes); title uses `empty-state-title` (was identical to deleted `error-boundary-title`); message uses `empty-state-desc error-boundary-message` (base + override)

### Intentional Exceptions
None — both centered-message components now share the base layout from `empty-state.css`.

## 2026-02-28 — Test Infrastructure Absence in WebUI Apps

### Canonical Pattern
Vitest configured with jsdom environment for React component testing, matching the library-level vitest setup in `apps/lore-weave/vitest.config.ts` and `apps/name-forge/vitest.config.ts`. Each webui app has its own `vitest.config.ts`, test scripts (`test`, `test:watch`, `test:coverage`), and vitest devDependencies (`vitest`, `@vitest/coverage-v8`, `jsdom`).

### Files Changed
- `apps/archivist/webui/vitest.config.ts` — created; jsdom environment, v8 coverage, co-located test pattern
- `apps/archivist/webui/package.json` — added test scripts and vitest devDependencies
- `apps/canonry/webui/vitest.config.ts` — created; jsdom environment, v8 coverage, co-located test pattern
- `apps/canonry/webui/package.json` — added test scripts and vitest devDependencies
- `apps/chronicler/webui/vitest.config.ts` — created; jsdom environment, v8 coverage, co-located test pattern
- `apps/chronicler/webui/package.json` — added test scripts and vitest devDependencies
- `apps/coherence-engine/webui/vitest.config.ts` — created; jsdom environment, v8 coverage, co-located test pattern
- `apps/coherence-engine/webui/package.json` — added test scripts and vitest devDependencies
- `apps/cosmographer/webui/vitest.config.ts` — created; jsdom environment, v8 coverage, co-located test pattern
- `apps/cosmographer/webui/package.json` — added test scripts and vitest devDependencies
- `apps/illuminator/webui/vitest.config.ts` — created; jsdom environment, v8 coverage, `@lib` alias mirroring vite.config.js
- `apps/illuminator/webui/package.json` — added test scripts and vitest devDependencies
- `apps/viewer/webui/vitest.config.ts` — created; jsdom environment, v8 coverage, co-located test pattern
- `apps/viewer/webui/package.json` — added test scripts and vitest devDependencies

### Intentional Exceptions
- `apps/lore-weave/webui/` and `apps/name-forge/webui/` — these webui directories also lack test infrastructure, but their parent library directories already have vitest configured. They could be migrated in a follow-up pass.

### Notes
Run `pnpm install` after this change to install the new devDependencies.

## 2026-02-28 — TypeScript/JavaScript Migration State

### Canonical Pattern
Fully TypeScript with interfaces for props, `import type {}` for type-only imports, and `tsconfig.json` with three-file composite structure (tsconfig.json + tsconfig.app.json + tsconfig.node.json). Reference implementations in `apps/archivist/` and `apps/chronicler/`.

### Files Changed

**shared-components — full TypeScript migration (39 files):**
- All 28 `.jsx` component files renamed to `.tsx`, PropTypes replaced with TypeScript interfaces
- All 4 `.js` barrel/index files renamed to `.ts`
- All 3 `.js` hook files renamed to `.ts` with typed parameters/returns
- All 4 `.js` utility/constant files renamed to `.ts` with type annotations
- `packages/shared-components/package.json` — updated main/exports from `.js`/`.jsx` to `.ts`/`.tsx`, removed `prop-types` dependency
- `packages/shared-components/tsconfig.json` — created with `strict: true`

**tsconfig.json infrastructure (12 files created):**
- `apps/canonry/webui/tsconfig.json` + `tsconfig.app.json` + `tsconfig.node.json`
- `apps/coherence-engine/webui/tsconfig.json` + `tsconfig.app.json` + `tsconfig.node.json`
- `apps/name-forge/webui/tsconfig.json` + `tsconfig.app.json` + `tsconfig.node.json`
- `apps/cosmographer/webui/tsconfig.json` + `tsconfig.app.json` + `tsconfig.node.json`
- All use `allowJs: true`, `checkJs: false`, `strict: false` for incremental migration

**illuminator hooks — TypeScript conversion (13 files):**
- `useApiKeys.js` → `.ts` — typed state, return type, helper functions
- `useConfigSync.js` → `.ts` — typed EnrichmentConfig interface, normalizer functions
- `useBackportFlow.js` → `.ts` — typed all 10 helper functions, BackportConfigContext interface
- `useHistorianCallbacks.js` → `.ts` — typed all 14 helper functions, HistorianWorldContext interface
- `useEntityGuidanceSync.js` → `.ts` — typed EntityGuidance/CultureIdentities state
- `useHistorianConfigSync.js` → `.ts` — typed HistorianConfig state and resolvers
- `useWorldContextSync.js` → `.ts` — typed LocalWorldContext interface
- `usePromptBuilder.js` → `.ts` — typed StyleSelection, EraInfo, PromptBuilderConfig interfaces
- `useDynamicsFlow.js` → `.ts` — typed WorldContextForDynamics, helper functions
- `useIlluminatorSetup.js` → `.ts` — typed WorldData, ApiKeys, IlluminatorConfig interfaces
- `useSlotManagement.js` → `.ts` — typed ProjectSlotState, EraInfo interfaces
- `useRevisionFlow.js` → `.ts` — typed RevisionFilterState, all 10 helper functions
- `useDataSync.js` → `.ts` — typed SyncMode, DataSyncStatus, WorldData, all 12 helpers

**Guard artifacts:**
- `eslint-rules/no-js-file-extension.js` — warns on `.js`/`.jsx` files in frontend source
- `eslint.config.js` — wired `no-js-file-extension` rule + `no-restricted-imports` banning `prop-types`
- `docs/adr/044-typescript-migration.md` — decision record
- `docs/patterns/typescript-migration.md` — migration guide with conversion reference

### Intentional Exceptions
- `apps/canonry/webui/src/**/*.jsx` (47 files) — fully JavaScript app, tsconfig added but files not yet converted. Tracked by `no-js-file-extension` warnings.
- `apps/coherence-engine/webui/src/**/*.jsx` (115 files) — fully JavaScript app, same status as canonry.
- `apps/name-forge/webui/src/**/*.jsx` (28 files) — webui is JavaScript while lib/ is TypeScript. tsconfig added.
- `apps/cosmographer/webui/src/**/*.jsx` (8 files) — webui is JavaScript while lib/ is TypeScript. tsconfig added.
- `apps/lore-weave/webui/src/**/*.jsx` (28 files) — webui is JavaScript while lib/ is TypeScript.
- `apps/illuminator/webui/src/components/**/*.jsx` (67 files) — remaining JSX components not yet converted (hooks are done).
- `apps/viewer/webui/src/**/*.jsx` (5 files) — small app, not yet converted.

### Notes
~320 JavaScript files remain across app webuis. Each is tracked by the `local/no-js-file-extension` ESLint warning. The `no-restricted-imports` rule prevents PropTypes regression. Migration should proceed incrementally — convert files as they are touched for feature work.

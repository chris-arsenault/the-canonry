# Drift Audit Report
Generated: 2026-02-28

## Summary

- **Total drift areas:** 47
- **Structural:** 8
- **Behavioral:** 39

## Structural Drift

### TypeScript/JavaScript Migration State

The monorepo has 824 source files split roughly 50/50 between TypeScript (424 .ts/.tsx) and JavaScript (392 .js/.jsx), but the distribution is wildly inconsistent across apps. Some apps are fully TypeScript, some fully JavaScript, some have clean separation by directory, and one (illuminator) has .ts and .js files interleaved in the same directories. The shared-components package — consumed by every MFE — is 100% JavaScript with PropTypes instead of TypeScript interfaces.

**Recommendation:** Start with shared-components: convert its 37 files to .tsx with TypeScript interfaces replacing PropTypes. This immediately benefits all consuming TS apps. Then add tsconfig.json (with allowJs: true, strict: false as a first step) to canonry and coherence-engine. For illuminator, enforce a rule that new files must be .ts/.tsx and incrementally convert the 13 remaining .js hooks.

### Component Directory Organization

MFE apps use three fundamentally different patterns for organizing component files within webui/src/components/: flat single-file components, deeply nested feature directories with barrel index exports, and a hybrid approach. This affects import ergonomics, code discoverability, and the mechanics of adding new components.

**Recommendation:** Adopt a two-tier convention: flat for apps with <30 components (archivist, canonry, chronicler, cosmographer), feature-directory with barrel exports for larger apps (coherence-engine, illuminator, name-forge, lore-weave). The immediate win is restructuring illuminator's 128-file flat directory into feature groups (chronicle/, entity/, historian/, backport/, etc.).

### CSS Architecture and Scoping Strategy

Three fundamentally different CSS architectures coexist across the MFEs: standard co-located CSS with manual prefix namespacing (7 apps), CSS Modules with automatic scoping (1 app), and a centralized design system directory with reusable component styles (1 app). Class naming conventions also diverge — some use full component names (.entity-detail-header), others use 2-3 letter abbreviations (.edv-meta-row, .chron-card), and CSS Modules use generic semantic names (.container, .heading).

**Recommendation:** The pragmatic convergence path: (1) Extract coherence-engine's styles/theme.css and base.css into shared-components as the shared design token layer. (2) Adopt CSS Modules as the canonical scoping strategy for new components (chronicler's pattern). (3) Add a stylelint rule enforcing .module.css for new files. Migrating existing co-located CSS is low-priority since the manual prefix convention works adequately for existing code.

### Vite Config File Extension Inconsistency

Vite configuration files use two different extensions: vite.config.ts (TypeScript, 2 apps) vs vite.config.js (JavaScript, 7 apps). The TypeScript configs import types (type PluginOption) and use path from 'node:path', while JS configs use resolve from 'node:path'. Both sets share the same federation config import (config/federation.js) and follow the same structural pattern.

**Recommendation:** Low priority. Will resolve naturally when apps adopt TypeScript. Not worth addressing independently.

### Vite Path Alias Configuration Patterns

Apps use four different Vite resolve.alias patterns to reference shared code: @lib pointing to ../lib (3 apps), @the-canonry/* pointing to package source (2 apps), @name-forge pointing to another app's source (1 app), @chronicler pointing to another app's source (1 app), and no aliases at all (3 apps). This creates inconsistent import ergonomics and hidden cross-app coupling.

**Recommendation:** Eliminate cross-app source aliases first: viewer should load chronicler via module federation (or the chronicler components it needs should be extracted to a shared package). cosmographer should consume name-forge as a package dependency rather than aliasing to its source. For the @lib alias, standardize: either all lib-having apps use it or none do. The @the-canonry/world-store source alias is acceptable during development but should be documented as a dev-only optimization.

### Import Path Extension Conventions

TypeScript apps use two different conventions for local import extensions: archivist includes explicit .tsx/.ts extensions in import paths (import LoreSection from './LoreSection.tsx'), while chronicler, illuminator, and all JavaScript apps omit extensions (import ChroniclePanel from './ChroniclePanel'). This creates inconsistency in how files reference each other across the monorepo.

**Recommendation:** Low priority. If addressed, standardize on extensionless imports (the dominant convention) and remove .tsx/.ts extensions from archivist's imports. This is a quick find-and-replace task but shouldn't block other work.

### Test Infrastructure Absence in WebUI Apps

Only 2 of 9 apps (lore-weave, name-forge) have vitest configuration files, and even those have zero test files (.test.* or .spec.*). No webui app has any test infrastructure. The monorepo has 824 source files and 0 test files. This is a structural gap rather than drift between variants, but it means there is no testable pattern to standardize on.

**Recommendation:** If testing becomes a priority, start with the core libraries (lore-weave/lib, name-forge/lib) which already have vitest configured. For webui apps, add @testing-library/react and vitest to the shared config and create a standard test file convention (ComponentName.test.tsx co-located with the component).

### WebUI Source Directory Organization

The webui/src/ directories across MFE apps use different subdirectory conventions for organizing non-component code. Some use hooks/, some use lib/, some use stores/, some use storage/, some use utils/, some use types/, some use workers/, some use styles/ — with no consistent convention for which directories exist or what they contain. This means developers must learn a different organizational model for each app.

**Recommendation:** Define a canonical webui/src/ structure in a pattern doc: components/ (React components), hooks/ (React hooks), lib/ (business logic, data access, non-React utilities), types/ (TypeScript type definitions), styles/ (shared/global CSS). This aligns with the illuminator/chronicler pattern which is the most complete. Rename canonry's stores/ and storage/ to align (Zustand stores could live in lib/stores/). Don't force-migrate immediately — adopt for new code and align during feature work.

## Behavioral Drift

### Form Validation & Input Behavior

#### Textarea State Commit Pattern Inconsistency

The shared component library provides LocalTextArea (blur-commit with focus-tracking to prevent cursor jumping), but illuminator uses raw <textarea> elements with ad-hoc local state in 11 files while only 4 files adopt LocalTextArea. Coherence-engine has near-perfect adoption (10+ files). The ad-hoc implementations in illuminator lack the focus-tracking guard that LocalTextArea provides, making them vulnerable to parent re-render disruption during editing.

**Variants:** 3

**Recommendation:** Enhance LocalTextArea({ onCommit?: () => void, onCancel?: () => void, trimOnCommit?: boolean }) and migrate all raw <textarea> uses in illuminator to use it.

#### NumberInput Shared Component Adoption Gap

The shared NumberInput component handles edge cases (negative numbers, intermediate states like '-' and '.', min/max constraints, blur-commit with revert on invalid) and is heavily adopted in coherence-engine (23 files), name-forge, lore-weave, and cosmographer. However, illuminator uses 0 NumberInput instances and instead has 12+ raw <input type="number"> elements that lack intermediate state handling and use immediate onChange with parseFloat/parseInt.

**Variants:** 2

**Recommendation:** Migrate all raw <input type="number"> to NumberInput across illuminator (12 instances in 5 files) and name-forge's PhonemeWeightGrid (1 instance).

#### useLocalInputState Hook Adoption Gap

The useLocalInputState hook provides blur-commit behavior for text inputs to prevent cursor jumping. It is well-adopted in coherence-engine (4 files, used for ID and name fields) but completely unused in illuminator, name-forge, cosmographer, and other apps — even where the same cursor-jumping problem exists.

**Variants:** 2

**Recommendation:** Document when to use useLocalInputState (store-bound inputs) vs direct binding (modal-local state). Optionally add a validate parameter to the hook for the TagIdInput use case.

#### Inconsistent Debounce/Autosave Implementation

Three distinct autosave/debounce patterns exist: (1) canonry App.jsx has 6 identical useEffect blocks with 300ms setTimeout for persistence, (2) name-forge ProfileModal and GrammarsTab use 1000ms setTimeout with ref-based last-saved tracking, and (3) illuminator uses no debounce — changes propagate immediately or are blur-committed. All debounce implementations are hand-rolled with useRef + setTimeout; no shared utility exists.

**Variants:** 3

**Recommendation:** Extract a shared useDebouncedSave(value, saveFn, delay) hook into shared-components. Parametrize delay (300ms for persistence, 1000ms for complex editors). Replace the 6 identical useEffect blocks in App.jsx and 2 in name-forge.

#### Validation Error Display Pattern Divergence

Four distinct validation display patterns exist across the monorepo: (1) ValidationPopover in canonry — compact stay-open popover with auto-fix capability, (2) ValidationPanel in lore-weave — full-page panel with error/warning separation, (3) ErrorBadge/TabValidationBadge in coherence-engine — inline count badges on cards and tabs, (4) inline error divs in name-forge and cosmographer. Each was built independently with different ErrorCard components, different CSS class prefixes, and different levels of detail shown.

**Variants:** 4

**Recommendation:** Extract a shared ErrorCard({ error, isWarning, showGot?, onAutoFix? }) component. Keep ValidationPopover and ValidationPanel as separate containers but have them both use the shared ErrorCard. Standardize inline error display with a shared InlineError component.

#### Inconsistent Required Field Indication

Required field indication is inconsistent: some forms use asterisk (*) in labels (StyleLibraryEditor 'Name *', 'Prompt Fragment *'; CreateEntityModal 'Name *'), most forms show no required indicator at all, and no forms use HTML required attributes or aria-required. Validation of required fields happens at submit time via disabled button state rather than inline feedback.

**Variants:** 2

**Recommendation:** Standardize on asterisk (*) for required labels across all form-like interfaces. Add aria-required="true" to all required inputs. For coherence-engine's auto-save pattern, consider a visual cue (e.g., red border) when a required field is empty.

#### Form Submission Pattern Inconsistency

Forms are submitted through three different mechanisms: (1) HTML <form onSubmit> with e.preventDefault() in illuminator's StyleLibraryEditor (supports Enter-to-submit), (2) button onClick handlers in most modals (CreateEntityModal, DomainTab, LexemesTab), (3) implicit auto-save on blur with no explicit submit in coherence-engine. The HTML form pattern supports Enter-to-submit and proper form semantics; the onClick pattern does not.

**Variants:** 3

**Recommendation:** For modals with explicit submit actions, wrap content in <form onSubmit> and use type="submit" on primary buttons to enable Enter-to-submit. Leave coherence-engine's auto-save pattern as-is — it's intentionally formless.

### Keyboard & Accessibility Patterns

#### Modal Overlay ARIA Role Semantics

Modal overlays across the codebase use role="button" on the backdrop div instead of role="dialog" with aria-modal="true". Only one component in the entire codebase (ImageLightbox.tsx in chronicler) uses the correct role="dialog" + aria-modal pattern. The remaining ~20+ modal overlays all use role="button" on both the backdrop and the inner content div (which has e.stopPropagation()), making them semantically incorrect. Screen readers will announce these as buttons rather than dialogs.

**Variants:** 2

**Recommendation:** Update ModalShell overlay to use role="dialog" aria-modal="true" aria-label={title}. Remove role/tabIndex/onKeyDown from the inner content div. Add an eslint rule against role="button" on elements with modal-overlay CSS classes.

#### Toggle/Switch ARIA Semantics

The shared EnableToggle component uses role="button" instead of role="switch" with aria-checked. This means screen readers cannot communicate the on/off state of toggles — users only hear "button" with no indication of the current value. Zero files in the codebase use role="switch" or aria-checked anywhere. The toggle's visual state (CSS class toggle-on) is invisible to assistive technology.

**Variants:** 1

**Recommendation:** Change EnableToggle to use role="switch" aria-checked={enabled}. Also add an aria-label prop defaulting to the existing label text if provided.

#### Collapsible Section aria-expanded Consistency

56 files implement expand/collapse patterns (via expanded/setExpanded state, ExpandableCard component, or custom expand icons). Only 1 file (WikiNav.tsx in chronicler) uses aria-expanded on the toggle button to communicate the expanded state to assistive technology. The remaining 55 files, including the shared ExpandableCard component, visually show expanded/collapsed state (via arrow icon rotation) but never communicate it to screen readers.

**Variants:** 3

**Recommendation:** Add aria-expanded={expanded} to ExpandableCard header div — this is a 1-line fix propagating to ~20 consumers. For custom implementations, consider extracting a useExpandable hook or converting them to use ExpandableCard. Add an eslint rule: any element with expand-icon or expand/collapse CSS classes must have aria-expanded.

#### Search Keyboard Navigation Duplication

Two search components implement nearly identical arrow-key navigation (ArrowUp/ArrowDown to move selection, Enter to select, Escape to close) but with different code structures and subtly different Escape behavior. HeaderSearch (viewer) extracts this into a reusable useKeyboardNavigation hook, while WikiSearch (chronicler) duplicates the same logic inline. Their Escape behaviors also diverge: HeaderSearch clears the query and closes; WikiSearch closes the dropdown but preserves the query text.

**Variants:** 2

**Recommendation:** Move useKeyboardNavigation from HeaderSearch to shared-components with an onEscape callback parameter. WikiSearch and HeaderSearch can each pass their preferred Escape behavior.

#### Body Scroll Lock Restore Pattern Inconsistency

Components that lock body scroll (overflow: hidden) on mount use two different restore strategies: (A) restore to empty string '' — used by ImageModal and ChronicleWizard, and (B) save previous overflow value and restore it — used by ModalShell and ImageLightbox. Pattern A can clobber a previous overflow setting if modals are stacked.

**Variants:** 2

**Recommendation:** Update ImageModal and ChronicleWizard to save/restore previous overflow value, matching the ModalShell and ImageLightbox pattern. Consider extracting a useScrollLock hook to shared-components to prevent future drift.

#### Incomplete Listbox/Option ARIA Pattern

ChroniclePanel's entity suggestion dropdown uses role="option" on items but lacks a parent role="listbox" container, tabIndex on options, and keyboard navigation. The SearchableDropdown shared component has a similar dropdown pattern but uses role="button" on options instead. Neither implements the ARIA listbox pattern correctly.

**Variants:** 2

**Recommendation:** Implement the ARIA combobox/listbox pattern on SearchableDropdown: role="listbox" on options container, role="option" on items, arrow-key navigation, Escape to close. Then have ChroniclePanel use SearchableDropdown or replicate the same pattern.

#### Sparse and Inconsistent aria-label Usage

Only 5 files in the entire codebase use aria-label, all in chronicler and illuminator apps. Zero files use aria-describedby, aria-haspopup, aria-pressed, aria-selected, or aria-live. Icon-only buttons (close ×, expand ▶, sidebar <, >, add +) across the codebase lack aria-label, making them inaccessible to screen readers.

**Variants:** 2

**Recommendation:** Add aria-label="Close" to ModalShell btn-close button. Add aria-label="Close" prop pass-through for custom close buttons. For the chronicler app specifically, audit all interactive elements for aria-label as it may have public-facing accessibility requirements.

### Loading & Error State Patterns

#### Loading Indicator Inconsistency

Loading states are communicated to users via at least 5 distinct visual patterns across apps: plain text, CSS-animated spinners, emoji icons with structured cards, Unicode symbols with animation, and Suspense fallback divs. There is no shared loading indicator component despite the shared-components package existing.

**Variants:** 5

**Recommendation:** Create a shared <LoadingIndicator> component in packages/shared-components with variants: 'spinner' (CSS-animated empty element), 'text' (simple loading text), and 'card' (icon + title + message). Extract the spinner CSS animation into shared-components. Adopt shared component across all apps.

#### Error Display Pattern Divergence

Errors are displayed to users via at least 5 distinct presentation patterns: bare CSS class divs, component-prefixed error classes, full-screen state cards, toast notifications, and inline status text. No shared error display component exists despite 40+ files displaying errors.

**Variants:** 6

**Recommendation:** Create shared <ErrorDisplay variant='inline|banner|card|toast'> in packages/shared-components. Props: message (string), title (optional string), icon (optional), onRetry (optional callback), onDismiss (optional callback), fallbackMessage (default: 'An unexpected error occurred'). Migrate Name Forge's bare 'error' class usage first (most files, simplest migration), then Illuminator's component-prefixed patterns.

#### Empty State Presentation Inconsistency

Empty states are presented via at least 4 patterns: a structured CSS component (icon + title + desc + CTA) in Coherence Engine, app-prefixed structured cards in Archivist, simple text messages in Illuminator, and 'empty-state-compact' one-liners. Only Coherence Engine has a dedicated empty-state CSS file.

**Variants:** 4

**Recommendation:** Extract Coherence Engine's empty-state.css and pattern into a shared <EmptyState icon? title description cta?> component in packages/shared-components. Support variants: 'full' (icon + title + desc + CTA) and 'compact' (inline text). Migrate Archivist and Illuminator to use the shared component.

#### Inconsistent Error Recovery Mechanisms

Error recovery ranges from comprehensive (Retry + Reload buttons in Viewer) to nonexistent (most error displays offer no recovery action). The shared ErrorBoundary has a retry mechanism, but operational errors in most components lack any recovery path.

**Variants:** 5

**Recommendation:** Add retry callbacks to Archivist and Chronicler data-loading error states (highest impact, simplest fix). Standardize that all full-screen error cards include at minimum a Retry button. Consider a shared <ErrorCard title message onRetry? onReload?> that enforces this pattern. Leave LLM-specific retry variants (Retry with Feedback) as intentional variation.

#### ErrorBoundary Usage Gap

The shared ErrorBoundary component is used at MFE host boundaries only (7 files). No app uses ErrorBoundary internally around complex components that could crash (3D views, chart renderers, etc.), leaving unhandled render errors to propagate to the MFE-level boundary with a generic message.

**Variants:** 2

**Recommendation:** Add ErrorBoundary around crash-prone components: Archivist's GraphView3D/GraphView/TimelineView3D, Canonry's TracePopover lazy-loaded mermaid. Low priority — the MFE boundary already provides a safety net.

#### Progress Display Pattern Divergence

Two apps (Lore Weave, Illuminator) have progress display for long-running operations but use completely different component structures, stats layouts, and CSS variable conventions despite serving the same purpose.

**Variants:** 2

**Recommendation:** Extract a shared <ProgressBar percent={number} /> component to shared-components with standardized CSS. Keep the surrounding layout and stats grid app-specific, as they serve genuinely different domains. Low priority.

### Modal/Dialog Interaction Consistency

#### Modal Close Behavior Consistency

Modals across the codebase implement overlay-click-to-close with three distinct patterns: ModalShell's canonical mouseDown guard, ad-hoc mouseDown guard reimplementations, and raw onClick on overlay (bug-prone). Several modals lack overlay close entirely.

**Variants:** 6

**Recommendation:** Migrate all standard modals to ModalShell. For non-standard layouts: (a) Add ModalShell variant or 'fullscreen' className for ImageModal/ImageLightbox; (b) QuickCheckModal and ResultsModal should migrate to ModalShell immediately — their onClick bug is user-visible; (c) Add role='dialog' aria-modal='true' to ModalShell (currently only ImageLightbox has correct ARIA); (d) ModalShell should preserve previous overflow value (ImageLightbox pattern) instead of resetting to empty string.

#### Modal Overlay CSS Class Proliferation

Modal overlays across the codebase use 8+ different CSS class names for what is fundamentally the same visual pattern (fixed position, dark semi-transparent background, centered flex container). Each carries its own styling definition rather than reusing the canonical .modal-overlay class.

**Variants:** 2

**Recommendation:** Migration to ModalShell eliminates this for standard modals. For non-ModalShell modals, compose with .modal-overlay class plus modifier classes (e.g., .modal-overlay--high-z for bulk operations). Consider a z-index scale in CSS custom properties.

#### Modal Scroll Lock Restoration Inconsistency

Modals that implement body scroll lock use two different restoration strategies: some preserve and restore the previous overflow value, while others blindly reset to empty string. When modals stack (e.g., CreateEntityModal opened from QuickCheckModal), the incorrect restoration can re-enable body scroll while an outer modal is still open.

**Variants:** 2

**Recommendation:** Primary fix: migrate custom modals to ModalShell. Interim fix: update the 4 affected modals to use save-and-restore pattern instead of reset-to-empty.

#### Modal ARIA Role Inconsistency

Only one modal in the entire codebase (ImageLightbox) uses the semantically correct role='dialog' aria-modal='true'. All other modals, including ModalShell itself, use role='button' on the overlay div, which is semantically incorrect — a modal dialog is not a button.

**Variants:** 3

**Recommendation:** Update ModalShell to use role='dialog' aria-modal='true' aria-labelledby={titleId} on the overlay div. Remove role='button' from the inner modal div. Use ImageLightbox as reference for correct ARIA pattern. This single change fixes 12+ modals.

### Notification & Feedback Patterns

#### Success/Failure Feedback Mechanisms

After async operations complete (save, sync, rename, bulk ops), different apps and components provide feedback through vastly different mechanisms: fixed-position toast (ChroniclePanel), inline error div with dismiss button (NameForge EntityWorkspace), inline error text (CorpusFindReplace), styled error box (SimulationRunner), snapshotStatus state object (Canonry AWS), or console.error only. No shared toast/notification system exists.

**Variants:** 7

**Recommendation:** Create a shared toast notification store + renderer in packages/shared-components. API: useToastStore.getState().show({ message: string, variant: 'success' | 'error' | 'info', autoDismissMs?: number }). Renderer: <ToastContainer /> mounted once in each app shell. Migrate ChroniclePanel's 5 toasts first (highest duplication). Leave inline error displays as-is for form validation (inline errors near the relevant field are appropriate UX for validation), but async operation results should use the shared toast.

#### Progress Feedback During Async Operations

Long-running async operations display progress through three distinct mechanisms: BulkOperationShell (shared modal with progress bar, status text, minimize-to-pill), SimulationDashboard (real-time streaming dashboard with logs, charts, epoch timeline), and inline status text. BulkOperationShell is well-unified for Illuminator bulk ops. SimulationRunner is appropriately specialized. The drift is between components that do NOT use BulkOperationShell despite running similar async operations.

**Variants:** 4

**Recommendation:** Low priority. Consider migrating InterleavedAnnotationModal to use BulkOperationShell (straightforward — it already has similar structure). EraNarrativeModal could potentially be migrated if BulkOperationShell gained a 'steps' mode, but the cost/benefit is marginal. SimulationRunner should remain specialized.

#### Error Boundary Coverage

A shared ErrorBoundary component exists in packages/shared-components but its adoption and error display style varies. The ErrorBoundary shows a generic recovery UI with retry button. Meanwhile, some apps have custom error states (Chronicler WikiExplorer, Archivist) with different visual treatments. The boundary between 'use ErrorBoundary' and 'handle error inline' is inconsistent.

**Variants:** 3

**Recommendation:** No action needed. ErrorBoundary is correctly scoped to render crashes. Data-fetch and initialization error states are a separate concern and each app's custom treatment is appropriate. If visual consistency of error states becomes important, consider a shared ErrorState component for data-fetch errors, but this is low priority.

#### Console-Only Error Logging Without UI Feedback

92 console.warn/console.error calls exist in UI component files (JSX/TSX). Many of these are in catch blocks for operations that silently fail from the user's perspective — the operation fails, a console.error is logged, but no UI feedback is shown. This is especially common in ChroniclePanel (24 instances), Canonry App.jsx (17 instances), and StoragePanel (6 instances).

**Variants:** 2

**Recommendation:** After implementing the shared toast system from finding B1, audit all console.error/console.warn calls in UI components and classify each as: (a) user-initiated operation failure -> add toast, (b) background/passive failure -> leave as console, (c) developer debug info -> leave as console. Focus first on ChroniclePanel (24 instances) and StoragePanel (6 instances) as highest-impact targets.

### Shared Component Adoption

#### ModalShell Adoption Gap

The shared ModalShell component provides overlay click-to-close (mouseDown guard), Escape key handling, body scroll lock, header with close button, and optional tabs. However, only 12 of ~34 modal files across the project use it. The remaining 22 modals reimplement the overlay/backdrop pattern ad-hoc with inconsistent behavior.

**Variants:** 2

**Recommendation:** Migrate all 22 ad-hoc modals to use ModalShell. For bulk-operation modals that shouldn't close on accidental click, use the existing preventOverlayClose prop. Each migration is straightforward: wrap content in <ModalShell onClose={onClose} title={title}> and delete the custom backdrop CSS.

#### Raw <select> Elements vs Shared Dropdown Components

The shared library provides SearchableDropdown (popover with search), ReferenceDropdown (native select or searchable mode), and ChipSelect (multi-select with chips). However, 124 raw <select> elements exist across 50+ files in 8 apps. SearchableDropdown has zero direct imports outside shared-components. ReferenceDropdown is used only in coherence-engine (8 files). The vast majority of dropdowns are plain HTML <select> elements with no search, no consistent styling, and no shared behavior.

**Variants:** 3

**Recommendation:** Do not attempt blanket replacement. Instead: (1) For filter bars with many selects (EntityBrowser, EntityCoveragePanel), consider a dedicated FilterBar shared component that standardizes the filter-select pattern. (2) For entity kind/culture selects that may grow large, adopt ReferenceDropdown in searchable mode. (3) Improve SearchableDropdown to support sentinel values ('All X') and dependent options to make adoption more attractive.

#### ChipSelect vs Ad-Hoc Multi-Select Patterns

The shared ChipSelect component provides multi-select with searchable dropdown and chip display. However, name-forge has an ad-hoc MultiSelectPills component that reimplements multi-select with a different UI pattern (pill buttons instead of chips). The MultiSelectPills file even contains a TODO comment acknowledging it should use ChipSelect.

**Variants:** 2

**Recommendation:** Either (a) replace MultiSelectPills with ChipSelect if the dropdown UX is acceptable for name-forge's use case, or (b) add an 'inline' mode to ChipSelect that renders all options as toggleable pills when count is small. The 'All' wildcard pattern should be supported either way.

#### EmptyState Component Adoption Gap

The shared EmptyState component provides a consistent icon + title + description pattern. However, only 3 files import it (2 in coherence-engine, 1 in illuminator). Meanwhile, 41 files across 8 apps render ad-hoc empty states using the same CSS class names ('empty-state', 'empty-state-icon', 'empty-state-title', 'empty-state-desc') or app-specific variants — matching the shared component's HTML structure exactly but without importing it.

**Variants:** 3

**Recommendation:** Phase 1: Migrate the 12 files that already use matching CSS classes — this is a find-and-replace level change. Phase 2: Migrate the 26 files with custom CSS, starting with coherence-engine (most files) and lore-weave (custom lw-empty-state pattern used consistently).

#### EnableToggle vs Raw Checkbox Adoption

The shared EnableToggle component provides a styled toggle switch with label, keyboard accessibility, and consistent styling. However, 83 raw <input type='checkbox'> elements exist across 7 apps. EnableToggle is only imported in 4 files in coherence-engine. Most checkboxes are wrapped in bare <label> elements with per-app CSS classes.

**Variants:** 2

**Recommendation:** Do not replace filter checkboxes with EnableToggle — these serve different semantic purposes. Instead, consider creating a shared FilterCheckbox component that standardizes the label-wrapper pattern used in filter bars. EnableToggle should continue to be used for enable/disable toggles, and its adoption in other apps (illuminator, name-forge) for generator/system enable controls should be encouraged.

### Multi-Step Workflow Consistency

#### BulkOperationShell Adoption Consistency

Three of the eight bulk operation modals (BulkEraNarrativeModal, InterleavedAnnotationModal, CorpusFindReplace) bypass BulkOperationShell entirely, duplicating its overlay, header, minimize-to-pill, footer, and phase-detection patterns inline. The remaining five (BulkHistorianModal, BulkBackportModal, BulkChronicleAnnotationModal, BulkToneRankingModal, BulkFactCoverageModal) properly compose through the shared shell.

**Variants:** 2

**Recommendation:** Migrate BulkEraNarrativeModal and InterleavedAnnotationModal to compose through BulkOperationShell. The shell already supports custom body content via children, custom widths via confirmWidth/processWidth, and custom pill text via pillStatusText. The only missing capability is the streaming step progress display (unique to era narratives) — this stays as body content inside the shell.

#### State Management Pattern for Bulk Operations

Bulk operations use two incompatible state management patterns: React hooks with useState/useRef (useBulkHistorian, useBulkBackport) vs Zustand stores with module-level flags (bulkEraNarrativeStore, bulkChronicleAnnotationStore, interleavedAnnotationStore). The Zustand pattern survives tab switches; the hook pattern does not.

**Variants:** 2

**Recommendation:** Migrate useBulkHistorian and useBulkBackport to Zustand stores with module-level flags, matching the pattern established by bulkChronicleAnnotationStore. This requires passing the dep callbacks (buildReviewContext, applyPatches, etc.) into the store at prepare time rather than capturing them in React closures.

#### Prepare/Confirm/Cancel/Close Lifecycle Consistency

All bulk operations follow a prepare/confirm/cancel/close lifecycle, but the API naming is inconsistent across stores and hooks, making the pattern harder to recognize and compose.

**Variants:** 2

**Recommendation:** Define a shared BulkOperationLifecycle interface: { progress: TProgress; prepare: (...) => void; confirm: () => void; cancel: () => void; close: () => void }. Rename all methods to match. Add close() to the hook-based implementations.

#### Progress Status Union Type Consistency

All bulk workflows use a status union type, but the simulation worker uses a different, richer set of states. The bulk operations are consistent with each other (idle|confirming|running|complete|cancelled|failed); the simulation worker uses (idle|initializing|validating|running|finalizing|paused|complete|error).

**Variants:** 2

**Recommendation:** No unification needed between simulation and bulk operations — these are different workflow categories. The internal consistency of the five bulk operations is excellent.

#### Error Recovery and Partial Failure Handling

Bulk operations handle per-item failures inconsistently. Some collect failed items and continue processing, some skip without recording failure, and the backport modal tracks failure at the chronicle level but not at the entity level within a chronicle.

**Variants:** 3

**Recommendation:** Add per-era failure collection to bulkEraNarrativeStore's runBulkEraNarratives loop (wrap processEra in try/catch, push to failedEras array, continue). Consider adding a shared 'retry failed' capability as a future enhancement to BulkOperationShell.

#### Streaming/Live Progress Display During Processing

Most bulk operations show only a progress bar and current-item name during processing. BulkEraNarrativeModal uniquely shows live streaming text with word counts and per-step progress (threads/generate/edit). This creates a significantly richer user experience for era narratives compared to all other bulk operations.

**Variants:** 2

**Recommendation:** No immediate action needed. The streaming progress is justified by the operation's duration. If users request more detailed progress for other bulk operations, the infrastructure (useThinkingStore, enrichment task ID tracking) is already in place.

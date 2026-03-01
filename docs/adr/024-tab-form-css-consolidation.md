<!-- drift-generated -->
# ADR-024: Tab Form CSS Consolidation

## Status
Accepted

## Context
The coherence-engine has multiple tab components (VariablesTab in actions, VariablesTab in generators, ThresholdTriggerTab in systems) that each maintained their own companion CSS file with per-component prefixed class names (`avt-required-badge`, `ttt-checkbox-label`, `vt-required-checkbox`, etc.). These files were 95% identical — they all defined the same three concerns: a required badge with left margin, a flexbox checkbox label, and a small-text required hint.

Each time a new tab component was added, the pattern was copy-paste-rename from an existing tab's CSS, changing only the prefix. This created three independent files that would drift independently on any styling change.

## Decision
Consolidate all tab form companion styles into a single shared file at `styles/components/tab-form.css`, imported centrally via `styles/index.css`. Use generic `tab-` prefixed class names (`tab-required-badge`, `tab-checkbox-label`, `tab-required-hint`) instead of per-component prefixes.

Tab components in coherence-engine must not import their own local CSS files for form-level styles. All such styles belong in the centralized `styles/components/` directory.

## Consequences
- **Positive:** Single source of truth for tab form styling. Changes propagate to all tabs automatically.
- **Positive:** New tab components get form styles for free via the central import — no CSS file needed.
- **Negative:** If a tab genuinely needs unique form styling, it must either extend `tab-form.css` or add overrides in `compact-overrides.css` rather than creating a local CSS file.

## Enforcement
- ESLint rule `local/no-tab-companion-css` bans local CSS imports from coherence-engine `tabs/` directories.
- Pattern doc: `docs/patterns/tab-form-styles.md`

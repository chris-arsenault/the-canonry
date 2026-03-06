<!-- drift-generated -->
# ADR-034: Dashboard Section CSS Consolidation

## Status
Accepted — 2026-02-28

## Context
Three lore-weave dashboard panel components — EpochTimeline, FinalDiagnostics, and PopulationMetrics — each independently declared identical CSS classes for section spacing and labeling:

- `.et-section-spacer`, `.fd-section-spacer`, `.pm-section-spacer` — all `margin-top: 16px`
- `.et-section-label`, `.fd-section-label`, `.pm-section-label` — all `font-size: 12px; color: var(--lw-text-muted); margin-bottom: 8px`
- `.et-section-label-hint` — `margin-left: 8px; opacity: 0.6` (only in EpochTimeline, but useful as a shared utility)

These classes serve the same structural purpose: separating and labeling sub-sections within dashboard panels. The duplication meant any design change to section spacing required editing three CSS files.

## Decision
Consolidate the duplicated section utility classes into `App.css` under the shared `lw-` namespace:

- `.lw-section-spacer` — section top margin
- `.lw-section-label` — section heading text style
- `.lw-section-label-hint` — inline hint text within section labels

All dashboard components now reference the shared classes instead of their prefixed copies.

## Consequences
- **Positive:** Single source of truth for section spacing and label styles across all dashboard panels. Design changes propagate automatically.
- **Positive:** Component CSS files are smaller and only contain truly component-specific styles.
- **Negative:** Minor coupling — if a single panel needs different section spacing, it must add an override class rather than simply editing its own section-spacer definition. This is the correct tradeoff since consistency is the goal.

## Enforcement
- ESLint rule `local/no-dashboard-section-drift` detects when dashboard CSS files redefine prefixed section-spacer or section-label patterns instead of using the shared classes.

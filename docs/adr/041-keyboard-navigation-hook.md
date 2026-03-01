<!-- drift-generated -->
# ADR-041: Shared Keyboard Navigation Hook

## Status
Accepted

## Context
Two search components — `HeaderSearch` (viewer) and `WikiSearch` (chronicler) — independently implemented near-identical keyboard navigation logic: ArrowUp/ArrowDown to move selection through search results, Enter to confirm, and Escape to dismiss. The implementations differed only in code structure (extracted hook vs. inline function) and Escape behavior (clear query vs. preserve query).

This duplication meant any bug fix or enhancement to keyboard navigation had to be applied in two places, and the subtle behavioral divergence in Escape handling was accidental rather than intentional.

## Decision
Extract a shared `useKeyboardNavigation` hook into `@the-canonry/shared-components` that accepts an options object:

```js
useKeyboardNavigation({ results, selectedIndex, setSelectedIndex, onSelect, onEscape })
```

- **ArrowDown/ArrowUp**: bounded index movement (shared, identical for all consumers)
- **Enter**: delegates to `onSelect(id)` — caller decides what happens after selection
- **Escape**: delegates to `onEscape()` — caller decides whether to clear query, close dropdown, or both

This makes the behavioral divergence in Escape handling explicit and intentional rather than an accident of code duplication.

## Consequences
- One place to fix keyboard navigation bugs (e.g., screen reader support, focus management)
- New search components get correct navigation by importing the hook
- Each consumer retains full control over Enter and Escape side effects via callbacks

## Enforcement
- ESLint rule `local/no-inline-keyboard-nav` detects inline switch blocks that handle ArrowDown/ArrowUp/Enter/Escape case clauses, flagging duplicated navigation logic that should use the shared hook

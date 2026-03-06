<!-- drift-generated -->
# ADR 022: Canonical Prefixed ID Generation

## Status

Accepted — 2026-02-28

## Context

Seven Illuminator repository modules and one Lore-Weave module each contained their own
hand-rolled function for generating prefixed IDs. Every function was structurally identical:

```ts
return `${PREFIX}_${Date.now()}_${crypto.randomUUID().slice(0, N)}`;
```

Prefixes varied by domain (`cost_`, `dynrun_`, `eranarr_`, `enver_`, `histrun_`, `static_`,
`revrun_`, `event_`) and slice lengths varied between 6, 8, and 9 — but the pattern was the
same. The Lore-Weave variant additionally had a Node.js fallback branch and counter-based
suffix that diverged from the canonical shape.

This duplication meant that any change to the ID format (e.g. switching to a different
randomness source, changing the timestamp format) would require finding and updating every
copy independently.

## Decision

Consolidate all `prefix_timestamp_uuid-slice` ID generators behind a single shared utility:

```ts
function generatePrefixedId(prefix: string, sliceLength?: number): string
```

- **Canonical implementation:** `apps/illuminator/webui/src/lib/db/generatePrefixedId.ts`
- **Local copy in Lore-Weave:** `apps/lore-weave/lib/core/idGeneration.ts` (private
  `generatePrefixedId` function, since lore-weave cannot import from illuminator)
- Default `sliceLength` is 8; callers that need a different length pass it explicitly.
- Each repository keeps its domain-specific wrapper (e.g. `generateCostId()`) that calls
  `generatePrefixedId` with the appropriate prefix and slice length. This preserves
  call-site readability and type-level documentation of what kind of ID is being generated.

### What is NOT covered

- `generateId(prefix)` in `apps/lore-weave/lib/core/idGeneration.ts` — a sequential
  counter-based ID (`prefix_N`) used for graph node IDs during simulation. Fundamentally
  different pattern, not timestamp+random.
- `generatePageId()` in `apps/canonry/webui/src/storage/staticPageStorage.js` — inline
  implementation in a separate app with no import path to illuminator. Acceptable as a
  known exception until a shared utility package exists.

## Consequences

- **One place to change the ID format** if it ever needs to evolve.
- **Consistent slice lengths** are visible at a glance in each wrapper function.
- **Future consolidation:** if a `packages/shared-utils` package is created, the utility
  can move there so all apps import from a single source.

## Enforcement

- ESLint rule `local/no-inline-id-generation` bans template literals that combine
  `Date.now()` and `crypto.randomUUID()` outside of a function named `generatePrefixedId`.
  This prevents new hand-rolled copies from appearing.
- Pattern documentation: `docs/patterns/prefixed-id-generation.md`

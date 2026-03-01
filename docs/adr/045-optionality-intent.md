<!-- drift-generated -->
# ADR-045: Explicit Optionality Intent via Named Aliases

## Status

Accepted

## Context

TypeScript's `| undefined` and `?:` are freely interchangeable in most configurations.
LLMs frequently add `?` or `| undefined` defensively when hitting type errors, without
considering whether the value can actually be absent. Over time this produces thousands
of unnecessarily optional properties that widen types, suppress compiler enforcement,
and hide real bugs.

The codebase had ~4,000+ optional properties and ~1,300+ `| undefined` unions, many
of which were introduced during TypeScript migration without genuine design intent.

## Decision

1. All packages with `strict: true` now also set `exactOptionalPropertyTypes: true`,
   giving semantic distinction between "property absent" and "property present-with-undefined".

2. Property signatures in interfaces/types must use named aliases from
   `@the-canonry/shared-components` instead of raw `| undefined`:
   - `Optional<T>` — intentional design choice, absence is meaningful
   - `Nullable<T>` — persistence layer field that stores explicit nulls (IndexedDB)
   - `Legacy<T>` — old data format or LLM-added defensive optionality needing audit

3. The `local/no-raw-undefined-union` ESLint rule enforces (2) on new code in both
   library and frontend sections.

4. The `@typescript-eslint/no-unnecessary-condition` rule is enabled for strict-mode
   library code to catch dead null guards that contradict type signatures.

5. Boundary types in `packages/world-store` are kept accurate to actual storage
   semantics: fields are either required (`string`), required-nullable (`string | null`
   for fields that store explicit null in IndexedDB), or absent-until-set (`?: string`).
   The `?: T | null` double-optionality pattern (three states: absent, null, value) is
   banned — it never represents a real use case.

## Consequences

### Positive

- New optionality must be declared with explicit intent, making it reviewable.
- `Legacy<T>` acts as a technical debt marker — grep for it to find auditable slop.
- The ts-morph audit script (`pnpm audit:optionality`) ranks the worst existing violations
  for incremental cleanup.
- `exactOptionalPropertyTypes` in packages will surface assignment sites that pass
  `undefined` explicitly to optional fields — these must be fixed or removed.

### Negative

- Enabling `exactOptionalPropertyTypes` surfaces existing assignment errors that must
  be corrected before the flag can be fully enabled across all packages.
- The named-alias pattern requires an import from `@the-canonry/shared-components`
  wherever optionality is declared.

### Neutral

- Null is not used as a sentinel for "not yet set" — absent fields are omitted rather
  than stored as null.
- `Optional<T>` and `Legacy<T>` expand to the same underlying type; the distinction
  is intentionally semantic rather than structural.

## Enforcement

- ESLint rule `local/no-raw-undefined-union` warns on raw `| undefined` in property
  signatures, active in both library and frontend sections.
- `@typescript-eslint/no-unnecessary-condition` catches null guards that are dead given
  the declared type, enforced in strict-mode library code.
- Pattern documentation at `docs/patterns/optionality-aliases.md`.

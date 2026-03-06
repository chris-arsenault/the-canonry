<!-- drift-generated -->
# Optionality Aliases Pattern

**Status:** Canonical (ADR 045)

## Problem

Raw `| undefined` in property signatures doesn't communicate why a value can be
absent. LLMs add it defensively; reviewers can't distinguish intentional optionality
from slop.

Null and undefined are not interchangeable sentinels. Using `?: T | null` creates
three possible states (absent, null, value) when typically only two are needed.

## Rules

**Never use `?: T | null`.** Pick one:
- `?: T` — field is absent until set (use when nothing has been stored yet)
- `T | null` — field is always present, null means explicitly cleared (use for IndexedDB columns where null is the initial value)

**Never use raw `| undefined` in property signatures.** Use named aliases instead:

```typescript
import type { Optional, Nullable, Legacy } from '@the-canonry/shared-components';

interface MyRecord {
  id: string;
  label: Optional<string>;     // intentional — user may not set one
  deletedAt: Nullable<number>; // IndexedDB column, null = not deleted
  oldField: Legacy<string>;    // pre-migration field, audit before tightening
}
```

## Alias Reference

| Alias | Expands to | When to use |
|-------|-----------|-------------|
| `Optional<T>` | `T \| undefined` | Intentional design — absence has semantic meaning |
| `Nullable<T>` | `T \| null` | Persistence field where null = "explicitly cleared" |
| `Legacy<T>` | `T \| undefined` | Old schema, LLM-added slop, needs audit |

> **Note:** `Optional<T>` and `Legacy<T>` expand to the same type. The distinction
> is semantic — use `Legacy<T>` as a visible technical-debt marker that can be grepped.

## Lint Enforcement

`local/no-raw-undefined-union` — warns on raw `| undefined` in property signatures.
Active in both library and frontend ESLint sections.

## Finding Technical Debt

```bash
# Find all Legacy<T> markers (optionality needing audit)
grep -rn "Legacy<" apps/ packages/ --include="*.ts" --include="*.tsx"

# Run construction-site audit (finds always-assigned optional properties)
pnpm audit:optionality
```

## What NOT to Do

```typescript
// ❌ Three states — pick two
interface Bad {
  runId?: string | null;
}

// ❌ Raw | undefined — no stated reason
interface AlsoBad {
  label: string | undefined;
}

// ✅ Clear intent
interface Good {
  runId: string;            // always present once the record exists
  label?: string;           // absent until user sets one
  deletedAt: number | null; // always present, null = not deleted
}
```

## Related

- [ADR-045: Explicit Optionality Intent](../adr/045-optionality-intent.md)
- ESLint rule `local/no-raw-undefined-union` — warns on raw `| undefined` in property signatures
- ESLint `@typescript-eslint/no-unnecessary-condition` — catches dead null guards in strict-mode library code

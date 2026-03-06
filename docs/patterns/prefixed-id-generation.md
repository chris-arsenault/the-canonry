<!-- drift-generated -->
# Prefixed ID Generation

Generate unique database record IDs in the format `prefix_timestamp_randomSlice`.

## Canonical Utility

```ts
// apps/illuminator/webui/src/lib/db/generatePrefixedId.ts
export function generatePrefixedId(prefix: string, sliceLength = 8): string {
  return `${prefix}_${Date.now()}_${crypto.randomUUID().slice(0, sliceLength)}`;
}
```

## Usage

Import `generatePrefixedId` and create a domain-specific wrapper in your repository module:

```ts
import { generatePrefixedId } from "./generatePrefixedId";

export function generateCostId(): string {
  return generatePrefixedId("cost", 9);
}

export function generateRunId(): string {
  return generatePrefixedId("dynrun");
}
```

The wrapper functions:
- Document what kind of ID is being generated (readable at call sites)
- Lock in the prefix and slice length for that domain
- Can be imported directly by consumers without knowing about `generatePrefixedId`

## Parameters

| Parameter     | Type     | Default | Description                          |
|---------------|----------|---------|--------------------------------------|
| `prefix`      | `string` | —       | Domain prefix (e.g. `"cost"`, `"dynrun"`) |
| `sliceLength` | `number` | `8`     | Characters to take from UUID random component |

## Output Format

```
cost_1709136000000_a1b2c3d4e
│     │              └─ crypto.randomUUID().slice(0, sliceLength)
│     └─ Date.now() timestamp
└─ domain prefix
```

## Do NOT

Do not hand-roll the template literal inline:

```ts
// BAD — triggers local/no-inline-id-generation lint rule
function generateMyId(): string {
  return `myprefix_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
}
```

Instead, call `generatePrefixedId`:

```ts
// GOOD
function generateMyId(): string {
  return generatePrefixedId("myprefix");
}
```

## Cross-App Usage

The canonical file lives in `apps/illuminator/webui/src/lib/db/generatePrefixedId.ts`.
Apps that cannot import from illuminator (e.g. lore-weave) may maintain a local copy of
the `generatePrefixedId` function — the ESLint rule exempts functions with that exact name.

If a `packages/shared-utils` package is created in the future, the utility should move
there so all apps can import from a single source.

## Existing Prefixes

| Prefix     | Module                    | Slice Length |
|------------|---------------------------|-------------|
| `cost`     | `costRepository.ts`       | 9           |
| `dynrun`   | `dynamicsRepository.ts`   | 8           |
| `eranarr`  | `eraNarrativeRepository.ts` | 8         |
| `enver`    | `eraNarrativeRepository.ts` | 6         |
| `histrun`  | `historianRepository.ts`  | 8           |
| `static`   | `staticPageRepository.ts` | 8           |
| `revrun`   | `summaryRevisionRepository.ts` | 8      |
| `event`    | `idGeneration.ts` (lore-weave) | 8       |

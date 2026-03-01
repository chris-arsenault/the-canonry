# Undefined Sprawl Containment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Contain TypeScript `| undefined` / `?:` sprawl via tagged aliases, lint enforcement, strict tsconfig flags on packages, and an audit script that ranks the worst offenders.

**Architecture:** Five independent layers applied bottom-up: (1) convention aliases and lint rule prevent new slop; (2) `exactOptionalPropertyTypes` on strict packages forces semantic clarity; (3) boundary types in `world-store` fixed to resolve the `?: T | null` ambiguity; (4) `no-unnecessary-condition` lint rule catches existing dead null guards in strict packages; (5) ts-morph script ranks always-assigned optional properties for future cleanup.

**Tech Stack:** TypeScript, ESLint flat config, `@typescript-eslint/eslint-plugin`, ts-morph (new dev dependency), existing `eslint-rules/` pattern.

---

## Task 1: Tagged optionality type aliases

**Files:**
- Create: `packages/shared-components/src/types/optionality.ts`
- Modify: `packages/shared-components/src/index.ts`

**Step 1: Create the aliases file**

```typescript
// packages/shared-components/src/types/optionality.ts

/**
 * Intentional design choice — this property is genuinely optional by design.
 * Use when absence has distinct meaning from presence-with-undefined.
 */
export type Optional<T> = T | undefined;

/**
 * Value from a persistence layer that stores explicit nulls.
 * Use for IndexedDB / database fields where null = "cleared" vs absent = "not yet set".
 */
export type Nullable<T> = T | null;

/**
 * Data from an older schema version or untrusted external source.
 * Signals: do not rely on this being present; audit before tightening.
 */
export type Legacy<T> = T | undefined;
```

**Step 2: Re-export from shared-components index**

In `packages/shared-components/src/index.ts`, add:
```typescript
export type { Optional, Nullable, Legacy } from './types/optionality.js';
```

**Step 3: Commit**

```bash
git add packages/shared-components/src/types/optionality.ts packages/shared-components/src/index.ts
git commit -m "feat: add Optional/Nullable/Legacy type aliases for explicit optionality intent"
```

---

## Task 2: ESLint rule — ban raw `| undefined` in interface/type definitions

**Files:**
- Create: `eslint-rules/no-raw-undefined-union.js`
- Modify: `eslint.config.js`

The rule targets TypeScript `interface` and `type` property signatures that use `| undefined` directly. It allows `| undefined` in return types, function parameter types, and variable declarations — only bans it in property signatures where `Optional<T>` should be used instead.

**Step 1: Write the rule**

```javascript
// eslint-rules/no-raw-undefined-union.js

/**
 * ESLint rule: no-raw-undefined-union
 *
 * In interface and type alias property signatures, raw `| undefined` must be
 * replaced with Optional<T>, Legacy<T>, or another named alias from
 * packages/shared-components/src/types/optionality.ts.
 *
 * Rationale: forces explicit declaration of WHY a property can be undefined,
 * making LLM-added defensive optionality visible and reviewable.
 *
 * Exempt: return types, function parameters, variable declarations, type casts.
 */
export default {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Require named optionality aliases (Optional<T>, Legacy<T>) instead of raw | undefined in property signatures',
      url: 'docs/patterns/optionality-aliases.md',
    },
    messages: {
      noRawUndefined:
        "Raw '| undefined' in property signature. Use Optional<T>, Legacy<T>, or another named alias. See docs/patterns/optionality-aliases.md",
    },
    schema: [],
  },

  create(context) {
    function isInsidePropertySignature(node) {
      let current = node.parent;
      while (current) {
        if (
          current.type === 'TSPropertySignature' ||
          current.type === 'TSIndexSignature'
        ) {
          return true;
        }
        // Stop climbing at function or type boundaries that aren't property sigs
        if (
          current.type === 'TSFunctionType' ||
          current.type === 'TSMethodSignature' ||
          current.type === 'FunctionDeclaration' ||
          current.type === 'ArrowFunctionExpression' ||
          current.type === 'TSTypeAliasDeclaration' && current.parent?.type !== 'TSPropertySignature'
        ) {
          return false;
        }
        current = current.parent;
      }
      return false;
    }

    return {
      TSUnionType(node) {
        const hasUndefined = node.types.some(
          (t) => t.type === 'TSUndefinedKeyword'
        );
        if (!hasUndefined) return;
        if (!isInsidePropertySignature(node)) return;

        context.report({ node, messageId: 'noRawUndefined' });
      },
    };
  },
};
```

**Step 2: Register in eslint.config.js**

At the top of `eslint.config.js`, add the import alongside other rule imports:
```javascript
import noRawUndefinedUnion from "./eslint-rules/no-raw-undefined-union.js";
```

In the `localPlugin.rules` object, add:
```javascript
"no-raw-undefined-union": noRawUndefinedUnion,
```

In the **Library code** section (`apps/lore-weave/lib/**`, `packages/*/src/**`), add to rules:
```javascript
"local/no-raw-undefined-union": "warn",
```

In the **Frontend** section (`apps/**/webui/src/**`, `packages/shared-components/src/**`), add to rules:
```javascript
"local/no-raw-undefined-union": "warn",
```

**Step 3: Commit**

```bash
git add eslint-rules/no-raw-undefined-union.js eslint.config.js
git commit -m "feat(lint): add no-raw-undefined-union rule, require named optionality aliases in property signatures"
```

---

## Task 3: `exactOptionalPropertyTypes` in all strict packages

**Files to modify** (add `"exactOptionalPropertyTypes": true` to `compilerOptions`):
- `packages/world-store/tsconfig.json`
- `packages/shared-components/tsconfig.json`
- `packages/image-store/tsconfig.json`
- `packages/narrative-store/tsconfig.json`
- `packages/world-schema/tsconfig.json`

**What this flag does:** Without it, `x?: string` and `x?: string | undefined` are interchangeable and you can assign `undefined` to optional properties. With it, those two forms are semantically distinct: `x?: string` means the key may be absent; `x: string | undefined` means the key must be present but may hold undefined.

**Step 1: Add the flag to all five tsconfig files**

For each file listed above, add `"exactOptionalPropertyTypes": true` inside `compilerOptions`. Example for `world-store/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "skipLibCheck": true,
    "noEmit": true,
    "strict": true,
    "exactOptionalPropertyTypes": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src"]
}
```

**Step 2: Check what breaks (expected: world-store `?: T | null` pattern)**

The TypeScript language server will flag assignments like:
```typescript
const record: SimulationSlotRecord = { simulationRunId: undefined }
// Error: Type 'undefined' is not assignable to type 'string | null'
// because simulationRunId?: string | null now means "absent OR (string | null)"
// and passing undefined explicitly hits exactOptionalPropertyTypes
```

These are flagged by the IDE — since we don't run builds, just note them for Task 4.

**Step 3: Commit the tsconfig changes**

```bash
git add packages/*/tsconfig.json
git commit -m "feat(ts): enable exactOptionalPropertyTypes in all strict packages"
```

---

## Task 4: Fix `world-store` boundary types — resolve `?: T | null` ambiguity

**Files:**
- Modify: `packages/world-store/src/index.ts`

The problem: `SimulationSlotRecord`, `ChronicleRecord`, and `StaticPageRecord` use `?: T | null` on many fields. With `exactOptionalPropertyTypes` now enabled this is semantically weird — it means "absent OR (T or null)" which is three states. The real intent differs by field:

- **Slot fields** (`simulationRunId`, `finalTick`, `finalEraId`, `label`, `isTemporary`): These are fields in an IndexedDB store. A fresh slot has no run yet — the field is genuinely absent. Once a run is assigned it will be a value. Use `?: T` (absent until set). Null is not needed.
- **Chronicle/StaticPage timestamp fields** (`acceptedAt`, `updatedAt`): IndexedDB returns `null` for unset numeric fields in some query patterns. Use `T | null` (required, but can be null). Not optional — every record should have this column.
- **Chronicle metadata** (`projectId`, `simulationRunId`, `title`, `summary`, `status`, `slug`): These are genuinely optional metadata fields. Use `?: string`.

**Step 1: Audit each field's intent**

Read `packages/world-store/src/index.ts` lines 21–65 and identify: for each `?: T | null` field, does the code ever explicitly assign `null` vs just omit it?

Check callers: `grep -rn "simulationRunId: null\|finalTick: null\|acceptedAt: null" apps/ --include="*.ts" --include="*.tsx"`

**Step 2: Rewrite the interfaces**

Based on the above, the expected result:

```typescript
export interface SimulationSlotRecord {
  projectId: string;
  slotIndex: number;
  simulationRunId?: string;     // absent until slot has a run
  finalTick?: number;           // absent until simulation completes
  finalEraId?: string;          // absent until simulation completes
  label?: string;               // absent until user sets one
  isTemporary?: boolean;        // absent = false (undefined = not temporary)
  updatedAt: number;
}

export interface ChronicleRecord {
  chronicleId: string;
  projectId?: string;
  simulationRunId?: string;
  title?: string;
  summary?: string;
  status?: string;
  acceptedAt: number | null;    // required column, null = not yet accepted
  updatedAt: number | null;     // required column, null = never updated
}

export interface StaticPageRecord {
  pageId: string;
  projectId?: string;
  title?: string;
  summary?: string;
  status?: string;
  slug?: string;
  updatedAt: number | null;     // required column, null = never updated
}
```

> **Note:** If the grep in Step 1 reveals explicit `null` assignments for slot fields, keep `?: T | null` for those. The goal is eliminating *unnecessary* dual optionality, not changing runtime behavior.

**Step 3: Fix any callers that break**

```bash
grep -rn "SimulationSlotRecord\|ChronicleRecord\|StaticPageRecord" apps/ packages/ --include="*.ts" --include="*.tsx" -l
```

For each file, update assignments to match the narrowed types.

**Step 4: Commit**

```bash
git add packages/world-store/src/index.ts
git commit -m "fix(world-store): resolve ?: T | null ambiguity — separate absent vs nullable per field"
```

---

## Task 5: Enable `no-unnecessary-condition` on strict-mode TypeScript files

**Files:**
- Modify: `eslint.config.js`

This `@typescript-eslint` rule flags:
- `if (x !== undefined)` when `x` can't be undefined (dead null guards)
- `x?.y` when `x` can't be null/undefined (unnecessary optional chains)
- Conditions that are always true or always false due to over-wide types

It only produces useful output where `strictNullChecks` is active (i.e., the strict packages and lib code — **not** webui apps which have `strict: false`).

**Step 1: Add the rule to the library code section in `eslint.config.js`**

In the block with `files: ["apps/lore-weave/lib/**/*.ts", "apps/name-forge/lib/**/*.ts", ..., "packages/*/src/**/*.ts"]`, add to rules:

```javascript
"@typescript-eslint/no-unnecessary-condition": ["warn", {
  allowConstantLoopConditions: true,
}],
```

The `allowConstantLoopConditions` option permits `while (true)` patterns which are common and intentional.

**Step 2: Verify the rule activates correctly**

Since `@typescript-eslint/no-unnecessary-condition` requires type information, confirm the ESLint config already has `parserOptions.projectService: true` — it does (in the existing TypeScript parser options block). No change needed there.

**Step 3: Do NOT add this to the Frontend section**

The frontend block covers webui apps with `strict: false` where `strictNullChecks` is off. The rule produces false positives without type information. Leave the frontend section unchanged.

**Step 4: Commit**

```bash
git add eslint.config.js
git commit -m "feat(lint): enable no-unnecessary-condition for strict-mode library code"
```

---

## Task 6: ts-morph construction-site audit script

**Files:**
- Create: `scripts/audit-optional-properties.ts`
- Modify: `package.json` (add ts-morph dev dependency and script entry)

This script walks all TypeScript source files in strict packages and `lore-weave/lib`, finds `interface` and `type` properties marked `?:`, then inspects every object literal that satisfies the containing type. If a property is assigned in ≥95% of construction sites, it flags it as "probably unnecessary optionality."

**Step 1: Add ts-morph**

```bash
pnpm add -D ts-morph --workspace-root
```

**Step 2: Add script entry to root `package.json`**

In the `"scripts"` section:
```json
"audit:optionality": "npx tsx scripts/audit-optional-properties.ts"
```

**Step 3: Write the script**

```typescript
// scripts/audit-optional-properties.ts
/**
 * Audit optional properties across strict-mode TypeScript packages.
 *
 * For each interface/type with optional properties (?:), finds all object
 * literal construction sites and checks whether the property is always assigned.
 * Properties assigned at 95%+ of sites are flagged as candidates for removal.
 *
 * Output: ranked list from most-always-assigned to least.
 *
 * Usage: pnpm audit:optionality
 */

import { Project, SyntaxKind, Node, InterfaceDeclaration, TypeAliasDeclaration } from 'ts-morph';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Strict-mode source directories to scan
const SCAN_GLOBS = [
  'packages/*/src/**/*.ts',
  'packages/*/src/**/*.tsx',
  'apps/lore-weave/lib/**/*.ts',
  'apps/name-forge/lib/**/*.ts',
];

const THRESHOLD = 0.95; // flag if assigned in ≥95% of sites

interface Finding {
  interfaceName: string;
  propertyName: string;
  file: string;
  assignedCount: number;
  totalCount: number;
  rate: number;
}

function collectOptionalProperties(
  decl: InterfaceDeclaration | TypeAliasDeclaration
): string[] {
  const props: string[] = [];

  if (Node.isInterfaceDeclaration(decl)) {
    for (const member of decl.getMembers()) {
      if (Node.isPropertySignature(member) && member.hasQuestionToken()) {
        props.push(member.getName());
      }
    }
  }
  // TypeAliasDeclaration with TypeLiteral
  if (Node.isTypeAliasDeclaration(decl)) {
    const typeNode = decl.getTypeNode();
    if (typeNode && Node.isTypeLiteral(typeNode)) {
      for (const member of typeNode.getMembers()) {
        if (Node.isPropertySignature(member) && member.hasQuestionToken()) {
          props.push(member.getName());
        }
      }
    }
  }

  return props;
}

async function main() {
  const project = new Project({
    tsConfigFilePath: path.join(ROOT, 'packages/world-store/tsconfig.json'),
    skipAddingFilesFromTsConfig: true,
  });

  // Add all scan targets
  for (const glob of SCAN_GLOBS) {
    project.addSourceFilesAtPaths(path.join(ROOT, glob));
  }

  const findings: Finding[] = [];
  const sourceFiles = project.getSourceFiles();

  console.log(`Scanning ${sourceFiles.length} source files...`);

  for (const sourceFile of sourceFiles) {
    const filePath = sourceFile.getFilePath();
    const relPath = path.relative(ROOT, filePath);

    // Collect all interface and type alias declarations
    const decls: (InterfaceDeclaration | TypeAliasDeclaration)[] = [
      ...sourceFile.getInterfaces(),
      ...sourceFile.getTypeAliases(),
    ];

    for (const decl of decls) {
      const optionalProps = collectOptionalProperties(decl);
      if (optionalProps.length === 0) continue;

      const declName = decl.getName();

      // Find all references to this type/interface
      const refs = decl.findReferences();
      const objectLiterals = refs
        .flatMap((r) => r.getReferences())
        .map((ref) => ref.getNode())
        .filter(Boolean)
        .map((node) => {
          // Walk up to find object literal ancestors where this type is used
          let current = node.getParent();
          while (current && !Node.isObjectLiteralExpression(current)) {
            current = current?.getParent();
          }
          return current;
        })
        .filter((n): n is NonNullable<typeof n> => n != null && Node.isObjectLiteralExpression(n));

      if (objectLiterals.length === 0) continue;

      for (const propName of optionalProps) {
        let assigned = 0;
        for (const literal of objectLiterals) {
          const hasIt = literal.getProperties().some(
            (p) => Node.isPropertyAssignment(p) && p.getName() === propName
          );
          if (hasIt) assigned++;
        }

        const total = objectLiterals.length;
        const rate = total > 0 ? assigned / total : 0;

        if (rate >= THRESHOLD && total >= 3) {
          findings.push({
            interfaceName: declName ?? '(anonymous)',
            propertyName: propName,
            file: relPath,
            assignedCount: assigned,
            totalCount: total,
            rate,
          });
        }
      }
    }
  }

  // Sort by rate descending, then by totalCount descending
  findings.sort((a, b) => b.rate - a.rate || b.totalCount - a.totalCount);

  if (findings.length === 0) {
    console.log('\n✓ No high-confidence unnecessary optional properties found.');
    return;
  }

  console.log(`\n⚠  Found ${findings.length} properties that are optional but always assigned:\n`);
  console.log(
    'Rate'.padEnd(8) +
    'Sites'.padEnd(8) +
    'Interface'.padEnd(40) +
    'Property'.padEnd(30) +
    'File'
  );
  console.log('-'.repeat(120));

  for (const f of findings) {
    const rate = `${(f.rate * 100).toFixed(0)}%`.padEnd(8);
    const sites = `${f.assignedCount}/${f.totalCount}`.padEnd(8);
    const iface = f.interfaceName.padEnd(40);
    const prop = f.propertyName.padEnd(30);
    console.log(`${rate}${sites}${iface}${prop}${f.file}`);
  }

  console.log(`\nThese properties appear optional (?: ) but are assigned at ≥${THRESHOLD * 100}% of construction sites.`);
  console.log('Consider removing ? from the property signature and making it required.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

**Step 4: Install tsx for running the script if not present**

```bash
pnpm add -D tsx --workspace-root
```

**Step 5: Run the script to verify it executes**

```bash
pnpm audit:optionality
```

Expected: a table of findings, or "No high-confidence unnecessary optional properties found." The script should not crash.

**Step 6: Commit**

```bash
git add scripts/audit-optional-properties.ts package.json pnpm-lock.yaml
git commit -m "feat: add ts-morph construction-site audit script for unnecessary optional properties"
```

---

## Task 7: Add ADR and pattern doc

**Files:**
- Create: `docs/adr/045-optionality-intent.md`
- Create: `docs/patterns/optionality-aliases.md`

**Step 1: Write the ADR**

```markdown
# ADR 045: Explicit Optionality Intent via Named Aliases

**Status:** Accepted
**Date:** 2026-03-01

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
   - `Optional<T>` — intentional design choice
   - `Nullable<T>` — persistence layer field that stores explicit nulls
   - `Legacy<T>` — old data format or LLM-added defensive optionality needing audit

3. The `local/no-raw-undefined-union` ESLint rule enforces (2) on new code.

4. The `@typescript-eslint/no-unnecessary-condition` rule is enabled for strict-mode
   library code to catch dead null guards that contradict type signatures.

## Consequences

- New optionality must be declared with explicit intent, making it reviewable.
- `Legacy<T>` acts as a technical debt marker — grep for it to find auditable slop.
- The ts-morph audit script (`pnpm audit:optionality`) ranks the worst existing violations
  for incremental cleanup.
- `exactOptionalPropertyTypes` in packages will surface assignment sites that pass
  `undefined` explicitly to optional fields — these should be fixed or removed.
```

**Step 2: Write the pattern doc**

```markdown
# Optionality Aliases Pattern

**Status:** Canonical (ADR 045)

## Problem

Raw `| undefined` in property signatures doesn't communicate why a value can be
absent. LLMs add it defensively; reviewers can't distinguish intentional optionality
from slop.

## Solution

Use named aliases from `@the-canonry/shared-components`:

```typescript
import type { Optional, Nullable, Legacy } from '@the-canonry/shared-components';

interface MyRecord {
  id: string;
  label: Optional<string>;    // intentional — user may not set one
  deletedAt: Nullable<number>; // IndexedDB field, null = not deleted
  oldField: Legacy<string>;    // pre-migration field, audit before tightening
}
```

## Aliases

| Alias | Meaning | When to use |
|-------|---------|-------------|
| `Optional<T>` | Intentional design — absence is meaningful | Config fields, user-settable metadata |
| `Nullable<T>` | Persistence layer explicit null | IndexedDB timestamps, cleared foreign keys |
| `Legacy<T>` | Old schema or LLM-added defensive optionality | Any `| undefined` you're not sure about |

## Lint Rule

`local/no-raw-undefined-union` — warns on raw `| undefined` in property signatures.
Fix by adding one of the aliases above.

## Finding Technical Debt

```bash
# Find all Legacy<T> markers (optionality needing audit)
grep -rn "Legacy<" apps/ packages/ --include="*.ts" --include="*.tsx"

# Run construction-site audit (finds always-assigned optional properties)
pnpm audit:optionality
```
```

**Step 3: Commit**

```bash
git add docs/adr/045-optionality-intent.md docs/patterns/optionality-aliases.md
git commit -m "docs: add ADR 045 and pattern doc for explicit optionality intent"
```

---

## Task 8: Final push

```bash
git push
```

Verify: the branch is clean, the audit script runs, and the lint rule appears in ESLint output for a TypeScript package file.

---

## Execution Order

Tasks 1, 2, 5 are fully independent — can be done in any order or in parallel.
Task 3 must precede Task 4 (flag must be on before fixing types).
Task 6 can be done any time after ts-morph is available.
Task 7 can be done last.

```
Task 1 (aliases)    ──┐
Task 2 (lint rule)  ──┤
Task 3 (tsconfig)   ──┤─→ Task 4 (fix world-store)
Task 5 (no-unnec.)  ──┤
Task 6 (ts-morph)   ──┤
Task 7 (docs)       ──┘
                          Task 8 (push)
```

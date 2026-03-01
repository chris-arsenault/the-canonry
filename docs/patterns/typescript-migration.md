<!-- drift-generated -->
# TypeScript Migration Pattern

All source files in this monorepo should be TypeScript. This guide shows the canonical patterns established by the fully-TypeScript apps (archivist, chronicler).

## New Files

Always create new files as `.ts` (no JSX) or `.tsx` (contains JSX). Never create new `.js`/`.jsx` files.

## Component Props: Use TypeScript Interfaces (Not PropTypes)

**Before (old pattern — banned):**
```jsx
import PropTypes from 'prop-types';

export function MyComponent({ title, children, onClose }) {
  return <div>{children}</div>;
}

MyComponent.propTypes = {
  title: PropTypes.string.isRequired,
  children: PropTypes.node,
  onClose: PropTypes.func.isRequired,
};
```

**After (canonical pattern):**
```tsx
import React from 'react';

interface MyComponentProps {
  title: string;
  children?: React.ReactNode;
  onClose: () => void;
}

export function MyComponent({ title, children, onClose }: MyComponentProps) {
  return <div>{children}</div>;
}
```

### PropTypes to TypeScript Conversion Reference

| PropTypes | TypeScript |
|-----------|-----------|
| `PropTypes.string` | `string` |
| `PropTypes.number` | `number` |
| `PropTypes.bool` | `boolean` |
| `PropTypes.func` | `() => void` (or specific signature) |
| `PropTypes.node` | `React.ReactNode` |
| `PropTypes.element` | `React.ReactElement` |
| `PropTypes.object` | `Record<string, unknown>` (or specific interface) |
| `PropTypes.array` | `unknown[]` (or specific typed array) |
| `PropTypes.arrayOf(PropTypes.string)` | `string[]` |
| `PropTypes.shape({...})` | Inline interface or named interface |
| `PropTypes.oneOf(['a', 'b'])` | `'a' \| 'b'` |
| `PropTypes.any` | `unknown` |
| `.isRequired` | Non-optional (no `?`) |
| Without `.isRequired` | Optional (`?`) |

## Hook Type Annotations

```ts
import { useState, useCallback, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';

interface UseMyHookParams {
  initialValue: string;
  onChange: (value: string) => void;
}

interface UseMyHookReturn {
  value: string;
  setValue: Dispatch<SetStateAction<string>>;
  reset: () => void;
}

export function useMyHook({ initialValue, onChange }: UseMyHookParams): UseMyHookReturn {
  const [value, setValue] = useState<string>(initialValue);
  const prevRef = useRef<string>(initialValue);

  const reset = useCallback(() => {
    setValue(initialValue);
    onChange(initialValue);
  }, [initialValue, onChange]);

  return { value, setValue, reset };
}
```

## Type-Only Imports

Use `import type` for imports that are only used as types:

```ts
import type { WorldState, LoreData } from '../types/world.ts';
import { getEntityById } from '../utils/dataTransform.ts';
```

## tsconfig.json Structure

Every webui directory should have the three-file canonical structure:

**`tsconfig.json`** — Root composite config:
```json
{
  "compilerOptions": { "rootDir": "." },
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

**`tsconfig.app.json`** — Application code:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "jsx": "react-jsx",
    "strict": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "noEmit": true
  },
  "include": ["src"]
}
```

**`tsconfig.node.json`** — Build tooling (vite config):
```json
{
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023"],
    "module": "ESNext",
    "strict": true,
    "moduleResolution": "bundler",
    "noEmit": true
  },
  "include": ["vite.config.ts"]
}
```

### For Apps Still Migrating

Apps with existing JavaScript files use a relaxed config:
```json
{
  "compilerOptions": {
    "allowJs": true,
    "checkJs": false,
    "strict": false
  }
}
```

This enables IDE tooling (autocomplete, go-to-definition) without requiring immediate conversion of all files.

## Migration Checklist for Converting a JS File

1. Rename `.jsx` → `.tsx` (or `.js` → `.ts`)
2. Remove `import PropTypes from 'prop-types'`
3. Create TypeScript interface for component props
4. Add `: PropsInterface` to the function parameter destructuring
5. Remove the `.propTypes = { ... }` block
6. Add `import type` for type-only imports
7. Add type annotations to hooks (`useState<T>`, `useRef<T>`)
8. Update any imports of this file in other files to use the new extension

## Related

- [ADR-044: TypeScript Migration](../adr/044-typescript-migration.md)
- ESLint rule `local/no-js-file-extension` — warns on `.js`/`.jsx` files
- ESLint `no-restricted-imports` — bans `prop-types` import

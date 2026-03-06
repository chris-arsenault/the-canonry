<!-- drift-generated -->
# WebUI Test Infrastructure

Every webui app in this monorepo uses **vitest** with **jsdom** for React component testing.

## Configuration

Each webui app has a `vitest.config.ts` at its root:

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx,js,jsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx,js,jsx}'],
      exclude: [
        'src/**/*.test.*',
        'src/**/__tests__/**',
        'src/main.*',
      ],
    },
  },
});
```

If the app has path aliases in its `vite.config` (e.g., illuminator's `@lib`), mirror them in `vitest.config.ts` under `resolve.alias`.

## Test File Convention

- **Naming:** `ComponentName.test.tsx` (TypeScript) or `ComponentName.test.jsx` (JavaScript)
- **Location:** Co-located next to the component file, not in a separate `__tests__/` directory
- **Pattern:** `.test.` not `.spec.` — enforced by ESLint rule `local/no-non-vitest-testing`

```
src/components/
  ChainLinkSection.tsx
  ChainLinkSection.test.tsx    # <-- co-located test
  ChainLinkSection.css
```

## Required devDependencies

```json
{
  "devDependencies": {
    "vitest": "^4.0.13",
    "@vitest/coverage-v8": "^4.0.13",
    "jsdom": "^26.1.0"
  }
}
```

When writing React component tests, also add:
```json
{
  "devDependencies": {
    "@testing-library/react": "^16.x",
    "@testing-library/jest-dom": "^6.x"
  }
}
```

## Scripts

Every webui `package.json` includes:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

## Running Tests

```bash
# Single app
cd apps/archivist/webui && pnpm test

# All apps from repo root (via turbo)
pnpm test

# Watch mode during development
cd apps/archivist/webui && pnpm test:watch

# With coverage
cd apps/archivist/webui && pnpm test:coverage
```

## What NOT to Do

- **Do not use jest** — vitest is the canonical test runner. ESLint will flag jest imports.
- **Do not use enzyme** — use `@testing-library/react` for component testing.
- **Do not name files `.spec.`** — use `.test.` for consistency. ESLint will flag this.
- **Do not create a separate `__tests__/` directory** — co-locate tests with their components.

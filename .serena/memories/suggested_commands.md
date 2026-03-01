# Suggested Commands

## Development
```bash
# Start all apps concurrently via dev proxy
pnpm run dev

# Start individual app (from its webui dir)
cd apps/<app-name>/webui && pnpm run dev
```

## Linting & Formatting
```bash
# Run all linting (ESLint + Stylelint)
pnpm run lint

# Lint with auto-fix
pnpm run lint:fix

# CSS-only linting
pnpm run lint:css
pnpm run lint:css:fix

# Check formatting
pnpm run format:check

# Auto-format
pnpm run format
```

## Testing
```bash
# Run all tests
pnpm run test

# Run tests for specific package
cd apps/lore-weave && npm test
cd apps/name-forge && npm test
```

## Schema Validation
```bash
pnpm run validate
pnpm run validate:verbose
```

## IMPORTANT: NEVER run these
- `npm run build` / `npx vite build` / `npx tsc --noEmit` — builds are forbidden per project rules
- `git reset` in any form — use `git restore --staged <file>` to unstage
- `git checkout -- <file>` — never discard working tree changes

## Utility
```bash
# Package installation
pnpm install

# Git (standard commands, no destructive ops)
git status
git diff
git log --oneline -20
git add <specific-files>
git commit -m "message"
```

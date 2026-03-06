# Task Completion Checklist

After completing any coding task:

1. **Run ESLint** on changed files:
   ```bash
   pnpm run lint
   ```
   Or for specific files: `npx eslint <file-path>`

2. **Run Stylelint** if CSS was changed:
   ```bash
   pnpm run lint:css
   ```

3. **Run Prettier check** if formatting matters:
   ```bash
   pnpm run format:check
   ```

4. **Run tests** if logic was changed:
   ```bash
   pnpm run test
   ```

5. **NEVER run builds** — they are forbidden and crash the dev server.

6. **NEVER run destructive git commands** — no `git reset`, no `git checkout --`.

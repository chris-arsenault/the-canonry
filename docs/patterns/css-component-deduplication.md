<!-- drift-generated -->
# CSS Component Deduplication Pattern

**ADR:** [023-css-component-deduplication](../adr/023-css-component-deduplication.md)
**ESLint rule:** `local/no-duplicate-component-css` (warn)

## The Rule

Shared-components owns canonical component CSS. Apps override only what differs.

## How It Works

1. `packages/shared-components/src/styles/components/` contains all shared CSS files
2. Apps import `@the-canonry/shared-components/styles` in their entry point
3. Apps that need different spacing/sizing add overrides to `compact-overrides.css`

## Adding App-Specific Overrides

When your app needs tighter spacing or different values for a shared component class:

```css
/* compact-overrides.css — override ONLY the properties that differ */

/* Section: tighter spacing for dense config layout */
.section {
  margin-bottom: 20px;
}

.section-header {
  margin-bottom: var(--spacing-md);
}

/* Form: compact sizing for dense config forms */
.input {
  padding: 6px 8px;
  font-size: var(--font-size-md);
  border-radius: var(--radius-md);
}

.textarea {
  padding: 6px 8px;
  font-size: var(--font-size-md);
  border-radius: var(--radius-md);
  min-height: 60px;
}

.select {
  padding: 6px 8px;
  font-size: var(--font-size-md);
  border-radius: var(--radius-md);
}

/* Dropdown: compact sizing for config editor menus */
.dropdown-menu {
  margin-top: 2px;
  border-radius: var(--radius-md);
  box-shadow: 0 8px 20px rgb(0 0 0 / 30%);
  max-height: 240px;
}

.dropdown-menu-item {
  gap: var(--spacing-sm);
  padding: 6px var(--spacing-md);
}

.dropdown-menu-icon {
  width: 22px;
  height: 22px;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  line-height: 1;
}

.dropdown-menu-label {
  font-size: var(--font-size-sm);
}
```

**Key points:**
- Only list properties that DIFFER from the shared version
- Do NOT duplicate the entire CSS file
- Group overrides by component with a comment explaining why

## What NOT To Do

```
# BAD: Creating a duplicate CSS file
apps/my-app/webui/src/styles/components/section.css   <-- NO
apps/my-app/webui/src/styles/components/form.css      <-- NO
apps/my-app/webui/src/styles/components/dropdown.css  <-- NO

# BAD: Copying the shared file and tweaking values
cp packages/shared-components/src/styles/components/form.css \
   apps/my-app/webui/src/styles/components/form.css  <-- NO

# GOOD: Override in compact-overrides.css
apps/my-app/webui/src/styles/components/compact-overrides.css  <-- YES
```

## Adding New Shared Component CSS

When creating a new shared component style:

1. Create the CSS file in `packages/shared-components/src/styles/components/`
2. Add the `@import` in `packages/shared-components/src/styles/index.css`
3. All apps importing `@the-canonry/shared-components/styles` get it automatically
4. If an app needs different values, add overrides to that app's `compact-overrides.css`

## Before Adding a CSS @import

Check the shared-components directory first:

```bash
ls packages/shared-components/src/styles/components/
```

If the file you want to add already exists there, use it via the shared import — do not
create a local copy.

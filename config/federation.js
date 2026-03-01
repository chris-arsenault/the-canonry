/**
 * Shared Module Federation configuration utilities.
 *
 * All MFE vite configs should import from this module to avoid
 * duplicating boilerplate (onwarn handlers, shared dep declarations).
 */

/**
 * Rollup onwarn handler that silences benign eval warnings from
 * @module-federation/sdk. Without this, every MFE build emits
 * dozens of EVAL warnings that are not actionable.
 */
export function federationOnWarn(warning, warn) {
  const isModuleFederationEval =
    warning.code === 'EVAL' &&
    (warning.id?.includes('@module-federation/sdk') ||
      warning.message.includes('@module-federation/sdk'));
  if (isModuleFederationEval) return;
  warn(warning);
}

/**
 * Base shared dependencies that every MFE remote and the host must declare.
 * React and react-dom are always singletons.
 */
export const sharedDepsBase = {
  react: { singleton: true, requiredVersion: '^19.0.0' },
  'react-dom': { singleton: true, requiredVersion: '^19.0.0' },
};

/**
 * Extended shared dependencies for apps that use stores and shared packages.
 * Includes base deps plus zustand, image-store, world-store, narrative-store.
 */
export const sharedDepsExtended = {
  ...sharedDepsBase,
  zustand: { singleton: true },
  '@the-canonry/shared-components': { singleton: true },
  '@the-canonry/image-store': { singleton: true },
  '@the-canonry/world-store': { singleton: true },
  '@the-canonry/narrative-store': { singleton: true },
};

/**
 * Build a shared deps object by picking from the extended set.
 * Only declare what the app actually uses.
 *
 * @param {...string} keys - Package names to include beyond base deps
 * @returns {Record<string, object>} Shared dependency config
 *
 * @example
 * // Just react/react-dom
 * sharedDeps()
 *
 * @example
 * // react/react-dom + zustand + image-store
 * sharedDeps('zustand', '@the-canonry/image-store')
 */
export function sharedDeps(...keys) {
  if (keys.length === 0) return { ...sharedDepsBase };
  const result = { ...sharedDepsBase };
  for (const key of keys) {
    if (sharedDepsExtended[key]) {
      result[key] = sharedDepsExtended[key];
    } else {
      result[key] = { singleton: true };
    }
  }
  return result;
}

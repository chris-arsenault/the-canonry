/**
 * Named aliases for optionality intent — semantic only, not enforced by the compiler.
 *
 * NOTE: Optional<T> and Legacy<T> both expand to T | undefined and are fully
 * interchangeable at the type level. TypeScript cannot distinguish them.
 * The distinction is for human reviewers: grep for Legacy<T> to find auditable
 * technical debt, grep for Optional<T> to find intentional design decisions.
 */

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

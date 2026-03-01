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

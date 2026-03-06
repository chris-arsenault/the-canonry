import { useCallback, type Dispatch, type SetStateAction, type KeyboardEvent } from "react";

/** A single Fuse.js-style search result with an `item` containing at least `id`. */
interface FuseResult {
  item: { id: string; [key: string]: unknown };
  [key: string]: unknown;
}

export interface KeyboardNavigationOptions {
  /** The current result set (Fuse-style objects with `.item.id`). */
  results: FuseResult[];
  /** Currently highlighted index. */
  selectedIndex: number;
  /** State setter for the index. */
  setSelectedIndex: Dispatch<SetStateAction<number>>;
  /** Called with the selected item's id on Enter. */
  onSelect: (id: string) => void;
  /** Called when Escape is pressed. */
  onEscape: () => void;
}

/**
 * Reusable keyboard navigation for search dropdowns.
 *
 * Handles ArrowDown/ArrowUp to move selection, Enter to confirm,
 * and Escape with a caller-supplied callback.
 *
 * @returns A stable onKeyDown handler (memoised via useCallback).
 */
export function useKeyboardNavigation({
  results,
  selectedIndex,
  setSelectedIndex,
  onSelect,
  onEscape,
}: KeyboardNavigationOptions): (e: KeyboardEvent) => void {
  return useCallback(
    (e: KeyboardEvent) => {
      if (results.length === 0) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (results[selectedIndex]) onSelect(results[selectedIndex].item.id);
          break;
        case "Escape":
          onEscape();
          break;
      }
    },
    [results, selectedIndex, setSelectedIndex, onSelect, onEscape]
  );
}

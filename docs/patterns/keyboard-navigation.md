<!-- drift-generated -->
# Pattern: Search Keyboard Navigation

## When to Use
Any search dropdown or autocomplete component that needs arrow-key navigation through results, Enter to select, and Escape to dismiss.

## Canonical Hook
```js
import { useKeyboardNavigation } from "@the-canonry/shared-components";
```

## API
```js
const handleKeyDown = useKeyboardNavigation({
  results,          // Fuse.js result array (objects with .item.id)
  selectedIndex,    // number — currently highlighted index
  setSelectedIndex, // state setter for the index
  onSelect,         // (id: string) => void — called on Enter
  onEscape,         // () => void — called on Escape
});
```

Returns a stable (memoized) `onKeyDown` handler suitable for `<input onKeyDown={...}>`.

## Usage Example

```jsx
import { useKeyboardNavigation } from "@the-canonry/shared-components";

function MySearch({ onNavigate }) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  // ... fuse.js setup, results ...

  const handleKeyDown = useKeyboardNavigation({
    results,
    selectedIndex,
    setSelectedIndex,
    onSelect: (id) => {
      onNavigate(id);
      setIsOpen(false);
      setQuery("");
    },
    onEscape: () => {
      setIsOpen(false);
      // setQuery("") here too if you want Escape to clear the query
    },
  });

  return (
    <input
      value={query}
      onKeyDown={(e) => { if (isOpen) handleKeyDown(e); }}
      // ...
    />
  );
}
```

## Key Behaviors
- **ArrowDown/ArrowUp**: moves `selectedIndex` within `[0, results.length - 1]`
- **Enter**: calls `onSelect(results[selectedIndex].item.id)` if a result exists at the index
- **Escape**: calls `onEscape()` — you decide what it does
- **Empty results**: handler returns early, no key events are consumed

## Anti-Pattern (Do NOT Do This)
Do not write inline switch statements that handle ArrowDown/ArrowUp/Enter/Escape. The ESLint rule `local/no-inline-keyboard-nav` will flag this.

```jsx
// BAD — inline duplication
const handleKeyDown = (e) => {
  switch (e.key) {
    case "ArrowDown": /* ... */ break;
    case "ArrowUp":   /* ... */ break;
    case "Enter":     /* ... */ break;
    case "Escape":    /* ... */ break;
  }
};
```

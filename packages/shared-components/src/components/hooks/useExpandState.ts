import { useState, useCallback, useMemo } from "react";
import type { KeyboardEvent } from "react";

// ---------------------------------------------------------------------------
// useExpandSingle - only one item open at a time
// ---------------------------------------------------------------------------

export interface ExpandSingleResult {
  expandedId: string | null;
  toggle: (id: string) => void;
}

export function useExpandSingle(): ExpandSingleResult {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggle = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  return { expandedId, toggle };
}

// ---------------------------------------------------------------------------
// useExpandSet - multiple items open simultaneously
// ---------------------------------------------------------------------------

export interface ExpandSetResult {
  expanded: Set<string>;
  toggle: (id: string) => void;
  set: (ids: Set<string>) => void;
  reset: () => void;
}

export function useExpandSet(): ExpandSetResult {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setExpanded(new Set());
  }, []);

  return { expanded, toggle, set: setExpanded, reset };
}

// ---------------------------------------------------------------------------
// expandableProps - accessibility helper for clickable expand triggers
// ---------------------------------------------------------------------------

export function expandableProps(
  onClick: () => void,
): {
  role: "button";
  tabIndex: 0;
  onClick: () => void;
  onKeyDown: (e: KeyboardEvent) => void;
} {
  return {
    role: "button" as const,
    tabIndex: 0 as const,
    onClick,
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onClick();
      }
    },
  };
}

// ---------------------------------------------------------------------------
// useExpandBoolean - simple boolean toggle for single-item components
// ---------------------------------------------------------------------------

export interface ExpandBooleanResult {
  expanded: boolean;
  toggle: () => void;
  hovering: boolean;
  setHovering: (v: boolean) => void;
  headerProps: ReturnType<typeof expandableProps> & {
    onMouseEnter: () => void;
    onMouseLeave: () => void;
  };
}

export function useExpandBoolean(): ExpandBooleanResult {
  const [expanded, setExpanded] = useState(false);
  const [hovering, setHovering] = useState(false);

  const toggle = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  const headerProps = useMemo(
    () => ({
      ...expandableProps(toggle),
      onMouseEnter: () => setHovering(true),
      onMouseLeave: () => setHovering(false),
    }),
    [toggle],
  );

  return { expanded, toggle, hovering, setHovering, headerProps };
}

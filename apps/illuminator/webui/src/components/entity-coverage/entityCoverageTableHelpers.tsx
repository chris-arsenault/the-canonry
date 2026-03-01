/**
 * Table infrastructure components and hooks for EntityCoveragePanel.
 */

import React, { useState, useCallback } from "react";
import type { SortState, SortableThProps, StaticThProps, EmptyRowProps } from "./entityCoverageTypes";

// ---------------------------------------------------------------------------
// useColumnSort hook
// ---------------------------------------------------------------------------

export function useColumnSort(
  defaultCol: string,
  defaultDesc = false,
): [SortState, (col: string) => void] {
  const [sort, setSort] = useState<SortState>({ col: defaultCol, desc: defaultDesc });

  const onSort = useCallback((col: string) => {
    setSort((prev) => ({
      col,
      desc: prev.col === col ? !prev.desc : false,
    }));
  }, []);

  return [sort, onSort];
}

// ---------------------------------------------------------------------------
// SortableTh
// ---------------------------------------------------------------------------

export function SortableTh({ children, sortKey, sort, onSort, right }: SortableThProps) {
  const isActive = sort.col === sortKey;
  const cls =
    [isActive && "ec-active", right && "ec-right"].filter(Boolean).join(" ") || undefined;

  const handleClick = useCallback(() => onSort(sortKey), [onSort, sortKey]);

  const arrow = isActive ? (sort.desc ? " \u25BE" : " \u25B4") : "";

  return (
    <th className={cls} onClick={handleClick}>
      {children}
      {arrow}
    </th>
  );
}

// ---------------------------------------------------------------------------
// StaticTh
// ---------------------------------------------------------------------------

export function StaticTh({ children, right }: StaticThProps) {
  const cls = ["ec-no-sort", right && "ec-right"].filter(Boolean).join(" ");
  return <th className={cls}>{children}</th>;
}

// ---------------------------------------------------------------------------
// EmptyRow
// ---------------------------------------------------------------------------

export function EmptyRow({ colSpan, text }: EmptyRowProps) {
  return (
    <tr className="ec-empty">
      <td colSpan={colSpan}>{text}</td>
    </tr>
  );
}

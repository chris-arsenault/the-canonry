/**
 * CoverageMatrix - Generic matrix component for visualizing coverage/relationships
 *
 * A reusable spreadsheet-style grid that shows relationships between two sets of items.
 * Used for:
 * - Profiles × Entity Kinds (Name Forge)
 * - Relationship Kinds × Entity Kinds (Canonry)
 * - And other coverage/relationship visualizations
 *
 * Props:
 * - rows: Array of row items with { id, label, group?, groupLabel?, metadata? }
 * - columns: Array of column items (strings or { id, label })
 * - getCellValue: (rowId, columnId) => 'none' | 'primary' | 'secondary' | 'both' | custom string
 * - getCellDisplay: (value, rowId, columnId) => { icon, className, title }
 * - onRowClick: (rowId, row) => void
 * - onCellClick: (rowId, columnId, value) => void
 * - title: string
 * - subtitle: string
 * - stats: Array of { label, value, variant? }
 * - legend: Array of { icon, label, className }
 * - searchPlaceholder: string
 * - groupByField: string (optional, groups rows by this field)
 * - columnHeaderClass: (columnId) => string (optional, for styling column headers)
 */

import React, { useState, useMemo, useCallback } from 'react';
import './CoverageMatrix.css';

interface StatusBadge {
  label: string;
  variant?: string;
}

interface MatrixRowData {
  id: string;
  label: string;
  group?: string;
  groupLabel?: string;
  statusBadges?: StatusBadge[];
  [key: string]: unknown;
}

interface MatrixColumn {
  id: string;
  label: string;
}

interface CellDisplay {
  icon: string;
  className?: string;
  title: string;
}

interface StatItem {
  label: string;
  value: string | number;
  variant?: string;
}

interface LegendItem {
  icon: string;
  label: string;
  className?: string;
}

interface FilterOption {
  id: string;
  label: string;
  filter?: (row: MatrixRowData) => boolean;
}

interface MatrixRowProps {
  row: MatrixRowData;
  idx: number;
  groupId: string;
  groupLabel: string;
  columns: MatrixColumn[];
  getCellValue: (rowId: string, columnId: string, row: MatrixRowData) => string;
  displayFn: (value: string, rowId: string, columnId: string) => CellDisplay;
  onRowClick?: (rowId: string, row: MatrixRowData) => void;
  onCellClick?: (rowId: string, columnId: string, value: string) => void;
}

interface CoverageMatrixProps {
  rows?: MatrixRowData[];
  columns?: (string | MatrixColumn)[];
  getCellValue: (rowId: string, columnId: string, row: MatrixRowData) => string;
  getCellDisplay?: (value: string, rowId: string, columnId: string) => CellDisplay;
  onRowClick?: (rowId: string, row: MatrixRowData) => void;
  onCellClick?: (rowId: string, columnId: string, value: string) => void;
  title?: string;
  subtitle?: string;
  stats?: StatItem[];
  legend?: LegendItem[];
  searchPlaceholder?: string;
  groupByField?: string;
  columnHeaderClass?: (columnId: string) => string;
  emptyMessage?: string;
  filterOptions?: FilterOption[];
}

function MatrixRow({ row, idx, groupId, groupLabel, columns, getCellValue, displayFn, onRowClick, onCellClick }: MatrixRowProps) {
  const handleCellClick = useCallback((e: React.MouseEvent, colId: string, value: string) => {
    if (onCellClick) {
      e.stopPropagation();
      onCellClick(row.id, colId, value);
    }
  }, [onCellClick, row.id]);

  return (
    <tr
      className={`mat-row cm-row ${onRowClick ? 'clickable' : ''}`}
      onClick={() => onRowClick?.(row.id, row)}
    >
      <td className="cm-group-col">
        {idx === 0 && groupId !== '_ungrouped' ? (
          <span className="cm-group-name">{groupLabel}</span>
        ) : null}
      </td>
      <td className="cm-label-col">
        <span className="cm-item-label">{row.label}</span>
      </td>
      <td className="cm-status-col">
        {row.statusBadges?.map((badge, i) => (
          <span key={i} className={`cm-badge ${badge.variant || ''}`}>
            {badge.label}
          </span>
        ))}
      </td>
      {columns.map((col) => {
        const value = getCellValue(row.id, col.id, row);
        const display = displayFn(value, row.id, col.id);
        return (
          <td
            key={col.id}
            className={`cm-cell ${display.className || ''}`}
            title={display.title}
            onClick={(e) => handleCellClick(e, col.id, value)}
          >
            <span className="cm-cell-icon">{display.icon}</span>
          </td>
        );
      })}
    </tr>
  );
}

export default function CoverageMatrix({
  rows = [],
  columns = [],
  getCellValue,
  getCellDisplay,
  onRowClick,
  onCellClick,
  title = 'Coverage Matrix',
  subtitle = '',
  stats = [],
  legend = [],
  searchPlaceholder = 'Search...',
  groupByField = 'group',
  columnHeaderClass,
  emptyMessage = 'No data to display.',
  filterOptions = [],
}: CoverageMatrixProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  // Normalize columns to { id, label } format
  const normalizedColumns = useMemo((): MatrixColumn[] => {
    return columns.map((col) =>
      typeof col === 'string' ? { id: col, label: col } : col
    );
  }, [columns]);

  // Filter rows by search
  const filteredRows = useMemo(() => {
    let result = rows;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (row) =>
          row.id.toLowerCase().includes(query) ||
          row.label.toLowerCase().includes(query) ||
          (row.groupLabel && row.groupLabel.toLowerCase().includes(query))
      );
    }

    if (activeFilter && filterOptions.length > 0) {
      const filterDef = filterOptions.find((f) => f.id === activeFilter);
      if (filterDef?.filter) {
        result = result.filter(filterDef.filter);
      }
    }

    return result;
  }, [rows, searchQuery, activeFilter, filterOptions]);

  // Group rows if groupByField is specified
  const groupedRows = useMemo(() => {
    if (!groupByField) {
      return { _ungrouped: { label: '', rows: filteredRows } };
    }

    const groups: Record<string, { label: string; rows: MatrixRowData[] }> = {};
    filteredRows.forEach((row) => {
      const groupId = (row[groupByField] as string) || '_ungrouped';
      const groupLabel = row.groupLabel || groupId;
      if (!groups[groupId]) {
        groups[groupId] = { label: groupLabel, rows: [] };
      }
      groups[groupId].rows.push(row);
    });
    return groups;
  }, [filteredRows, groupByField]);

  // Default cell display function
  const defaultGetCellDisplay = (value: string): CellDisplay => {
    switch (value) {
      case 'primary':
        return { icon: '✓', className: 'primary', title: 'Primary' };
      case 'secondary':
        return { icon: '○', className: 'secondary', title: 'Secondary' };
      case 'both':
        return { icon: '◉', className: 'both', title: 'Both' };
      case 'none':
      default:
        return { icon: '-', className: 'none', title: 'None' };
    }
  };

  const displayFn = getCellDisplay || defaultGetCellDisplay;

  return (
    <div className="mat-layout coverage-matrix">
      {/* Header */}
      <div className="cm-header">
        <h2 className="cm-title">{title}</h2>
        {subtitle && <p className="cm-subtitle">{subtitle}</p>}
      </div>

      {/* Stats Bar */}
      {stats.length > 0 && (
        <div className="cm-stats">
          {stats.map((stat, idx) => (
            <div key={idx} className={`cm-stat ${stat.variant || ''}`}>
              <span className="cm-stat-value">{stat.value}</span>
              <span className="cm-stat-label">{stat.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div className="mat-toolbar cm-toolbar">
        <input
          type="text"
          className="mat-search cm-search"
          placeholder={searchPlaceholder}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {filterOptions.length > 0 && (
          <div className="cm-filters">
            {filterOptions.map((filter) => (
              <button
                key={filter.id}
                className={`cm-filter-btn ${activeFilter === filter.id ? 'active' : ''}`}
                onClick={() =>
                  setActiveFilter(activeFilter === filter.id ? null : filter.id)
                }
              >
                {filter.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Matrix Grid */}
      <div className="mat-scroll-area cm-container">
        {(normalizedColumns.length === 0 || rows.length === 0) && (
          <div className="cm-empty">{emptyMessage}</div>
        )}
        {normalizedColumns.length > 0 && rows.length > 0 && filteredRows.length === 0 && (
          <div className="cm-empty">No items match the current filters.</div>
        )}
        {normalizedColumns.length > 0 && rows.length > 0 && filteredRows.length > 0 && (
          <table className="mat-table cm-table">
            <thead>
              <tr>
                <th className="cm-group-col">Group</th>
                <th className="cm-label-col">Name</th>
                <th className="cm-status-col">Status</th>
                {normalizedColumns.map((col) => (
                  <th
                    key={col.id}
                    className={`cm-data-col ${columnHeaderClass?.(col.id) || ''}`}
                    title={col.label}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(groupedRows).map(([groupId, { label: groupLabel, rows: groupRows }]) =>
                groupRows.map((row, idx) => (
                  <MatrixRow
                    key={row.id}
                    row={row}
                    idx={idx}
                    groupId={groupId}
                    groupLabel={groupLabel}
                    columns={normalizedColumns}
                    getCellValue={getCellValue}
                    displayFn={displayFn}
                    onRowClick={onRowClick}
                    onCellClick={onCellClick}
                  />
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Legend */}
      {legend.length > 0 && (
        <div className="mat-legend cm-legend">
          {legend.map((item, idx) => (
            <span key={idx} className="cm-legend-item">
              <span className={`cm-cell-icon sample ${item.className || ''}`}>
                {item.icon}
              </span>
              {item.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

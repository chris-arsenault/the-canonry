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
import type { Optional } from '../../types/optionality.js';

interface StatusBadge {
  label: string;
  variant: Optional<string>;
}

interface MatrixRowData {
  id: string;
  label: string;
  group: Optional<string>;
  groupLabel: Optional<string>;
  statusBadges: Optional<StatusBadge[]>;
  [key: string]: unknown;
}

interface MatrixColumn {
  id: string;
  label: string;
}

interface CellDisplay {
  icon: string;
  className: Optional<string>;
  title: string;
}

interface StatItem {
  label: string;
  value: string | number;
  variant: Optional<string>;
}

interface LegendItem {
  icon: string;
  label: string;
  className: Optional<string>;
}

interface FilterOption {
  id: string;
  label: string;
  filter: Optional<(row: MatrixRowData) => boolean>;
}

interface MatrixRowProps {
  readonly row: MatrixRowData;
  readonly idx: number;
  readonly groupId: string;
  readonly groupLabel: string;
  readonly columns: MatrixColumn[];
  readonly getCellValue: (rowId: string, columnId: string, row: MatrixRowData) => string;
  readonly displayFn: (value: string, rowId: string, columnId: string) => CellDisplay;
  readonly onRowClick: Optional<(rowId: string, row: MatrixRowData) => void>;
  readonly onCellClick: Optional<(rowId: string, columnId: string, value: string) => void>;
}

interface CoverageMatrixProps {
  readonly rows: Optional<MatrixRowData[]>;
  readonly columns: Optional<(string | MatrixColumn)[]>;
  readonly getCellValue: (rowId: string, columnId: string, row: MatrixRowData) => string;
  readonly getCellDisplay: Optional<(value: string, rowId: string, columnId: string) => CellDisplay>;
  readonly onRowClick: Optional<(rowId: string, row: MatrixRowData) => void>;
  readonly onCellClick: Optional<(rowId: string, columnId: string, value: string) => void>;
  readonly title: Optional<string>;
  readonly subtitle: Optional<string>;
  readonly stats: Optional<StatItem[]>;
  readonly legend: Optional<LegendItem[]>;
  readonly searchPlaceholder: Optional<string>;
  readonly groupByField: Optional<string>;
  readonly columnHeaderClass: Optional<(columnId: string) => string>;
  readonly emptyMessage: Optional<string>;
  readonly filterOptions: Optional<FilterOption[]>;
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

const DEFAULT_CELL_DISPLAY: Partial<Record<string, CellDisplay>> = {
  primary: { icon: '✓', className: 'primary', title: 'Primary' },
  secondary: { icon: '○', className: 'secondary', title: 'Secondary' },
  both: { icon: '◉', className: 'both', title: 'Both' },
};
const NONE_DISPLAY: CellDisplay = { icon: '-', className: 'none', title: 'None' };

function MatrixStatsBar({ stats }: { readonly stats: StatItem[] }) {
  if (stats.length === 0) return null;
  return (
    <div className="cm-stats">
      {stats.map((stat, idx) => (
        <div key={idx} className={`cm-stat ${stat.variant || ''}`}>
          <span className="cm-stat-value">{stat.value}</span>
          <span className="cm-stat-label">{stat.label}</span>
        </div>
      ))}
    </div>
  );
}

function MatrixLegend({ legend }: { readonly legend: LegendItem[] }) {
  if (legend.length === 0) return null;
  return (
    <div className="mat-legend cm-legend">
      {legend.map((item, idx) => (
        <span key={idx} className="cm-legend-item">
          <span className={`cm-cell-icon sample ${item.className || ''}`}>{item.icon}</span>
          {item.label}
        </span>
      ))}
    </div>
  );
}

interface MatrixGridProps {
  readonly rows: MatrixRowData[];
  readonly filteredRows: MatrixRowData[];
  readonly columns: MatrixColumn[];
  readonly groupedRows: Record<string, { label: string; rows: MatrixRowData[] }>;
  readonly displayFn: (value: string, rowId: string, columnId: string) => CellDisplay;
  readonly getCellValue: (rowId: string, columnId: string, row: MatrixRowData) => string;
  readonly onRowClick: Optional<(rowId: string, row: MatrixRowData) => void>;
  readonly onCellClick: Optional<(rowId: string, columnId: string, value: string) => void>;
  readonly columnHeaderClass: Optional<(columnId: string) => string>;
  readonly emptyMessage: string;
}

function MatrixGrid({ rows, filteredRows, columns, groupedRows, displayFn, getCellValue, onRowClick, onCellClick, columnHeaderClass, emptyMessage }: MatrixGridProps) {
  if (columns.length === 0 || rows.length === 0) return <div className="cm-empty">{emptyMessage}</div>;
  if (filteredRows.length === 0) return <div className="cm-empty">No items match the current filters.</div>;
  return (
    <table className="mat-table cm-table">
      <thead>
        <tr>
          <th className="cm-group-col">Group</th>
          <th className="cm-label-col">Name</th>
          <th className="cm-status-col">Status</th>
          {columns.map((col) => (
            <th key={col.id} className={`cm-data-col ${columnHeaderClass?.(col.id) || ''}`} title={col.label}>{col.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Object.entries(groupedRows).map(([groupId, { label: groupLabel, rows: groupRows }]) =>
          groupRows.map((row, idx) => (
            <MatrixRow key={row.id} row={row} idx={idx} groupId={groupId} groupLabel={groupLabel}
              columns={columns} getCellValue={getCellValue} displayFn={displayFn}
              onRowClick={onRowClick} onCellClick={onCellClick} />
          ))
        )}
      </tbody>
    </table>
  );
}

const EMPTY_ROWS: MatrixRowData[] = [];
const EMPTY_COLS: (string | MatrixColumn)[] = [];
const EMPTY_STATS: StatItem[] = [];
const EMPTY_LEGEND: LegendItem[] = [];
const EMPTY_FILTERS: FilterOption[] = [];

// eslint-disable-next-line complexity -- matrix with search, filters, grouping, stats, and legend requires inherent branching
export default function CoverageMatrix({
  rows = EMPTY_ROWS, columns = EMPTY_COLS, getCellValue, getCellDisplay,
  onRowClick, onCellClick, title = 'Coverage Matrix', subtitle = '',
  stats = EMPTY_STATS, legend = EMPTY_LEGEND, searchPlaceholder = 'Search...',
  groupByField = 'group', columnHeaderClass, emptyMessage = 'No data to display.', filterOptions = EMPTY_FILTERS,
}: CoverageMatrixProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const normalizedColumns = useMemo((): MatrixColumn[] => columns.map((col) => typeof col === 'string' ? { id: col, label: col } : col), [columns]);
  const filteredRows = useMemo(() => {
    let result = rows;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter((row) => row.id.toLowerCase().includes(query) || row.label.toLowerCase().includes(query) || (row.groupLabel && row.groupLabel.toLowerCase().includes(query)));
    }
    if (activeFilter && filterOptions.length > 0) {
      const filterDef = filterOptions.find((f) => f.id === activeFilter);
      if (filterDef?.filter) result = result.filter(filterDef.filter);
    }
    return result;
  }, [rows, searchQuery, activeFilter, filterOptions]);
  const groupedRows = useMemo(() => {
    if (!groupByField) return { _ungrouped: { label: '', rows: filteredRows } };
    const groups: Record<string, { label: string; rows: MatrixRowData[] }> = {};
    filteredRows.forEach((row) => {
      const gid = (row[groupByField] as string) || '_ungrouped';
      if (!groups[gid]) groups[gid] = { label: row.groupLabel || gid, rows: [] };
      groups[gid].rows.push(row);
    });
    return groups;
  }, [filteredRows, groupByField]);
  const displayFn = getCellDisplay || ((value: string) => DEFAULT_CELL_DISPLAY[value] || NONE_DISPLAY);

  return (
    <div className="mat-layout coverage-matrix">
      <div className="cm-header">
        <h2 className="cm-title">{title}</h2>
        {subtitle && <p className="cm-subtitle">{subtitle}</p>}
      </div>
      <MatrixStatsBar stats={stats} />
      <div className="mat-toolbar cm-toolbar">
        <input type="text" className="mat-search cm-search" placeholder={searchPlaceholder}
          value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        {filterOptions.length > 0 && (
          <div className="cm-filters">
            {filterOptions.map((filter) => (
              <button key={filter.id} className={`cm-filter-btn ${activeFilter === filter.id ? 'active' : ''}`}
                onClick={() => setActiveFilter(activeFilter === filter.id ? null : filter.id)}>{filter.label}</button>
            ))}
          </div>
        )}
      </div>
      <div className="mat-scroll-area cm-container">
        <MatrixGrid rows={rows} filteredRows={filteredRows} columns={normalizedColumns}
          groupedRows={groupedRows} displayFn={displayFn} getCellValue={getCellValue}
          onRowClick={onRowClick} onCellClick={onCellClick} columnHeaderClass={columnHeaderClass}
          emptyMessage={emptyMessage} />
      </div>
      <MatrixLegend legend={legend} />
    </div>
  );
}

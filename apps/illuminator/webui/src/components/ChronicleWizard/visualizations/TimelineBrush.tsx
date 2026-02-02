/**
 * TimelineBrush - Draggable range selection for timeline
 *
 * Allows users to select a time range by dragging handles or the selection itself.
 * Much faster than individual checkboxes for bulk selection.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { tickToX, xToTick } from '../../../lib/chronicle/timelineUtils';

interface TimelineBrushProps {
  width: number;
  height: number;
  extent: [number, number];
  padding?: number;
  /** Current selection range in ticks */
  selection: [number, number] | null;
  /** Called when selection changes */
  onSelectionChange: (range: [number, number] | null) => void;
  /** Minimum selection size in pixels */
  minSelectionWidth?: number;
}

type DragMode = 'none' | 'left' | 'right' | 'move' | 'create';

export default function TimelineBrush({
  width,
  height,
  extent,
  padding = 40,
  selection,
  onSelectionChange,
  minSelectionWidth = 20,
}: TimelineBrushProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragMode, setDragMode] = useState<DragMode>('none');
  const [dragStart, setDragStart] = useState<{ x: number; selection: [number, number] | null }>({
    x: 0,
    selection: null,
  });

  const handleSize = 8;

  // Convert selection to pixel positions
  const selectionPx = selection
    ? {
        left: tickToX(selection[0], extent, width, padding),
        right: tickToX(selection[1], extent, width, padding),
      }
    : null;

  const getMouseX = useCallback(
    (e: React.MouseEvent | MouseEvent) => {
      if (!svgRef.current) return 0;
      const rect = svgRef.current.getBoundingClientRect();
      return e.clientX - rect.left;
    },
    []
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, mode: DragMode) => {
      e.preventDefault();
      e.stopPropagation();
      setDragMode(mode);
      setDragStart({ x: getMouseX(e), selection });
    },
    [selection, getMouseX]
  );

  const handleBackgroundMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const x = getMouseX(e);
      // If clicking outside selection, start creating new selection
      if (!selectionPx || x < selectionPx.left - handleSize || x > selectionPx.right + handleSize) {
        setDragMode('create');
        const tick = xToTick(x, extent, width, padding);
        setDragStart({ x, selection: [tick, tick] });
        onSelectionChange([tick, tick]);
      }
    },
    [selectionPx, extent, width, padding, getMouseX, onSelectionChange, handleSize]
  );

  useEffect(() => {
    if (dragMode === 'none') return;

    const handleMouseMove = (e: MouseEvent) => {
      const x = getMouseX(e);
      const dx = x - dragStart.x;

      if (dragMode === 'create') {
        const startTick = dragStart.selection![0];
        const currentTick = xToTick(x, extent, width, padding);
        const newSelection: [number, number] =
          currentTick >= startTick ? [startTick, currentTick] : [currentTick, startTick];
        onSelectionChange(newSelection);
        return;
      }

      if (!dragStart.selection) return;

      const [startTick, endTick] = dragStart.selection;

      if (dragMode === 'left') {
        const newLeft = xToTick(tickToX(startTick, extent, width, padding) + dx, extent, width, padding);
        const clamped = Math.min(newLeft, endTick - 1);
        onSelectionChange([Math.max(extent[0], clamped), endTick]);
      } else if (dragMode === 'right') {
        const newRight = xToTick(tickToX(endTick, extent, width, padding) + dx, extent, width, padding);
        const clamped = Math.max(newRight, startTick + 1);
        onSelectionChange([startTick, Math.min(extent[1], clamped)]);
      } else if (dragMode === 'move') {
        const tickDelta = xToTick(dragStart.x + dx, extent, width, padding) - xToTick(dragStart.x, extent, width, padding);
        let newStart = startTick + tickDelta;
        let newEnd = endTick + tickDelta;

        // Clamp to extent
        if (newStart < extent[0]) {
          const shift = extent[0] - newStart;
          newStart = extent[0];
          newEnd += shift;
        }
        if (newEnd > extent[1]) {
          const shift = newEnd - extent[1];
          newEnd = extent[1];
          newStart -= shift;
        }

        onSelectionChange([Math.max(extent[0], newStart), Math.min(extent[1], newEnd)]);
      }
    };

    const handleMouseUp = () => {
      setDragMode('none');
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragMode, dragStart, extent, width, padding, getMouseX, onSelectionChange]);

  const getCursor = (mode: DragMode) => {
    switch (mode) {
      case 'left':
      case 'right':
        return 'ew-resize';
      case 'move':
        return 'grab';
      case 'create':
        return 'crosshair';
      default:
        return 'crosshair';
    }
  };

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      style={{ cursor: getCursor(dragMode === 'none' ? 'create' : dragMode), display: 'block' }}
      onMouseDown={handleBackgroundMouseDown}
    >
      {/* Background track */}
      <rect
        x={padding}
        y={4}
        width={width - 2 * padding}
        height={height - 8}
        rx={4}
        fill="var(--bg-tertiary)"
        stroke="var(--border-color)"
        strokeWidth={1}
      />

      {/* Selection */}
      {selectionPx && selectionPx.right - selectionPx.left >= minSelectionWidth && (
        <g>
          {/* Selection rect */}
          <rect
            x={selectionPx.left}
            y={4}
            width={selectionPx.right - selectionPx.left}
            height={height - 8}
            rx={4}
            fill="rgba(99, 102, 241, 0.3)"
            stroke="var(--accent-color)"
            strokeWidth={1}
            style={{ cursor: 'grab' }}
            onMouseDown={(e) => handleMouseDown(e, 'move')}
          />

          {/* Left handle */}
          <rect
            x={selectionPx.left - handleSize / 2}
            y={height / 2 - 12}
            width={handleSize}
            height={24}
            rx={2}
            fill="var(--accent-color)"
            style={{ cursor: 'ew-resize' }}
            onMouseDown={(e) => handleMouseDown(e, 'left')}
          />

          {/* Right handle */}
          <rect
            x={selectionPx.right - handleSize / 2}
            y={height / 2 - 12}
            width={handleSize}
            height={24}
            rx={2}
            fill="var(--accent-color)"
            style={{ cursor: 'ew-resize' }}
            onMouseDown={(e) => handleMouseDown(e, 'right')}
          />

          {/* Selection label */}
          {selection && (
            <text
              x={(selectionPx.left + selectionPx.right) / 2}
              y={height / 2 + 4}
              textAnchor="middle"
              fontSize="10"
              fontWeight="500"
              fill="var(--accent-color)"
              style={{ pointerEvents: 'none' }}
            >
              {selection[0]} – {selection[1]}
            </text>
          )}
        </g>
      )}

      {/* Instructions when no selection */}
      {!selectionPx && (
        <text
          x={width / 2}
          y={height / 2 + 4}
          textAnchor="middle"
          fontSize="11"
          fill="var(--text-muted)"
          style={{ pointerEvents: 'none' }}
        >
          Drag to select time range
        </text>
      )}
    </svg>
  );
}

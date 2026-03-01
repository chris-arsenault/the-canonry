import React, { useCallback } from "react";
import { expandableProps } from "@the-canonry/shared-components";
import type { WeaveCandidate } from "./types";
import CandidateRow from "./CandidateRow";

export default function EntityGroup({
  entityName,
  candidates,
  variants,
  decisions,
  onToggle,
  onAcceptAll,
  onRejectAll,
  expanded,
  onToggleExpand,
}: Readonly<{
  entityName: string;
  candidates: WeaveCandidate[];
  variants: Map<string, string>;
  decisions: Record<string, boolean>;
  onToggle: (id: string) => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
  expanded: boolean;
  onToggleExpand: () => void;
}>) {
  const acceptCount = candidates.filter((c) => decisions[c.id]).length;
  const rejectCount = candidates.length - acceptCount;

  const handleAcceptClick = useCallback(
    (e: React.MouseEvent) => { e.stopPropagation(); onAcceptAll(); },
    [onAcceptAll],
  );
  const handleRejectClick = useCallback(
    (e: React.MouseEvent) => { e.stopPropagation(); onRejectAll(); },
    [onRejectAll],
  );

  return (
    <div className="dmw-entity-group">
      <div className="dmw-entity-group-header" {...expandableProps(onToggleExpand)}>
        <span className="viewer-expand-icon">
          {expanded ? "\u25BC" : "\u25B6"}
        </span>
        <span className="dmw-entity-name">{entityName}</span>
        <span className="dmw-candidate-count">
          {candidates.length} {candidates.length === 1 ? "candidate" : "candidates"}
        </span>
        {acceptCount > 0 && (
          <span className="dmw-accept-count">{acceptCount}{"\u2713"}</span>
        )}
        {rejectCount > 0 && (
          <span className="dmw-reject-count">{rejectCount}{"\u2717"}</span>
        )}
        <button onClick={handleAcceptClick} title="Accept all in this entity" className="dmw-bulk-accept-btn">
          {"all\u2713"}
        </button>
        <button onClick={handleRejectClick} title="Reject all in this entity" className="dmw-bulk-reject-btn">
          {"all\u2717"}
        </button>
      </div>
      {expanded && (
        <div className="dmw-entity-group-body">
          {candidates.map((c) => (
            <CandidateRow
              key={c.id}
              candidate={c}
              variant={variants.get(c.id)}
              accepted={!!decisions[c.id]}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

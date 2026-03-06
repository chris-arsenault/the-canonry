import React, { useCallback } from "react";
import type { WeaveCandidate } from "./types";

export default function CandidateRow({
  candidate,
  variant,
  accepted,
  onToggle,
}: Readonly<{
  candidate: WeaveCandidate;
  variant?: string;
  accepted: boolean;
  onToggle: (id: string) => void;
}>) {
  const handleToggle = useCallback(() => onToggle(candidate.id), [onToggle, candidate.id]);

  return (
    <div
      className={`dmw-candidate-row ${accepted ? "dmw-candidate-row-accepted" : "dmw-candidate-row-rejected"}`}
    >
      <input
        type="checkbox"
        checked={accepted}
        onChange={handleToggle}
        className="dmw-candidate-checkbox"
      />
      <div className="dmw-candidate-body">
        <span className="dmw-context-text">
          {candidate.contextBefore}
        </span>
        <span
          className={`dmw-original-sentence ${accepted && variant ? "dmw-original-strikethrough" : "dmw-original-neutral"}`}
        >
          {candidate.sentence}
        </span>
        {accepted && variant && (
          <>
            {" "}
            <span className="dmw-variant-text">
              {variant}
            </span>
          </>
        )}
        <span className="dmw-context-text">
          {candidate.contextAfter}
        </span>
      </div>
    </div>
  );
}

import React, { useCallback } from "react";
import type { WeaveCandidate, EntityGroupData } from "./types";
import EntityGroup from "./EntityGroup";

/**
 * Renders a list of EntityGroup components with properly memoized
 * per-group callbacks to avoid react-perf/jsx-no-new-function-as-prop.
 */
function EntityGroupItem({
  group,
  variants,
  decisions,
  onToggle,
  onAcceptGroup,
  onRejectGroup,
  expanded,
  onToggleExpand,
}: Readonly<{
  group: EntityGroupData;
  variants: Map<string, string>;
  decisions: Record<string, boolean>;
  onToggle: (id: string) => void;
  onAcceptGroup: (candidates: WeaveCandidate[]) => void;
  onRejectGroup: (candidates: WeaveCandidate[]) => void;
  expanded: boolean;
  onToggleExpand: (key: string) => void;
}>) {
  const handleAcceptAll = useCallback(
    () => onAcceptGroup(group.candidates),
    [onAcceptGroup, group.candidates],
  );
  const handleRejectAll = useCallback(
    () => onRejectGroup(group.candidates),
    [onRejectGroup, group.candidates],
  );
  const handleToggleExpand = useCallback(
    () => onToggleExpand(group.entityId),
    [onToggleExpand, group.entityId],
  );

  return (
    <EntityGroup
      entityName={group.entityName}
      candidates={group.candidates}
      variants={variants}
      decisions={decisions}
      onToggle={onToggle}
      onAcceptAll={handleAcceptAll}
      onRejectAll={handleRejectAll}
      expanded={expanded}
      onToggleExpand={handleToggleExpand}
    />
  );
}

export default function EntityGroupList({
  groups,
  variants,
  decisions,
  onToggle,
  onAcceptGroup,
  onRejectGroup,
  expandedGroups,
  onToggleExpand,
}: Readonly<{
  groups: EntityGroupData[];
  variants: Map<string, string>;
  decisions: Record<string, boolean>;
  onToggle: (id: string) => void;
  onAcceptGroup: (candidates: WeaveCandidate[]) => void;
  onRejectGroup: (candidates: WeaveCandidate[]) => void;
  expandedGroups: Set<string>;
  onToggleExpand: (key: string) => void;
}>) {
  return (
    <>
      {groups.map((group) => (
        <EntityGroupItem
          key={group.entityId}
          group={group}
          variants={variants}
          decisions={decisions}
          onToggle={onToggle}
          onAcceptGroup={onAcceptGroup}
          onRejectGroup={onRejectGroup}
          expanded={expandedGroups.has(group.entityId)}
          onToggleExpand={onToggleExpand}
        />
      ))}
    </>
  );
}

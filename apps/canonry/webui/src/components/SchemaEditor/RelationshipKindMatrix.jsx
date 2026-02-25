/**
 * RelationshipKindMatrix - Matrix view showing relationship kinds × entity kinds coverage
 *
 * Uses the shared CoverageMatrix component to display:
 * - Rows: Relationship kinds
 * - Columns: Entity kinds
 * - Cells: S=Source, D=Destination, B=Both, -=Neither
 */

import { useMemo, useCallback } from "react";
import { CoverageMatrix } from "@penguin-tales/shared-components";

export default function RelationshipKindMatrix({
  relationshipKinds = [],
  entityKinds = [],
  onNavigateToRelationship,
}) {
  // Build rows from relationship kinds
  const rows = useMemo(() => {
    return relationshipKinds.map((rel) => ({
      id: rel.kind,
      label: rel.description || rel.kind,
      // Store original data for getCellValue
      srcKinds: rel.srcKinds || [],
      dstKinds: rel.dstKinds || [],
      // Status badges
      statusBadges: getStatusBadges(rel),
    }));
  }, [relationshipKinds]);

  // Build columns from entity kinds
  const columns = useMemo(() => {
    return entityKinds.map((ek) => ({
      id: ek.kind,
      label: ek.description || ek.kind,
    }));
  }, [entityKinds]);

  // Calculate coverage stats
  const stats = useMemo(() => {
    const totalRels = relationshipKinds.length;
    const totalEntityKinds = entityKinds.length;

    // Count relationships that have explicit constraints
    const constrainedRels = relationshipKinds.filter(
      (r) => r.srcKinds?.length > 0 || r.dstKinds?.length > 0
    ).length;

    // Count relationships with no constraints (wildcard)
    const wildcardRels = totalRels - constrainedRels;

    // Find entity kinds that are never used as source or destination
    const usedAsSource = new Set();
    const usedAsDestination = new Set();
    relationshipKinds.forEach((rel) => {
      (rel.srcKinds || []).forEach((k) => usedAsSource.add(k));
      (rel.dstKinds || []).forEach((k) => usedAsDestination.add(k));
    });

    // If a relationship has no constraints, it can relate any entity kind
    const hasWildcards = wildcardRels > 0;

    const result = [
      { label: "Relationships", value: totalRels },
      { label: "Entity Kinds", value: totalEntityKinds },
      { label: "Constrained", value: constrainedRels },
    ];

    if (wildcardRels > 0) {
      result.push({ label: "Wildcards", value: wildcardRels, variant: "warning" });
    }

    return result;
  }, [relationshipKinds, entityKinds]);

  // Get cell value for a relationship × entity kind intersection
  const getCellValue = useCallback((rowId, columnId, row) => {
    const isSource = row.srcKinds.length === 0 || row.srcKinds.includes(columnId);
    const isDestination = row.dstKinds.length === 0 || row.dstKinds.includes(columnId);

    // Check if explicitly constrained vs wildcard
    const srcExplicit = row.srcKinds.length > 0 && row.srcKinds.includes(columnId);
    const dstExplicit = row.dstKinds.length > 0 && row.dstKinds.includes(columnId);
    const srcWildcard = row.srcKinds.length === 0;
    const dstWildcard = row.dstKinds.length === 0;

    if (srcExplicit && dstExplicit) return "both";
    if (srcExplicit) return "primary"; // explicitly source
    if (dstExplicit) return "secondary"; // explicitly destination
    if (srcWildcard && dstWildcard) return "both"; // wildcard both
    if (srcWildcard) return "primary"; // wildcard source
    if (dstWildcard) return "secondary"; // wildcard destination
    return "none";
  }, []);

  // Custom cell display for relationship coverage
  const getCellDisplay = useCallback((value) => {
    switch (value) {
      case "both":
        return { icon: "B", className: "both", title: "Both source and destination" };
      case "primary":
        return { icon: "S", className: "primary", title: "Source only" };
      case "secondary":
        return { icon: "D", className: "secondary", title: "Destination only" };
      case "none":
      default:
        return { icon: "-", className: "none", title: "Not allowed" };
    }
  }, []);

  // Handle row click to navigate to relationship
  const handleRowClick = useCallback(
    (rowId) => {
      if (onNavigateToRelationship) {
        onNavigateToRelationship(rowId);
      }
    },
    [onNavigateToRelationship]
  );

  // Filter options
  const filterOptions = useMemo(
    () => [
      {
        id: "wildcards",
        label: "Wildcards Only",
        filter: (row) => row.srcKinds.length === 0 || row.dstKinds.length === 0,
      },
      {
        id: "constrained",
        label: "Constrained Only",
        filter: (row) => row.srcKinds.length > 0 && row.dstKinds.length > 0,
      },
    ],
    []
  );

  // Legend items
  const legend = useMemo(
    () => [
      { icon: "S", className: "primary", label: "Can be source" },
      { icon: "D", className: "secondary", label: "Can be destination" },
      { icon: "B", className: "both", label: "Both source and destination" },
      { icon: "-", className: "none", label: "Not allowed" },
    ],
    []
  );

  return (
    <CoverageMatrix
      rows={rows}
      columns={columns}
      getCellValue={getCellValue}
      getCellDisplay={getCellDisplay}
      onRowClick={handleRowClick}
      title="Relationship × Entity Kind Matrix"
      subtitle="Shows which entity kinds can participate in each relationship as source (S), destination (D), or both (B). Click a row to navigate to that relationship."
      stats={stats}
      legend={legend}
      searchPlaceholder="Search relationships..."
      groupByField={null}
      emptyMessage="No relationship kinds defined."
      filterOptions={filterOptions}
    />
  );
}

// Helper to generate status badges for a relationship
function getStatusBadges(rel) {
  const badges = [];

  const srcCount = rel.srcKinds?.length || 0;
  const dstCount = rel.dstKinds?.length || 0;

  if (srcCount === 0 && dstCount === 0) {
    badges.push({ label: "Wildcard", variant: "warning" });
  } else {
    if (srcCount > 0) {
      badges.push({ label: `${srcCount} src`, variant: "primary" });
    } else {
      badges.push({ label: "Any src", variant: "secondary" });
    }
    if (dstCount > 0) {
      badges.push({ label: `${dstCount} dst`, variant: "primary" });
    } else {
      badges.push({ label: "Any dst", variant: "secondary" });
    }
  }

  return badges;
}

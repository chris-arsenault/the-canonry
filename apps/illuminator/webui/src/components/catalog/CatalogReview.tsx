/**
 * CatalogReview — Stub placeholder for Task 9.
 * Will be replaced with full review & edit UI.
 */

import React from "react";
import type { StyleLibrary } from "@canonry/world-schema";

interface CatalogReviewProps {
  projectId: string;
  styleLibrary?: StyleLibrary | null;
}

export default function CatalogReview({ projectId, styleLibrary }: Readonly<CatalogReviewProps>) {
  return (
    <div style={{ padding: 20, color: "var(--text-secondary, #888)" }}>
      Review &amp; Edit — coming soon. Use Coverage Report to run deterministic fill first.
    </div>
  );
}

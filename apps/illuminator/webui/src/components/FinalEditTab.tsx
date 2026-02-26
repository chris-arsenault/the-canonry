/**
 * FinalEditTab — Corpus-wide editorial tools.
 *
 * Currently hosts CorpusFindReplace. Designed as a container for
 * additional post-production tools as needed.
 */

import CorpusFindReplace from "./CorpusFindReplace";
import React from "react";

const styles = {
  section: { marginBottom: "16px" },
  heading: { margin: 0, fontSize: "14px" },
  subtitle: { margin: "4px 0 0", fontSize: "11px", color: "var(--text-muted)" },
} as const;

export default function FinalEditTab() {
  return (
    <div>
      <div style={styles.section}>
        <h3 style={styles.heading}>Corpus Find & Replace</h3>
        <p style={styles.subtitle}>
          Search and replace across chronicle content, chronicle annotations, and entity annotations
        </p>
      </div>
      <CorpusFindReplace />
    </div>
  );
}

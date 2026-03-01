/**
 * FinalEditTab — Corpus-wide editorial tools.
 *
 * Currently hosts CorpusFindReplace. Designed as a container for
 * additional post-production tools as needed.
 */

import CorpusFindReplace from "./CorpusFindReplace";
import React from "react";
import "./FinalEditTab.css";

export default function FinalEditTab() {
  return (
    <div>
      <div className="fet-section">
        <h3 className="fet-heading">Corpus Find & Replace</h3>
        <p className="fet-subtitle">
          Search and replace across chronicle content, chronicle annotations, and entity annotations
        </p>
      </div>
      <CorpusFindReplace />
    </div>
  );
}

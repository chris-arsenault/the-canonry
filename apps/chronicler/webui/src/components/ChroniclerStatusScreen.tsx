import React from "react";
import { ErrorMessage } from "@the-canonry/shared-components";

interface ChroniclerStatusScreenProps {
  loading: boolean;
  loadError: string | null;
}

export default function ChroniclerStatusScreen({
  loading,
  loadError,
}: Readonly<ChroniclerStatusScreenProps>) {
  if (loading) {
    return (
      <div className="cst-container">
        <div className="cst-content">
          <div className="cst-title">Loading World Data</div>
          <div className="detail">Reading from local storage...</div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="cst-container">
        <div className="cst-content">
          <div className="icon">&#x2756;</div>
          <ErrorMessage title="World Data Unavailable" message={loadError} />
        </div>
      </div>
    );
  }

  return (
    <div className="cst-container">
      <div className="cst-content">
        <div className="icon">&#x2756;</div>
        <div className="cst-title">No World Data</div>
        <div className="detail">
          Run a simulation in Lore Weave and enrich it with Illuminator to view the world chronicle.
        </div>
      </div>
    </div>
  );
}

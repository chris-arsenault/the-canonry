export default function IlluminatorEmptyState({ canImport, isDataSyncing, handleDataSync, dataSyncStatus }) {
  return (
    <div className="illuminator-empty-state">
      <div className="illuminator-empty-state-icon">&#x2728;</div>
      <div className="illuminator-empty-state-title">
        {canImport ? "No Local Data Loaded" : "No World Data"}
      </div>
      <div className="illuminator-empty-state-desc">
        {canImport ? (
          "Dexie is empty for this slot. Import from hard state to begin."
        ) : (
          <>
            Run a simulation in <strong>Lore Weave</strong> first, then return here to enrich your
            world with LLM-generated descriptions and images.
          </>
        )}
      </div>
      {canImport && (
        <div style={{ display: "flex", gap: "10px", marginTop: "16px", flexWrap: "wrap" }}>
          <button
            type="button"
            className="illuminator-btn illuminator-btn-primary"
            disabled={isDataSyncing}
            onClick={() => handleDataSync("patch")}
          >
            {isDataSyncing ? "Importing..." : "Patch from Hard State"}
          </button>
          <button
            type="button"
            className="illuminator-btn illuminator-btn-danger"
            disabled={isDataSyncing}
            onClick={() => handleDataSync("overwrite")}
          >
            Overwrite from Hard State
          </button>
        </div>
      )}
      {dataSyncStatus && (
        <div
          style={{
            marginTop: "12px",
            fontSize: "12px",
            color: dataSyncStatus.type === "error" ? "#ef4444" : "#10b981",
          }}
        >
          {dataSyncStatus.message}
        </div>
      )}
    </div>
  );
}

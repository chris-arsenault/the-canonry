export default function StatusScreen({ status, error, bundleRequestUrl, onRetry, worldData }) {
  if (status === "loading") {
    return (
      <div className="app">
        <div className="state-screen">
          <div className="state-card">
            <div className="state-title">Loading viewer bundle...</div>
            <div className="state-detail">Fetching {bundleRequestUrl}</div>
          </div>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="app">
        <div className="state-screen">
          <div className="state-card">
            <div className="state-title state-error">Bundle unavailable</div>
            <div className="state-detail">
              {error?.message || "Failed to load the viewer bundle."}
            </div>
            <div className="state-detail">
              Expected at: {bundleRequestUrl}
            </div>
            <div className="state-actions">
              <button className="button" onClick={onRetry} type="button">
                Retry
              </button>
              <button
                className="button secondary"
                onClick={() => window.location.reload()}
                type="button"
              >
                Reload page
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!worldData) {
    return (
      <div className="app">
        <div className="state-screen">
          <div className="state-card">
            <div className="state-title">Bundle is empty</div>
            <div className="state-detail">No world data found in {bundleRequestUrl}.</div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

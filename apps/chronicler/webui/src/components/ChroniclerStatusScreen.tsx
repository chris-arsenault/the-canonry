const containerStyle = {
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "var(--color-bg-primary, #352a1e)",
  color: "var(--color-text-muted, #8a7d6b)",
} as const;

const titleStyle = {
  fontSize: "18px",
  color: "var(--color-text-primary, #e8dcc8)",
  marginBottom: "8px",
  fontFamily: '"Playfair Display", Georgia, serif',
} as const;

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
      <div style={containerStyle}>
        <div style={{ textAlign: "center" }}>
          <div style={titleStyle}>Loading World Data</div>
          <div style={{ fontSize: "14px" }}>Reading from local storage...</div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={containerStyle}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>&#x2756;</div>
          <div style={titleStyle}>World Data Unavailable</div>
          <div style={{ fontSize: "14px" }}>{loadError}</div>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "48px", marginBottom: "16px" }}>&#x2756;</div>
        <div style={titleStyle}>No World Data</div>
        <div style={{ fontSize: "14px" }}>
          Run a simulation in Lore Weave and enrich it with Illuminator to view the world chronicle.
        </div>
      </div>
    </div>
  );
}

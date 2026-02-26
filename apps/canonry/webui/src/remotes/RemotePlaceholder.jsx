/**
 * RemotePlaceholder - Shown when a remote module is not available
 */

import React from "react";
import PropTypes from "prop-types";
import { colors, typography, spacing, radius } from "../theme";

const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    padding: spacing.xxxl,
    textAlign: "center",
  },
  icon: {
    fontSize: "48px",
    marginBottom: spacing.lg,
    opacity: 0.5,
  },
  title: {
    fontSize: typography.sizeXxl,
    fontWeight: typography.weightSemibold,
    fontFamily: typography.fontFamily,
    marginBottom: spacing.sm,
    color: colors.textPrimary,
  },
  message: {
    fontSize: typography.sizeLg,
    fontFamily: typography.fontFamily,
    color: colors.textSecondary,
    marginBottom: spacing.xxl,
    maxWidth: "400px",
  },
  instructions: {
    backgroundColor: colors.bgSecondary,
    padding: `${spacing.lg} ${spacing.xxl}`,
    borderRadius: radius.lg,
    fontSize: typography.sizeMd,
    fontFamily: "monospace",
    color: colors.textSecondary,
    border: `1px solid ${colors.border}`,
  },
};

export default function RemotePlaceholder({ name, instructions }) {
  return (
    <div style={styles.container}>
      <div style={styles.icon}>🔌</div>
      <div style={styles.title}>{name} Not Connected</div>
      <div style={styles.message}>
        The {name} module is not currently running. Start it to enable this feature.
      </div>
      {instructions && <div style={styles.instructions}>{instructions}</div>}
    </div>
  );
}

RemotePlaceholder.propTypes = {
  name: PropTypes.string.isRequired,
  instructions: PropTypes.string,
};

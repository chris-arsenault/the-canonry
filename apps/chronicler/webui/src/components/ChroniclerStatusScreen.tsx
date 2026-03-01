import styles from "./ChroniclerStatusScreen.module.css";
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
      <div className={styles.container}>
        <div className={styles.content}>
          <div className={styles.title}>Loading World Data</div>
          <div className={styles.detail}>Reading from local storage...</div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className={styles.container}>
        <div className={styles.content}>
          <div className={styles.icon}>&#x2756;</div>
          <ErrorMessage title="World Data Unavailable" message={loadError} />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.icon}>&#x2756;</div>
        <div className={styles.title}>No World Data</div>
        <div className={styles.detail}>
          Run a simulation in Lore Weave and enrich it with Illuminator to view the world chronicle.
        </div>
      </div>
    </div>
  );
}

/**
 * ValidationPanel - Structure Validation UI
 *
 * Validates JSON configuration structure BEFORE simulation runs:
 * - Required fields present
 * - Correct types (string, number, object, array)
 * - Valid shapes (CultureSpec, SubtypeSpec, generator format)
 *
 * This is a HARD GATE - simulation will not start if structure errors exist.
 *
 * For semantic validation (reference integrity, pressure balance, orphan detection),
 * see the Coherence Engine tab in the main navigation.
 */

import React, { useMemo } from 'react';
import { validateAllConfigs, formatValidationResult } from '../../../../lib/engine/configSchemaValidator';

const styles = {
  container: {
    padding: '24px',
    height: '100%',
    overflow: 'auto',
  },
  header: {
    marginBottom: '24px',
  },
  title: {
    fontSize: '24px',
    fontWeight: 600,
    color: 'var(--lw-text)',
    marginBottom: '8px',
  },
  subtitle: {
    fontSize: '14px',
    color: 'var(--lw-text-muted)',
  },
  statusBanner: {
    padding: '16px 20px',
    borderRadius: '8px',
    marginBottom: '24px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  statusValid: {
    backgroundColor: 'rgba(74, 222, 128, 0.15)',
    border: '1px solid rgba(74, 222, 128, 0.3)',
  },
  statusInvalid: {
    backgroundColor: 'rgba(248, 113, 113, 0.15)',
    border: '1px solid rgba(248, 113, 113, 0.3)',
  },
  statusIcon: {
    fontSize: '24px',
  },
  statusText: {
    flex: 1,
  },
  statusTitle: {
    fontWeight: 600,
    marginBottom: '4px',
  },
  statusSubtitle: {
    fontSize: '13px',
    color: 'var(--lw-text-muted)',
  },
  section: {
    marginBottom: '24px',
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: 'var(--lw-text)',
    marginBottom: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  sectionCount: {
    fontSize: '12px',
    padding: '2px 8px',
    borderRadius: '12px',
    backgroundColor: 'var(--lw-bg-tertiary)',
  },
  errorList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  errorCard: {
    backgroundColor: 'var(--lw-bg-secondary)',
    borderRadius: '8px',
    border: '1px solid var(--lw-border)',
    overflow: 'hidden',
  },
  errorHeader: {
    padding: '12px 16px',
    backgroundColor: 'rgba(248, 113, 113, 0.1)',
    borderBottom: '1px solid var(--lw-border)',
  },
  errorPath: {
    fontFamily: 'monospace',
    fontSize: '13px',
    color: 'var(--lw-danger)',
    marginBottom: '4px',
  },
  errorMessage: {
    fontSize: '14px',
    fontWeight: 500,
  },
  errorBody: {
    padding: '12px 16px',
  },
  errorRow: {
    display: 'flex',
    marginBottom: '8px',
    fontSize: '13px',
  },
  errorLabel: {
    width: '80px',
    color: 'var(--lw-text-muted)',
    flexShrink: 0,
  },
  errorValue: {
    fontFamily: 'monospace',
    backgroundColor: 'var(--lw-bg-tertiary)',
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '12px',
    wordBreak: 'break-all',
  },
  suggestion: {
    marginTop: '12px',
    padding: '12px',
    backgroundColor: 'rgba(108, 155, 255, 0.1)',
    borderRadius: '6px',
    borderLeft: '3px solid var(--lw-accent)',
  },
  suggestionLabel: {
    fontSize: '11px',
    fontWeight: 600,
    color: 'var(--lw-accent)',
    marginBottom: '4px',
    textTransform: 'uppercase',
  },
  suggestionText: {
    fontSize: '13px',
    color: 'var(--lw-text)',
  },
  warningCard: {
    backgroundColor: 'var(--lw-bg-secondary)',
    borderRadius: '8px',
    border: '1px solid var(--lw-border)',
    overflow: 'hidden',
  },
  warningHeader: {
    padding: '12px 16px',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderBottom: '1px solid var(--lw-border)',
  },
  warningPath: {
    fontFamily: 'monospace',
    fontSize: '13px',
    color: 'var(--lw-warning)',
    marginBottom: '4px',
  },
  emptyState: {
    textAlign: 'center',
    padding: '48px 24px',
    color: 'var(--lw-text-muted)',
  },
  emptyIcon: {
    fontSize: '48px',
    marginBottom: '16px',
  },
  stats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '12px',
    marginTop: '24px',
  },
  statCard: {
    backgroundColor: 'var(--lw-bg-secondary)',
    padding: '16px',
    borderRadius: '8px',
    border: '1px solid var(--lw-border)',
  },
  statValue: {
    fontSize: '24px',
    fontWeight: 600,
    color: 'var(--lw-text)',
  },
  statLabel: {
    fontSize: '12px',
    color: 'var(--lw-text-muted)',
    marginTop: '4px',
  },
};

function ErrorCard({ error }) {
  return (
    <div style={styles.errorCard}>
      <div style={styles.errorHeader}>
        <div style={styles.errorPath}>{error.path}</div>
        <div style={styles.errorMessage}>{error.message}</div>
      </div>
      <div style={styles.errorBody}>
        <div style={styles.errorRow}>
          <span style={styles.errorLabel}>Expected:</span>
          <code style={styles.errorValue}>{error.expected}</code>
        </div>
        <div style={styles.errorRow}>
          <span style={styles.errorLabel}>Got:</span>
          <code style={styles.errorValue}>{JSON.stringify(error.value)}</code>
        </div>
        {error.suggestion && (
          <div style={styles.suggestion}>
            <div style={styles.suggestionLabel}>Suggestion</div>
            <div style={styles.suggestionText}>{error.suggestion}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function WarningCard({ warning }) {
  return (
    <div style={styles.warningCard}>
      <div style={styles.warningHeader}>
        <div style={styles.warningPath}>{warning.path}</div>
        <div style={styles.errorMessage}>{warning.message}</div>
      </div>
      {warning.suggestion && (
        <div style={styles.errorBody}>
          <div style={styles.suggestion}>
            <div style={styles.suggestionLabel}>Suggestion</div>
            <div style={styles.suggestionText}>{warning.suggestion}</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ValidationPanel({
  schema,
  eras,
  generators,
  pressures,
  systems,
  actions,
  seedEntities,
}) {
  // Run validation
  const validationResult = useMemo(() => {
    // Extract culture/entity/relationship IDs from schema
    const cultures = schema?.cultures?.map(c => c.id) || [];
    const entityKinds = schema?.entityKinds?.map(k => k.kind) || [];
    const relationshipKinds = schema?.relationshipKinds?.map(k => k.kind) || [];

    const result = validateAllConfigs({
      templates: generators,
      pressures: pressures,
      systems: systems,
      eras: eras,
      actions: actions,
      seedEntities: seedEntities,
      schema: {
        cultures,
        entityKinds,
        relationshipKinds,
      },
    });

    return result;
  }, [schema, eras, generators, pressures, systems, actions, seedEntities]);

  const { valid, errors, warnings } = validationResult;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Structure Validation</h1>
        <p style={styles.subtitle}>
          Validates JSON config structure (types, required fields, shapes). This is a hard gate before simulation.
          For semantic validation (references, balance, orphans), see the Coherence Engine tab.
        </p>
      </div>

      {/* Status Banner */}
      <div style={{
        ...styles.statusBanner,
        ...(valid ? styles.statusValid : styles.statusInvalid),
      }}>
        <span style={styles.statusIcon}>{valid ? '✓' : '✗'}</span>
        <div style={styles.statusText}>
          <div style={styles.statusTitle}>
            {valid ? 'Configuration is valid' : 'Configuration has errors'}
          </div>
          <div style={styles.statusSubtitle}>
            {errors.length} error{errors.length !== 1 ? 's' : ''}, {warnings.length} warning{warnings.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Errors Section */}
      {errors.length > 0 && (
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>
            Errors
            <span style={{ ...styles.sectionCount, backgroundColor: 'rgba(248, 113, 113, 0.2)', color: 'var(--lw-danger)' }}>
              {errors.length}
            </span>
          </h2>
          <div style={styles.errorList}>
            {errors.map((error, i) => (
              <ErrorCard key={i} error={error} />
            ))}
          </div>
        </div>
      )}

      {/* Warnings Section */}
      {warnings.length > 0 && (
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>
            Warnings
            <span style={{ ...styles.sectionCount, backgroundColor: 'rgba(245, 158, 11, 0.2)', color: 'var(--lw-warning)' }}>
              {warnings.length}
            </span>
          </h2>
          <div style={styles.errorList}>
            {warnings.map((warning, i) => (
              <WarningCard key={i} warning={warning} />
            ))}
          </div>
        </div>
      )}

      {/* Empty state when all good */}
      {valid && warnings.length === 0 && (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>✓</div>
          <div>All configuration files are valid and ready for simulation.</div>
        </div>
      )}

      {/* Stats */}
      <div style={styles.stats}>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{generators?.length || 0}</div>
          <div style={styles.statLabel}>Generators</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{pressures?.length || 0}</div>
          <div style={styles.statLabel}>Pressures</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{systems?.length || 0}</div>
          <div style={styles.statLabel}>Systems</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{actions?.length || 0}</div>
          <div style={styles.statLabel}>Actions</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{eras?.length || 0}</div>
          <div style={styles.statLabel}>Eras</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{seedEntities?.length || 0}</div>
          <div style={styles.statLabel}>Seed Entities</div>
        </div>
      </div>
    </div>
  );
}

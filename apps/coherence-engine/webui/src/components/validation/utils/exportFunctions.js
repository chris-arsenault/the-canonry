/**
 * Export functions for validation results
 */

export function formatValidationForExport(validationResults) {
  const items = [];

  // Process errors
  for (const error of validationResults.errors) {
    for (const item of error.affectedItems) {
      items.push({
        severity: 'ERROR',
        category: error.id,
        title: error.title,
        message: error.message,
        itemId: item.id,
        itemLabel: item.label,
        detail: item.detail || '',
      });
    }
  }

  // Process warnings
  for (const warning of validationResults.warnings) {
    for (const item of warning.affectedItems) {
      items.push({
        severity: 'WARNING',
        category: warning.id,
        title: warning.title,
        message: warning.message,
        itemId: item.id,
        itemLabel: item.label,
        detail: item.detail || '',
      });
    }
  }

  return items;
}

export function exportAsJson(validationResults) {
  const items = formatValidationForExport(validationResults);
  const json = JSON.stringify({
    exportedAt: new Date().toISOString(),
    summary: {
      errorCount: validationResults.errors.length,
      warningCount: validationResults.warnings.length,
      totalItems: items.length,
    },
    issues: items,
  }, null, 2);

  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `validation-report-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportAsCsv(validationResults) {
  const items = formatValidationForExport(validationResults);

  // CSV header
  const headers = ['Severity', 'Category', 'Title', 'Message', 'Item ID', 'Item Label', 'Detail'];

  // Escape CSV field
  const escapeField = (field) => {
    const str = String(field || '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  // Build CSV rows
  const rows = [
    headers.join(','),
    ...items.map(item => [
      item.severity,
      item.category,
      escapeField(item.title),
      escapeField(item.message),
      escapeField(item.itemId),
      escapeField(item.itemLabel),
      escapeField(item.detail),
    ].join(',')),
  ];

  const csv = rows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `validation-report-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

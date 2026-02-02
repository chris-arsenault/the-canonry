import React from 'react';

/**
 * Test panel for generating test names from a profile
 */
export default function TestPanel({ profile, testNames, testLoading, testError, strategyUsage, onTest, onClose }) {
  return (
    <div className="test-panel">
      <div className="flex justify-between align-center mb-md">
        <h4 className="mt-0 mb-0">Test: {profile.id}</h4>
        <div className="flex gap-sm">
          <button className="primary text-small" onClick={() => onTest(profile, 10)} disabled={testLoading}>
            {testLoading ? '...' : 'Generate'}
          </button>
          <button className="secondary text-small" onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      {testError && (
        <div className="error mb-md text-small">{testError}</div>
      )}

      {strategyUsage && (
        <div className="strategy-usage-panel">
          {Object.entries(strategyUsage)
            .filter(([, count]) => count > 0)
            .map(([strategy, count]) => (
              <span key={strategy} className="mr-sm">
                {strategy}: {count}
              </span>
            ))}
        </div>
      )}

      {testNames.length > 0 ? (
        <div className="test-names-list">
          {testNames.map((name, i) => (
            <div key={i} className="test-name-item">
              {name}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-muted text-small mt-0 mb-0">
          Click Generate to test this profile
        </p>
      )}
    </div>
  );
}
